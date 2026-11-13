import {randomUUID} from 'node:crypto';
import {uuid,DECISIONS,ResearchError} from './contracts.js';
import {hydratePayload} from './storage.js';
import {VALIDATION_VERSION,validationPayload,failedValidation} from './validation.js';
import {pageKey} from './inventory.js';
import {assignmentFingerprint} from './assignment-pool.js';
import {previousDecisions} from './assignment-history.js';
const reply=(value,status=200)=>Response.json(value,{status,headers:{'Cache-Control':'private, no-store'}});
const db=r=>{if(r.error)throw new ResearchError('Assignment storage is unavailable. Your saved progress is safe.',503);return r.data;};
const conflict=r=>{if(r.error?.code==='23505'||!r.error&&!r.data)throw new ResearchError('This validation changed in another tab. Reload saved progress.',409);return db(r);};
const view=run=>{if(!run)return null;const {lease_token,lease_expires_at,...rest}=run;return {...rest,processing:!!lease_token&&Date.parse(lease_expires_at)>Date.now()};};
async function body(request){const reader=request.body?.getReader();if(!reader)throw new ResearchError('Request is missing.');let size=0;const chunks=[];try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>16000){await reader.cancel();throw new ResearchError('Request is too large.',413);}chunks.push(value);}}finally{reader.releaseLock();}try{return JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{throw new ResearchError('Invalid request.');}}
const failure=e=>reply({error:e instanceof ResearchError||[401,403].includes(e.status)?e.message:'Validation could not finish this step. Reload saved progress and retry.'},e.status||503);
export function validationHandlers({access,origin,configured,validate}){return {
 async GET(request){try{
  const {client,role}=await access('read'),params=new URL(request.url).searchParams,id=params.get('id'),source=params.get('run');
  if(id&&!uuid(id)||source&&!uuid(source))throw new ResearchError('Invalid validation.');
  const runs=db(await client.from('research_runs').select('id,created_at,status').eq('status','complete').order('created_at',{ascending:false}).limit(30))||[];
  const sourceId=source||runs[0]?.id;let run=null;
  if(id)run=db(await client.from('research_validations').select('*').eq('id',id).maybeSingle());
  else if(sourceId)run=(db(await client.from('research_validations').select('*').eq('research_run_id',sourceId).order('created_at',{ascending:false}).limit(1))||[])[0]||null;
  if(id&&!run)throw new ResearchError('Validation not found.',404);
  const reviews=run?db(await client.from('research_assignment_reviews').select('*').eq('validation_id',run.id)):[];
  const prior=await previousDecisions(client,run);
  const history=sourceId?db(await client.from('research_validations').select('id,status,created_at,rules_version').eq('research_run_id',run?.research_run_id||sourceId).order('created_at',{ascending:false}).limit(30)):[];
  return reply({runs,sourceId:run?.research_run_id||sourceId,run:view(run),reviews,...prior,history,currentRules:VALIDATION_VERSION,canEdit:['analyst','admin'].includes(role),configured:configured()});
 }catch(e){return failure(e);}},
 async POST(request){try{
  if(request.headers.get('origin')!==new URL(origin()).origin)throw new ResearchError('Make changes from the dashboard.',403);
  const {client}=await access('run'),input=await body(request);
  if(['start','retry','expand'].includes(input.action)){
   if(!uuid(input.runId))throw new ResearchError('Choose a completed research run.');
   if(!configured())throw new ResearchError('The dashboard AI connection is unavailable. Configure it before validating assignments.');
   const existing=(db(await client.from('research_validations').select('*').eq('research_run_id',input.runId).order('created_at',{ascending:false}).limit(1))||[])[0];
   if(existing&&(existing.status==='running'||existing.rules_version===VALIDATION_VERSION&&(input.action==='start'||input.action==='expand'&&existing.payload.expanded)))return reply({run:view(existing)});
   let payload;
   if(input.action==='retry'){
    if(!existing||!existing.payload.assignments.some(a=>a.result?.retryable))throw new ResearchError('There are no failed checks to retry.');
    payload=structuredClone(existing.payload);payload.retriedFrom=existing.id;
    for(const a of payload.assignments)if(a.result?.retryable||existing.rules_version!==VALIDATION_VERSION){a.state='pending';delete a.result;}
   }else{
    const source=db(await client.from('research_runs').select('*').eq('id',input.runId).maybeSingle());
    if(source?.status!=='complete')throw new ResearchError('Choose a completed research run.');
    const hydrated=await hydratePayload(client,source,['results','inventory.pages']);payload=validationPayload(source,hydrated,input.action==='expand');
    if(existing){payload.expandedFrom=existing.id;for(const a of payload.assignments){const old=existing.payload.assignments.find(p=>p.key===a.key);if(existing.rules_version===VALIDATION_VERSION&&old?.result?.verification&&old.result.verification.status!=='Unavailable'&&Date.now()-Date.parse(old.result.validatedAt)<86400000&&assignmentFingerprint({...old,result:null},existing.payload.sourceDates)===assignmentFingerprint({...a,result:null},payload.sourceDates)){a.state='done';a.result=old.result;}}}
    const snapshotId=payload.sourceDates.otterly?.snapshotId;
    const snapshot=snapshotId?await client.from('otterly_snapshots').select('payload').eq('id',snapshotId).maybeSingle():null;
    const report=snapshot&&!snapshot.error?snapshot.data?.payload:null;
    for(const a of payload.assignments){const citation=report?.pages?.find(p=>pageKey(p.url)===a.targetUrl);a.aiEvidence={status:report?'available':'unavailable',citations:citation?.citations??null,url:citation?.url||null,note:'Saved report-wide citations to this target page, not citations attributed to these keywords. A missing page row is not zero.'};}
    if(!payload.assignments.length)throw new ResearchError('This run has no ranked opportunities to validate.');
   }
   const inserted=await client.from('research_validations').insert({research_run_id:input.runId,rules_version:VALIDATION_VERSION,payload}).select('*').single();
   return reply({run:view(conflict(inserted))},201);
  }
  if(input.action==='step'){
   if(!uuid(input.id)||!Number.isInteger(input.version))throw new ResearchError('Invalid validation step.');
   const run=db(await client.from('research_validations').select('*').eq('id',input.id).maybeSingle());if(!run)throw new ResearchError('Validation not found.',404);
   if(run.status==='complete')return reply({run:view(run)});
   if(run.version!==input.version||run.lease_token&&Date.parse(run.lease_expires_at)>Date.now())throw new ResearchError('A check is running in another tab. Reload saved progress shortly.',409);
   if(!configured())throw new ResearchError('The dashboard AI connection is unavailable.');
   const token=randomUUID(),claimed=conflict(await client.from('research_validations').update({lease_token:token,lease_expires_at:new Date(Date.now()+300000).toISOString()}).eq('id',run.id).eq('version',run.version).select('*').maybeSingle());
   const payload=structuredClone(run.payload),pending=payload.assignments.filter(a=>a.state==='pending').slice(0,2);
   await Promise.all(pending.map(async assignment=>{try{assignment.result=await validate(assignment,payload.sourceDates);}catch{assignment.result=failedValidation('This check failed before an assessment was saved. Retry failed checks.',assignment);}assignment.state='done';}));
   const complete=payload.assignments.every(a=>a.state==='done');
   const saved=conflict(await client.from('research_validations').update({payload,status:complete?'complete':'running',lease_token:null,lease_expires_at:null}).eq('id',run.id).eq('version',claimed.version).eq('lease_token',token).select('*').maybeSingle());
   return reply({run:view(saved)});
  }
  if(input.action==='review'){
   if(!uuid(input.id)||!/^[a-f0-9]{24}$/.test(input.key||'')||!DECISIONS.includes(input.decision)||typeof input.reason!=='string'||input.reason.length>2000||!Number.isInteger(input.version)||input.version<0)throw new ResearchError('Choose a valid assignment and decision.');
   const run=db(await client.from('research_validations').select('*').eq('id',input.id).maybeSingle());
   const assignment=run?.payload.assignments.find(a=>a.key===input.key);
   if(run?.status!=='complete'||!assignment)throw new ResearchError('Review a completed assignment.');
   if(input.decision==='Keep'&&(run.rules_version!==VALIDATION_VERSION||assignment.result?.verification?.status!=='Passed'||assignment.result?.readiness!=='Ready for review'))throw new ResearchError('Complete both verification passes and resolve missing evidence before keeping this assignment for planning.');
   const fields={decision:input.decision,reason:input.reason};
   const saved=input.version===0?await client.from('research_assignment_reviews').insert({validation_id:input.id,assignment_key:input.key,...fields}).select('*').single():await client.from('research_assignment_reviews').update(fields).eq('validation_id',input.id).eq('assignment_key',input.key).eq('version',input.version).select('*').maybeSingle();
   return reply({review:conflict(saved)});
  }
  throw new ResearchError('Unsupported validation action.');
 }catch(e){return failure(e);}}
};}
