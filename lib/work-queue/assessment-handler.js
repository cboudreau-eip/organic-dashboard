import {uuid} from '../research/contracts.js';
import {readBody,reply} from '../growth-hunter/handlers.js';
import {safePage} from '../otterly/content-sources.js';
import {assessmentFingerprint,assessmentCurrent} from './assessment.js';
const problem=(message,status=503)=>Object.assign(Error(message),{status});
function unwrap(r){if(r.error)throw problem('Assessment storage is unavailable. Your saved instructions are unchanged.');return r.data;}
export function assessmentHandlers({access,origin,store,generate,configured}){
 async function context(client,queueId,assignmentId){
  if(!uuid(queueId)||typeof assignmentId!=='string'||assignmentId.length>100)throw problem('Choose a saved task.',422);
  const q=unwrap(await client.from('content_work_pilots').select('*').eq('id',queueId).maybeSingle());
  const e=q?.entries.find(e=>e.assignment_id===assignmentId);if(!e)throw problem('Task not found.',404);
  const plan=unwrap(await client.from('proposed_content_plans').select('payload,edits').eq('id',q.source_plan_id).maybeSingle());
  const source=plan?.payload?.items?.find(i=>i.id===assignmentId);
  if(!source)throw problem('The source assignment is unavailable.',409);
  const entry={...e,snapshot:{...source,...(plan.edits?.[assignmentId]||{})}},sourceDates=plan.payload.sourceDates||{};
  return {entry,sourceDates,fingerprint:assessmentFingerprint(entry,sourceDates)};
 }
 const fail=e=>reply({error:e.status?e.message:'The assessment could not complete. Your saved instructions are unchanged; please retry.'},e.status||503);
 async function history(client,q,a){return unwrap(await client.from('content_work_assessments').select('*').eq('queue_id',q).eq('assignment_id',a).order('created_at',{ascending:false}).limit(20))||[];}
 return {
  async GET(request){try{const {client}=await access('read'),p=new URL(request.url).searchParams,q=p.get('queueId'),a=p.get('assignmentId'),c=await context(client,q,a),rows=await history(client,q,a);return reply({history:rows,current:rows.find(r=>assessmentCurrent(r,c.fingerprint))||null,fingerprint:c.fingerprint,hasTarget:!!safePage(c.entry.snapshot.targetUrl)});}catch(e){return fail(e);}},
  async POST(request){let job,db;try{
   if(request.headers.get('origin')!==new URL(origin()).origin)throw problem('Prepare assessments from the dashboard.',403);
   const {client,user}=await access('run');
   if(!configured())throw problem('AI assessment is not configured. Your saved instructions are unchanged.');
   const input=await readBody(request,4096);
   if(!input||Object.keys(input).some(k=>!['queueId','assignmentId','fingerprint','refresh'].includes(k)))throw problem('Invalid assessment request.',422);
   const {queueId:q,assignmentId:a}=input,c=await context(client,q,a);
   if(input.fingerprint!==c.fingerprint)throw problem('This task changed. Reopen it before preparing a brief.',409);
   if(!safePage(c.entry.snapshot.targetUrl))throw problem('Choose a MedicareFAQ target page in the calendar before preparing a page assessment.',422);
   const rows=await history(client,q,a),current=rows.find(r=>assessmentCurrent(r,c.fingerprint));
   if(current&&!input.refresh)return reply({assessment:current});
   db=store();
   // Expire abandoned work; the unique running-job index prevents duplicate generation across instances.
   unwrap(await db.from('content_work_assessments').update({status:'failed',error:'Assessment timed out. Please retry.'}).eq('queue_id',q).eq('assignment_id',a).eq('status','running').lt('created_at',new Date(Date.now()-5*60000).toISOString()));
   const recent=unwrap(await db.from('content_work_assessments').select('id').eq('created_by',user.id).gte('created_at',new Date(Date.now()-3600000).toISOString()));
   if(recent.length>=12)throw problem('The hourly assessment limit has been reached. Please try again later.',429);
   const inserted=await db.from('content_work_assessments').insert({queue_id:q,assignment_id:a,fingerprint:c.fingerprint,created_by:user.id,status:'running'}).select('*').single();
   if(inserted.error?.code==='23505')throw problem('An assessment is already running for this task. Check again shortly.',409);
   job=unwrap(inserted);
   const payload=await generate(c.entry,c.sourceDates);
   const latest=await context(client,q,a);if(latest.fingerprint!==c.fingerprint)throw problem('The task changed during assessment. Reopen it and retry; your edits are safe.',409);
   const saved=unwrap(await db.from('content_work_assessments').update({status:'complete',payload}).eq('id',job.id).select('*').single());
   return reply({assessment:saved},201);
  }catch(e){if(job&&db){console.error('Work assessment failed',{stage:e.assessmentStage||'save',type:e.name});await db.from('content_work_assessments').update({status:'failed',error:'Assessment did not complete. Reopen the task and retry.'}).eq('id',job.id);}return fail(e);}}
 };
}
