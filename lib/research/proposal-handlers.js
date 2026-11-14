import {generateProposals,proposalEdit,publicProposalPlan} from './proposals.js';
import {hydratePayload} from './storage.js';
import {uuid} from './contracts.js';
const reply=(x,status=200)=>Response.json(x,{status,headers:{'Cache-Control':'private, no-store'}});
const read=r=>{if(r.error)throw Error('Proposal storage is unavailable. Please retry.');return r.data;};
export function proposalHandlers({access,origin}){
 const fail=e=>reply({error:[400,403,404,409,422].includes(e.status)?e.message:'Proposals could not be saved or loaded. Your previous plans are unchanged.'},e.status||503);
 return {
 async GET(request){try{
  const {client,role}=await access('read'),id=new URL(request.url).searchParams.get('plan');if(id&&!uuid(id))throw Object.assign(Error('Invalid plan.'),{status:400});
  const history=read(await client.from('proposed_content_plans').select('id,created_at,research_run_id').order('created_at',{ascending:false}).limit(30))||[];
  const selected=id||history[0]?.id,plan=selected?read(await client.from('proposed_content_plans').select('*').eq('id',selected).maybeSingle()):null;
  if(id&&!plan)throw Object.assign(Error('Plan not found.'),{status:404});
  const runs=read(await client.from('research_runs').select('id,created_at').eq('status','complete').order('created_at',{ascending:false}).limit(30))||[];
  return reply({plan:publicProposalPlan(plan),history,runs,canEdit:['analyst','admin'].includes(role)});
 }catch(e){return fail(e);}},
 async POST(request){try{
  if(request.headers.get('origin')!==new URL(origin()).origin)throw Object.assign(Error('Make changes from the dashboard.'),{status:403});
  const {client}=await access('run');
  const reader=request.body?.getReader();if(!reader)throw Object.assign(Error('Missing request.'),{status:400});let size=0;const chunks=[];
  try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>15000){await reader.cancel();throw Object.assign(Error('Request too large.'),{status:400});}chunks.push(value);}}finally{reader.releaseLock();}
  let input;try{input=JSON.parse(Buffer.concat(chunks).toString());}catch{throw Object.assign(Error('Invalid request.'),{status:400});}
  if(input.action==='generate'){
   if(!uuid(input.runId))throw Object.assign(Error('Choose completed research first.'),{status:422});
   const run=read(await client.from('research_runs').select('*').eq('id',input.runId).maybeSingle());if(run?.status!=='complete')throw Object.assign(Error('Completed research is required.'),{status:422});
   const source=await hydratePayload(client,run,['results','evidence','inventory']);
   const payload=generateProposals(source,run.settings);
   const plan=read(await client.from('proposed_content_plans').insert({research_run_id:run.id,payload}).select('*').single());return reply({plan:publicProposalPlan(plan)},201);
  }
  if(input.action==='edit'){
   if(!uuid(input.planId)||!Number.isInteger(input.version))throw Object.assign(Error('Invalid plan version.'),{status:422});
   const plan=read(await client.from('proposed_content_plans').select('*').eq('id',input.planId).maybeSingle());if(!plan)throw Object.assign(Error('Plan not found.'),{status:404});
   let fields;try{fields=proposalEdit(input,plan.payload.items);}catch(e){throw Object.assign(e,{status:422});}
   const edits={...plan.edits,[input.itemId]:{...plan.edits[input.itemId],...fields}};
   const saved=read(await client.from('proposed_content_plans').update({edits}).eq('id',plan.id).eq('version',input.version).select('*').maybeSingle());
   if(!saved)throw Object.assign(Error('This plan changed in another tab. Reload before saving.'),{status:409});return reply({plan:publicProposalPlan(saved)});
  }
  throw Object.assign(Error('Unsupported proposal action.'),{status:400});
 }catch(e){return fail(e);}}
 };}
