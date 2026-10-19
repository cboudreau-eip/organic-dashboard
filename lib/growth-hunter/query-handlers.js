import { authorizeGrowth } from './access.js';
import { GrowthError } from './contracts.js';
import { QUERY_VERSION, validateQueryTarget } from './keywords.js';
import { API_COVERAGE } from './live.js';
import { reply,errorReply,readBody } from './handlers.js';
const uuid=value=>typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
export function createQueryHandlers({getClient,enabled,origin,loadEvidence}) {
 async function access(action){const allowed=enabled();return authorizeGrowth(allowed?await getClient():null,allowed,action);}
 function input(body){if(!body||Object.keys(body).length!==2||!uuid(body.runId)||typeof body.page!=='string'||body.page.length>2000)throw new GrowthError('Choose a page from a saved analysis.');return body;}
 async function target(client,{runId,page}) {
  const {data:run,error}=await client.from('growth_decline_runs').select('id,prior_snapshot_id,current_snapshot_id,result').eq('id',runId).maybeSingle();
  if(error)throw new GrowthError('Saved analysis is unavailable.',503);
  if(!run||!run.result.findings.some(item=>item.url===page))throw new GrowthError('This page is not a finding in that analysis.',404);
  const {data:snapshots,error:snapshotError}=await client.from('growth_snapshots').select('id,coverage,period_start,period_end').in('id',[run.prior_snapshot_id,run.current_snapshot_id]);
  if(snapshotError)throw new GrowthError('Saved evidence is unavailable.',503);
  if(snapshots?.length!==2||snapshots.some(item=>item.coverage!==API_COVERAGE))throw new GrowthError('Run a connected GSC analysis first. Manual export filters cannot be verified for keyword research.',422,'unsupported_scope');
  const prior=snapshots.find(s=>s.id===run.prior_snapshot_id),current=snapshots.find(s=>s.id===run.current_snapshot_id);
  const result={page,priorPeriod:{start:prior.period_start,end:prior.period_end},currentPeriod:{start:current.period_start,end:current.period_end}};
  validateQueryTarget(result);return result;
 }
 async function saved(client,{runId,page}) {
  const {data,error}=await client.from('growth_query_research').select('id,created_at,run_id,page,version,payload').eq('run_id',runId).eq('page',page).eq('version',QUERY_VERSION).maybeSingle();
  if(error)throw new GrowthError('Saved keyword research is unavailable.',503);
  return data;
 }
 return {
  async GET(request){try{const {client}=await access('read');const params=new URL(request.url).searchParams;const body=input(Object.fromEntries(params));await target(client,body);return reply({research:await saved(client,body)});}catch(error){return errorReply(error);}},
  async POST(request){try{
   const {client}=await access('run');
   if(request.headers.get('origin')!==new URL(origin()).origin)throw new GrowthError('Investigate keywords from the dashboard.',403,'origin_rejected');
   const body=input(await readBody(request,4096));const selected=await target(client,body);
   const existing=await saved(client,body);if(existing)return reply({research:existing,reused:true});
   const payload=await loadEvidence(selected);
   const {data,error}=await client.rpc('growth_save_query_research',{selected_run:body.runId,input:payload});
   if(error)throw new GrowthError(error.code==='42501'?'Research permission changed. Reload before continuing.':'Keyword research could not be saved. Please retry.',error.code==='42501'?403:503);
   const {created_by,...research}=data.research;return reply({research,reused:data.reused},data.reused?200:201);
  }catch(error){return errorReply(error);}},
 };
}
