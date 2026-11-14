import {DEFAULTS,ResearchError,settingsInput,reviewInput,uuid} from './contracts.js';
import {advance,initialPayload,publicRun} from './engine.js';
import {packPayload,saveAssets,hydratePayload,stepParts} from './storage.js';
const reply=(value,status=200)=>Response.json(value,{status,headers:{'Cache-Control':'private, no-store'}});
const check=r=>{if(r.error){console.error('Research storage failed',{code:r.error.code||'transport',status:r.status});throw Error('Research storage unavailable');}return r.data;};
const conflict=r=>{if(r.error?.code==='23505'||(!r.error&&!r.data))throw new ResearchError('This record changed. Reload to see the latest version before continuing.',409);return check(r);};
async function body(request){
 const reader=request.body?.getReader();if(!reader)throw new ResearchError('Request is missing.',400);
 const chunks=[];let size=0;try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>16000){await reader.cancel();throw new ResearchError('Request is too large.',413);}chunks.push(value);}}finally{reader.releaseLock();}
 try{return JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{throw new ResearchError('Invalid request.',400);}
}
const caught=e=>reply({error:e instanceof ResearchError||[401,403,404].includes(e.status)?e.message:'Research could not complete this step. Your saved progress is safe. Retry or check source connections.'},e.status||503);
export function researchHandlers({access,origin,adapters}){return {
 async GET(request){try{
  const {client,role}=await access('read');const params=new URL(request.url).searchParams,id=params.get('run'),key=params.get('opportunity');
  if(id&&!uuid(id))throw new ResearchError('Invalid run.',400);
  if(key){
   if(!id||!/^[a-f0-9]{24}$/.test(key))throw new ResearchError('Invalid opportunity.',400);
   const run=check(await client.from('research_runs').select('*').eq('id',id).maybeSingle());
   if(!run||run.status!=='complete')throw new ResearchError('Completed run not found.',404);
   const payload=await hydratePayload(client,run,['results']);
   const item=payload.results?.items?.find(x=>x.key===key);if(!item)throw new ResearchError('Opportunity not found.',404);
   return reply({item});
  }
  const [settings,history,reviews]=await Promise.all([
   client.from('research_settings').select('*').eq('id','team').maybeSingle(),
   client.from('research_runs').select('id,created_at,status,stage,version').order('created_at',{ascending:false}).limit(30),
   client.from('research_reviews').select('*').limit(10000)
  ]);
  const runs=check(history)||[],selected=id||runs[0]?.id;
  const run=selected?check(await client.from('research_runs').select('*').eq('id',selected).maybeSingle()):null;
  if(id&&!run)throw new ResearchError('Run not found.',404);
  if(run)run.payload=await hydratePayload(client,run,['results']);
  return reply({settings:check(settings)||{settings:DEFAULTS,version:0},runs,reviews:check(reviews)||[],run:publicRun(run),canEdit:['analyst','admin'].includes(role)});
 }catch(e){return caught(e);}},
 async POST(request){try{
  if(request.headers.get('origin')!==new URL(origin()).origin)throw new ResearchError('Make changes from the dashboard.',403);
  const {client}=await access('run'),input=await body(request);
  if(input.action==='settings'){
   const settings=settingsInput(input.settings),version=input.version;
   if(!Number.isInteger(version)||version<0)throw new ResearchError('Invalid settings version.');
   const saved=version===0?await client.from('research_settings').insert({id:'team',settings}).select('*').single():await client.from('research_settings').update({settings}).eq('id','team').eq('version',version).select('*').maybeSingle();
   return reply({settings:conflict(saved)});
  }
  if(input.action==='start'||input.action==='discover'){
   const settings=check(await client.from('research_settings').select('settings').eq('id','team').maybeSingle());
   if(!settings)throw new ResearchError('Save your planning settings before starting research.');
   const previous=check(await client.from('research_runs').select('id').eq('status','complete').order('created_at',{ascending:false}).limit(1));
   const payload=initialPayload();payload.inventory.cacheFrom=previous?.[0]?.id||null;
   if(input.action==='discover'){
    const baseline=check(await client.from('research_validations').select('id,payload').eq('status','complete').order('created_at',{ascending:false}).limit(1));
    payload.discovery={baseline:baseline?.[0]?.id||null,previousKeys:[...new Set((baseline?.[0]?.payload?.assignments||[]).flatMap(a=>(a.topics||[]).map(t=>t.key)))],previousTerms:[...new Set((baseline?.[0]?.payload?.assignments||[]).flatMap(a=>(a.topics||[]).flatMap(t=>[t.title,...(t.terms||[])]).filter(Boolean)))]};
   }
   const run=check(await client.from('research_runs').insert({settings:settingsInput(settings.settings),payload}).select('*').single());
   return reply({run:publicRun(run)},201);
  }
  if(input.action==='rerank'){
   if(!uuid(input.runId))throw new ResearchError('Invalid research run.');
   const previous=check(await client.from('research_runs').select('id,status,settings').eq('id',input.runId).maybeSingle());
   if(previous?.status!=='complete')throw new ResearchError('Choose a completed research run.');
   const payload=initialPayload();payload.rerankedFrom=previous.id;
   const run=check(await client.from('research_runs').insert({settings:previous.settings,payload,stage:'rank'}).select('*').single());
   return reply({run:publicRun(run)},201);
  }
  if(input.action==='step'){
   if(!uuid(input.runId)||!Number.isInteger(input.version))throw new ResearchError('Invalid research run.');
   const run=check(await client.from('research_runs').select('*').eq('id',input.runId).maybeSingle());
   if(!run)throw new ResearchError('Run not found.',404);
   if(run.status==='complete'){run.payload=await hydratePayload(client,run,['results']);return reply({run:publicRun(run)});}
   if(run.version!==input.version)throw new ResearchError('This run advanced in another tab. Reload before resuming.',409);
   run.payload=await hydratePayload(client,run,stepParts(run.stage));
   if(run.stage==='rank'&&run.payload.rerankedFrom&&!run.payload.rerankLoaded){
    const previous=check(await client.from('research_runs').select('*').eq('id',run.payload.rerankedFrom).maybeSingle());
    if(previous?.status!=='complete')throw new ResearchError('The original evidence run is unavailable.');
    const original=await hydratePayload(client,previous,['evidence','inventory']);
    if(original.discovery?.baseline&&!original.discovery.previousTerms){const baseline=check(await client.from('research_validations').select('payload').eq('id',original.discovery.baseline).maybeSingle());if(!baseline)throw new ResearchError('The discovery baseline is unavailable. Start fresh discovery.');original.discovery.previousTerms=[...new Set((baseline.payload?.assignments||[]).flatMap(a=>(a.topics||[]).flatMap(t=>[t.title,...(t.terms||[])]).filter(Boolean)))];}
    for(const source of Object.values(original.evidence||{}))if(source.status==='available'&&source.period?.end&&Date.now()-Date.parse(source.period.end+'T00:00:00Z')>14*86400000)source.status='stale';
    run.payload={evidence:original.evidence,inventory:original.inventory,rerankedFrom:previous.id,rerankLoaded:true,...(original.discovery?{discovery:original.discovery}:{})};
   }
   if(run.stage==='sitemaps'&&run.payload.inventory.cacheFrom&&!run.payload.inventory.cacheLoaded){
    const previous=check(await client.from('research_runs').select('*').eq('id',run.payload.inventory.cacheFrom).maybeSingle());
    if(previous){const cached=await hydratePayload(client,previous,['inventory.pages']);run.payload.inventory.cachedPages=initialPayload(cached.inventory.pages).inventory.cachedPages;}
    run.payload.inventory.cacheLoaded=true;
   }
   const next=await advance(run,adapters(client));
   const packed=packPayload(next.payload);await saveAssets(client,run.id,packed.assets);
   const saved=conflict(await client.from('research_runs').update({...next,payload:packed.payload}).eq('id',run.id).eq('version',run.version).select('*').maybeSingle());
   if(next.payload.results)saved.payload.results=next.payload.results;
   return reply({run:publicRun(saved)});
  }
  if(input.action==='review'){
   const v=reviewInput(input),version=input.version;
   if(!Number.isInteger(version)||version<0)throw new ResearchError('Invalid review version.');
   const run=check(await client.from('research_runs').select('id,status,payload').eq('id',v.runId).maybeSingle());
   if(run)run.payload=await hydratePayload(client,run,['results']);
   if(run?.status!=='complete'||!run.payload?.results?.items?.some(i=>i.key===v.key))throw new ResearchError('Review an opportunity from a completed run.');
   const fields={run_id:v.runId,decision:v.decision,reason:v.reason};
   const saved=version===0?await client.from('research_reviews').insert({key:v.key,...fields}).select('*').single():await client.from('research_reviews').update(fields).eq('key',v.key).eq('version',version).select('*').maybeSingle();
   return reply({review:conflict(saved)});
  }
  throw new ResearchError('Unsupported research action.',400);
 }catch(e){return caught(e);}}
};}
