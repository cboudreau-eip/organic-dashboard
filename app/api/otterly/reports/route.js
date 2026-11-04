import {compareReports} from '../../../../lib/otterly/changes';
import {otterlyAccess,runOtterlySync} from '../../../../lib/otterly/server';
import {siteUrl} from '../../../../lib/auth/config';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export const maxDuration=300;
const reply=(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'private, no-store'}});
export async function GET(request){
 try{
  const {client,role}=await otterlyAccess();
  const params=new URL(request.url).searchParams,id=params.get('id');
  if([...params.keys()].some(k=>k!=='id')||params.getAll('id').length>1||id&&!/^[0-9a-f-]{36}$/i.test(id))return reply({error:'Invalid report selection.'},400);
  const history=await client.from('otterly_snapshots').select('id,created_at,period_end').order('period_end',{ascending:false}).limit(90);
  if(history.error)throw Error('storage');
  let report=null;const selected=id||history.data[0]?.id;
  if(selected){const result=await client.from('otterly_snapshots').select('id,payload').eq('id',selected).maybeSingle();if(result.error)throw Error('storage');if(!result.data)return reply({error:'Report not found.'},404);report=result.data;}
  let previous=null;
  if(report){const prior=await client.from('otterly_snapshots').select('id,payload').lt('period_end',report.payload.period.end).order('period_end',{ascending:false}).limit(1);if(prior.error)throw Error('storage');previous=prior.data[0]?.payload||null;}
  const comparison=report?compareReports(report.payload,previous):null;
  const run=await client.from('otterly_sync_runs').select('status,started_at,finished_at,message').order('period_end',{ascending:false}).limit(1);
  if(run.error)throw Error('storage');
  return reply({report,comparison,history:history.data,run:run.data[0]||null,role,configured:Boolean(process.env.OTTERLY_API_KEY)});
 }catch(e){return reply({error:e.status===401?'Sign in to view AI visibility.':e.status===403?'Team access is required.':'AI visibility reports are unavailable. Please retry.'},[401,403,404].includes(e.status)?e.status:503);}
}
export async function POST(request){
 try{
  if(request.headers.get('origin')!==new URL(siteUrl()).origin)return reply({error:'Start the sync from the dashboard.'},403);
  await otterlyAccess('import');
  return reply(await runOtterlySync());
 }catch(e){return reply({error:e.status===401?'Sign in to sync.':e.status===403?'Analyst access is required.':'Otterly sync failed. The last saved report is unchanged. Check API access and retry later.'},[401,403,404].includes(e.status)?e.status:503);}
}
