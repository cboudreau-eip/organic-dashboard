import {uuid} from '../growth-hunter/actions.js';
import {promptOpportunities} from './report.js';
import {reviewSuggestion} from './content-suggestion.js';
const reply=(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'private, no-store'}});
const fail=(message,status)=>{throw Object.assign(Error(message),{status});};
export function contentHandler({access,origin,sources,generate,configured=()=>true}){
 // Best-effort per-instance burst protection, alongside provider project budgets.
 const limits=new Map();
 return async request=>{try{
  if(request.headers.get('origin')!==new URL(origin()).origin)fail('Generate suggestions from the dashboard.',403);
  const {client,user}=await access('run');
  if(!configured())fail('Charlie is not configured. Ask your administrator to check the AI connection.',503);
  const reader=request.body?.getReader();if(!reader)fail('Choose an opportunity.',400);
  const chunks=[];let size=0;
  try{for(;;){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>1024){await reader.cancel();fail('Request too large.',413);}chunks.push(value);}}finally{reader.releaseLock();}
  let input;try{input=JSON.parse(Buffer.concat(chunks).toString());}catch{fail('Invalid request.',400);}
  if(!uuid(input?.snapshotId)||typeof input.promptId!=='string'||!/^[A-Z0-9]{26}$/.test(input.promptId))fail('Choose a saved opportunity.',400);
  const now=Date.now();for(const [id,limit] of limits)if(limit.until<now)limits.delete(id);
  const limit=limits.get(user.id)||{count:0,until:now+60000};if(limit.count>=3)fail('Please wait a minute before generating more suggestions.',429);limit.count++;limits.set(user.id,limit);
  const r=await client.from('otterly_snapshots').select('payload').eq('id',input.snapshotId).maybeSingle();
  if(r.error)throw Error('storage');if(!r.data)fail('Saved report not found.',404);
  const report=r.data.payload,prompt=promptOpportunities(report.prompts).find(p=>p.id===input.promptId);
  if(!prompt)fail('This prompt is not a supported opportunity.',422);
  const pages=await sources(prompt.prompt);if(!pages.length)fail('No relevant MedicareFAQ pages could be read. Please retry later or review the opportunity manually.',422);
  const evidence={prompt,period:report.period,platforms:report.promptPlatforms?.map(p=>({platform:p.label,prompt:p.prompts?.find(x=>x.id===prompt.id)||null})),pages};
  const output=await generate(evidence);
  const suggestion=reviewSuggestion(output,pages,prompt.prompt,report.period);
  return reply({suggestion,sources:pages.map(({id,url,truncated})=>({id,url,truncated})),generatedAt:new Date().toISOString()});
 }catch(e){return reply({error:e.status?e.message:'Charlie could not complete the recommendation. Please retry. No action was saved.'},e.status||503);}};
}
