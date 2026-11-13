import {randomUUID} from 'node:crypto';
import {uuid,DECISIONS,ResearchError} from './contracts.js';
import {hydratePayload} from './storage.js';
import {VALIDATION_VERSION,validationPayload,failedValidation,consolidateAssignments} from './validation.js';
import {pageKey} from './inventory.js';
import {assignmentFingerprint,selectPool,enrichCandidates} from './assignment-pool.js';
import {previousDecisions} from './assignment-history.js';
import {RESOLUTION_VERSION,coverageBlockers} from './resolution.js';
import {resolutionCandidates,failedResolution} from './resolution-sources.js';
import {auditCandidates,DECISION_AUDIT_VERSION} from './decision-audit.js';
import {separateTasks,matchPages,REFINEMENT_VERSION} from './task-refinement.js';
const reply=(value,status=200)=>Response.json(value,{status,headers:{'Cache-Control':'private, no-store'}});
const db=r=>{if(r.error)throw new ResearchError('Assignment storage is unavailable. Your saved progress is safe.',503);return r.data;};
const conflict=r=>{if(r.error?.code==='23505'||!r.error&&!r.data)throw new ResearchError('This validation changed in another tab. Reload saved progress.',409);return db(r);};
const view=run=>{if(!run)return null;const {lease_token,lease_expires_at,...rest}=run;return {...rest,processing:!!lease_token&&Date.parse(lease_expires_at)>Date.now()};};
async function body(request){const reader=request.body?.getReader();if(!reader)throw new ResearchError('Request is missing.');let size=0;const chunks=[];try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>16000){await reader.cancel();throw new ResearchError('Request is too large.',413);}chunks.push(value);}}finally{reader.releaseLock();}try{return JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{throw new ResearchError('Invalid request.');}}
const failure=e=>reply({error:e instanceof ResearchError||[401,403].includes(e.status)?e.message:'Validation could not finish this step. Reload saved progress and retry.'},e.status||503);
export function validationHandlers({access,origin,configured,validate,resolve}){return {
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
  if(['start','retry','expand','resolve','advance','audit','refine'].includes(input.action)){
   if(!uuid(input.runId))throw new ResearchError('Choose a completed research run.');
   if(!configured())throw new ResearchError('The dashboard AI connection is unavailable. Configure it before validating assignments.');
   const existing=(db(await client.from('research_validations').select('*').eq('research_run_id',input.runId).order('created_at',{ascending:false}).limit(1))||[])[0];
   if(existing&&(existing.status==='running'||existing.rules_version===VALIDATION_VERSION&&(input.action==='start'||input.action==='expand'&&existing.payload.expanded||input.action==='resolve'&&existing.payload.resolution?.version===RESOLUTION_VERSION)))return reply({run:view(existing)});
   let payload;
   if(input.action==='advance'&&existing?.payload.sourceVerificationVersion==='primary-v1')return reply({run:view(existing)});
   if(input.action==='refine'){
    if(!existing||existing.status!=='complete'||existing.id!==input.id||existing.version!==input.version)throw new ResearchError('Load the latest completed validation.',409);
    if(existing.payload.refinement?.version===REFINEMENT_VERSION)return reply({run:view(existing)});
    const source=db(await client.from('research_runs').select('*').eq('id',input.runId).maybeSingle());if(source?.status!=='complete')throw new ResearchError('Source research unavailable.');
    const hydrated=await hydratePayload(client,source,['results','inventory.pages']);payload=structuredClone(existing.payload);
    if(payload.refinement){
     const changed=[];
     for(const a of payload.assignments.filter(a=>a.rematch)){
      const matches=matchPages(a.topics[0],hydrated.inventory.pages,a.originalTarget),urls=matches.map(p=>p.url);
      if(JSON.stringify(urls)!==JSON.stringify(a.resolutionUrls)){a.state='pending';a.result=null;changed.push(a.key);}
      a.pageMatches=matches;a.resolutionUrls=urls;a.candidateUrls=urls;
     }
     payload.refinement={...payload.refinement,version:REFINEMENT_VERSION,keys:changed,rematchedFrom:existing.id};
     payload.resolution={version:RESOLUTION_VERSION,selected:changed.length,reused:0,startedAt:new Date().toISOString()};
    }else{
    const seen=new Set(payload.assignments.flatMap(a=>a.topics.map(t=>t.key)));
    const remaining=hydrated.results.items.map((item,i)=>({...item,originalRank:i+1})).filter(item=>!seen.has(item.key));
    const next=selectPool(remaining,Number(source.settings?.start?.slice(0,4))||null).items.slice(0,20);
    const added=enrichCandidates(consolidateAssignments(next,20),hydrated.inventory.pages,!!hydrated.inventory.complete);
    const held=payload.assignments.filter(a=>a.result?.readiness==='Needs research');
    const tasks=[...held,...added].flatMap(a=>separateTasks(a,hydrated.inventory.pages));
    payload.assignments=[...payload.assignments.filter(a=>a.result?.readiness!=='Needs research'),...tasks];
    payload.selectedCount+=next.length;
    payload.refinement={version:REFINEMENT_VERSION,from:existing.id,held:held.length,addedTopics:next.length,keys:tasks.map(a=>a.key),startedAt:new Date().toISOString()};
    payload.resolution={version:RESOLUTION_VERSION,selected:tasks.length,reused:0,startedAt:new Date().toISOString()};
    }
   }else if(input.action==='audit'){
    if(!existing||existing.status!=='complete'||existing.id!==input.id||existing.version!==input.version)throw new ResearchError('Load the latest completed validation.',409);
    if(existing.payload.decisionAudit?.version===DECISION_AUDIT_VERSION)return reply({run:view(existing)});
    const source=db(await client.from('research_runs').select('*').eq('id',input.runId).maybeSingle());if(source?.status!=='complete')throw new ResearchError('Source research unavailable.');
    const hydrated=await hydratePayload(client,source,['inventory.pages']);payload=structuredClone(existing.payload);
    const selected=payload.decisionAudit?.keys?payload.assignments.filter(a=>payload.decisionAudit.keys.includes(a.key)):auditCandidates(payload.assignments),keys=selected.map(a=>a.key);
    payload.decisionAudit={version:DECISION_AUDIT_VERSION,from:existing.id,keys,startedAt:new Date().toISOString()};
    payload.resolution={version:RESOLUTION_VERSION,selected:keys.length,reused:0,startedAt:new Date().toISOString()};
    for(const a of selected){a.state='pending';a.primaryVerification=true;a.resolutionUrls=resolutionCandidates(a,hydrated.inventory?.pages||[]);}
   }else if(input.action==='advance'){
    if(!existing||existing.status!=='complete'||existing.id!==input.id||existing.version!==input.version)throw new ResearchError('Load the latest completed validation.',409);
    const source=db(await client.from('research_runs').select('*').eq('id',input.runId).maybeSingle());if(source?.status!=='complete')throw new ResearchError('Source research unavailable.');
    const hydrated=await hydratePayload(client,source,['results','inventory.pages']);payload=structuredClone(existing.payload);payload.sourceVerificationVersion='primary-v1';payload.resolvedFrom=existing.id;
    const seen=new Set(payload.assignments.flatMap(a=>a.topics.map(t=>t.key))),targets=new Set(payload.assignments.map(a=>a.result?.verifiedTarget||a.targetUrl).filter(Boolean));
    const remaining=hydrated.results.items.map((item,i)=>({...item,originalRank:i+1})).filter(item=>!seen.has(item.key)&&!targets.has(pageKey(item.targetUrl)));
    const selected=selectPool(remaining,Number(source.settings?.start?.slice(0,4))||null).items.slice(0,20);
    const added=enrichCandidates(consolidateAssignments(selected,20),hydrated.inventory.pages,!!hydrated.inventory.complete);
    for(const a of added)a.result=failedValidation('New ranked opportunity awaiting primary-source research.',a);
    payload.assignments.push(...added);payload.selectedCount+=selected.length;payload.addedCount=added.length;payload.addedTopics=selected.length;
    const held=payload.assignments.filter(a=>a.result?.readiness==='Needs research');payload.resolution={version:RESOLUTION_VERSION,selected:held.length,reused:0,startedAt:new Date().toISOString()};
    for(const a of held){a.state='pending';a.primaryVerification=true;a.resolutionUrls=resolutionCandidates(a,hydrated.inventory.pages);}
   }else if(input.action==='resolve'){
    if(!resolve||!existing||existing.status!=='complete'||existing.id!==input.id||existing.version!==input.version)throw new ResearchError('Load the latest completed validation before resolving research.',409);
    const needsResolution=a=>a.result?.readiness==='Needs research'||a.result?.resolution&&a.result.resolution.version!==RESOLUTION_VERSION;
    if(!existing.payload.assignments.some(needsResolution))throw new ResearchError('No research blockers remain in this validation.');
    const source=db(await client.from('research_runs').select('*').eq('id',input.runId).maybeSingle());
    if(source?.status!=='complete')throw new ResearchError('The source research is unavailable.');
    const hydrated=await hydratePayload(client,source,['inventory.pages']);
    payload=structuredClone(existing.payload);payload.resolvedFrom=existing.id;
    payload.resolution={version:RESOLUTION_VERSION,selected:payload.assignments.filter(needsResolution).length,reused:0,startedAt:new Date().toISOString()};
    for(const a of payload.assignments)if(needsResolution(a)){
     const issues=coverageBlockers(a);
     if(a.result?.resolution&&a.result.readiness==='No change suggested'&&!issues.length){a.result.resolution={...a.result.resolution,version:RESOLUTION_VERSION,reusedFrom:existing.id,scopeCheckedAt:new Date().toISOString()};payload.resolution.reused++;continue;}
     if(issues.length&&a.result.resolution)a.result={...a.result,readiness:'Needs research',resolution:{...a.result.resolution,blockers:[...a.result.resolution.blockers,...issues]}};
     a.state='pending';a.resolutionUrls=resolutionCandidates(a,hydrated.inventory?.pages||[]);
    }
   }else if(input.action==='retry'){
    if(!existing||!existing.payload.assignments.some(a=>a.result?.retryable))throw new ResearchError('There are no failed checks to retry.');
    payload=structuredClone(existing.payload);payload.retriedFrom=existing.id;
    for(const a of payload.assignments)if(a.result?.retryable||existing.rules_version!==VALIDATION_VERSION){a.state='pending';if(!payload.resolution)delete a.result;}
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
   const token=randomUUID(),claimed=conflict(await client.from('research_validations').update({lease_token:token,lease_expires_at:new Date(Date.now()+360000).toISOString()}).eq('id',run.id).eq('version',run.version).select('*').maybeSingle());
   const payload=structuredClone(run.payload);
   if(payload.refinement&&payload.refinement.version!==REFINEMENT_VERSION){
    const source=db(await client.from('research_runs').select('*').eq('id',run.research_run_id).maybeSingle());
    const hydrated=await hydratePayload(client,source,['inventory.pages']);
    for(const a of payload.assignments.filter(a=>a.rematch)){
     const matches=matchPages(a.topics[0],hydrated.inventory.pages,a.originalTarget),urls=matches.map(p=>p.url);
     if(JSON.stringify(urls)!==JSON.stringify(a.resolutionUrls)){a.state='pending';a.result=null;}
     a.pageMatches=matches;a.resolutionUrls=urls;a.candidateUrls=urls;
    }
    payload.refinement.version=REFINEMENT_VERSION;
   }
   const pending=payload.assignments.filter(a=>a.state==='pending').slice(0,2);
   await Promise.all(pending.map(async assignment=>{try{assignment.result=await (payload.resolution?resolve:validate)(assignment,payload.sourceDates);}catch{assignment.result=payload.resolution?failedResolution(assignment,'proposal'):failedValidation('This check failed before an assessment was saved. Retry failed checks.',assignment);}assignment.state='done';}));
   const complete=payload.assignments.every(a=>a.state==='done');
   if(complete&&payload.resolution){
    const targets=new Map();for(const a of payload.assignments)if(a.result?.readiness==='Ready for review'){const target=a.result.verifiedTarget||a.targetUrl;targets.set(target,[...(targets.get(target)||[]),a]);}
    for(const group of targets.values())if(group.length>1)for(const a of group){
     const siblings=group.every(b=>b.parentAssignment?.key&&b.parentAssignment.key===a.parentAssignment?.key);
     const tasks=group.flatMap(b=>b.result.findings.filter(f=>f.judgement==='improve').map(f=>f.task.trim().toLowerCase()));
     if(siblings&&new Set(tasks).size===tasks.length)continue;
     const question='Other assignments propose changes to this same page. Review and combine their scope before accepting duplicate work.';a.result={...a.result,readiness:'Needs research',checks:[...a.result.checks,question],verification:{...a.result.verification,status:'Needs research'},resolution:{...a.result.resolution,blockers:[...(a.result.resolution?.blockers||[]),{code:'target',question}]}};}
   }
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
