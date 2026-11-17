import {calendarReview} from './calendar-review.js';
import {repairCalendar} from './repair-calendar.js';
import {focusTargets,applyFocusedDecisions} from './focused-targets.js';
import {finalScopePass,finalScopeSummary,widerScopePass,widerScopeSummary} from './final-scope.js';
import {overlapPairs,currentOverlap,resolveOverlap,applyOverlapResolutions} from './overlap-resolution.js';
import {resolveTarget,targetFingerprint,currentResolution,applyTargetResolutions} from './target-resolution.js';
import {targetResolutionStore} from './target-resolution-store.js';
import {auditProposalPlan} from './proposal-audit.js';
import {enrichPaidPlan,latestPaidSource} from './paid-search.js';
import {revisePaidProposals} from './revise-proposals.js';
import {generateProposals,proposalEdit,publicProposalPlan} from './proposals.js';
import {hydratePayload} from './storage.js';
import {uuid} from './contracts.js';
import {generateCalendar,changeCalendar} from './demo-calendar.js';
const reply=(x,status=200)=>Response.json(x,{status,headers:{'Cache-Control':'private, no-store'}});
const read=r=>{if(r.error){console.error('Proposal storage failed',{code:r.error.code||'transport',message:r.error.message?.slice(0,220)});throw Error('Proposal storage is unavailable. Please retry.');}return r.data;};
async function reviewedPlan(client,plan,paid,includeOverlaps=true){
 const visible=enrichPaidPlan(publicProposalPlan(plan),paid);if(!plan)return visible;
 const run=read(await client.from('research_runs').select('*').eq('id',plan.research_run_id).maybeSingle());
 let inventory=[];try{inventory=(await hydratePayload(client,run||{payload:{}},['inventory'])).inventory?.pages||[];}catch{/* Show unavailable targeting flags while keeping the saved plan usable. */}
 const records=read(await client.from('proposal_target_resolutions').select('*').eq('plan_id',plan.id))||[];
 const targeted=applyTargetResolutions(auditProposalPlan(visible,inventory,run||{}),records);
 const checked=applyFocusedDecisions(includeOverlaps?applyOverlapResolutions(targeted,records):targeted);
 return {...checked,calendarReview:calendarReview(checked),finalScopeSummary:finalScopeSummary(checked),widerScopeSummary:widerScopeSummary(checked)};
}
export function proposalHandlers({access,origin,resolutionStore=targetResolutionStore,pageReader}){
 const fail=e=>{console.error('Proposal operation failed',{name:e.name,code:e.code||null,message:e.message?.slice(0,220),frames:e.stack?.split('\n').slice(1,4)});return reply({error:[400,403,404,409,422].includes(e.status)?e.message:'Proposals could not be saved or loaded. Your previous plans are unchanged.'},e.status||503);};
 return {
 async GET(request){try{
  const {client,role}=await access('read'),id=new URL(request.url).searchParams.get('plan');if(id&&!uuid(id))throw Object.assign(Error('Invalid plan.'),{status:400});
  const history=read(await client.from('proposed_content_plans').select('id,created_at,research_run_id').order('created_at',{ascending:false}).limit(30))||[];
  const selected=id||history[0]?.id,plan=selected?read(await client.from('proposed_content_plans').select('*').eq('id',selected).maybeSingle()):null;
  if(id&&!plan)throw Object.assign(Error('Plan not found.'),{status:404});
  const runs=read(await client.from('research_runs').select('id,created_at').eq('status','complete').order('created_at',{ascending:false}).limit(30))||[];
  return reply({plan:await reviewedPlan(client,plan,await latestPaidSource(client)),history,runs,canEdit:['analyst','admin'].includes(role)});
 }catch(e){return fail(e);}},
 async POST(request){try{
  if(request.headers.get('origin')!==new URL(origin()).origin)throw Object.assign(Error('Make changes from the dashboard.'),{status:403});
  const {client}=await access('run');
  const paid=await latestPaidSource(client);
  const reader=request.body?.getReader();if(!reader)throw Object.assign(Error('Missing request.'),{status:400});let size=0;const chunks=[];
  try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>15000){await reader.cancel();throw Object.assign(Error('Request too large.'),{status:400});}chunks.push(value);}}finally{reader.releaseLock();}
  let input;try{input=JSON.parse(Buffer.concat(chunks).toString());}catch{throw Object.assign(Error('Invalid request.'),{status:400});}
  if(['repair-calendar','focused-targets','final-scope','wider-scope','undo-repair'].includes(input.action)){
   if(!uuid(input.planId)||!Number.isInteger(input.version))throw Object.assign(Error('Invalid plan version.'),{status:422});
   const original=read(await client.from('proposed_content_plans').select('*').eq('id',input.planId).maybeSingle());
   if(!original)throw Object.assign(Error('Plan not found.'),{status:404});
   if(original.version!==input.version)throw Object.assign(Error('This plan changed. Reload before repairing.'),{status:409});
   const undo=input.action==='undo-repair';let repair={changes:[],records:[]};
   const entry=undo?original.payload.repairHistory?.find(h=>h.id===input.repairId&&!h.undoneAt):null;
   if(undo&&!entry)throw Object.assign(Error('Choose an available repair to undo.'),{status:422});
   if(!undo){
    const run=read(await client.from('research_runs').select('*').eq('id',original.research_run_id).maybeSingle());
    const source=await hydratePayload(client,run,['inventory','evidence','results']);
    repair=await (input.action==='wider-scope'?widerScopePass:input.action==='final-scope'?finalScopePass:input.action==='focused-targets'?focusTargets:repairCalendar)(original,await reviewedPlan(client,original,paid),source,paid,run.settings,pageReader);
    if(!repair.changes.length)return reply({plan:await reviewedPlan(client,original,paid),repairSummary:{changed:0,protected:repair.protectedCount,message:'No further evidence-supported repairs found in this pass. Existing assignments and dates are unchanged.'}});
   }
   if(input.action==='wider-scope'&&repair.changes.length){const proposed={...original,payload:{...original.payload,items:original.payload.items.map(i=>repair.changes.find(c=>c.id===i.id)?.item||i)}};const reviewed=await reviewedPlan(client,proposed,paid);repair.changes.at(-1).evidence.finalCalendarReview=reviewed.calendarReview;}
   const result=await client.rpc('repair_calendar_plan',{source_id:original.id,expected_version:input.version,changes:repair.changes,undo_id:undo?input.repairId:null}).single();
   if(result.error?.code==='40001')throw Object.assign(Error('The plan changed, or undo has no unchanged assignments left to restore. Reload the saved plan.'),{status:409});
   const saved=read(result);let warning;
   try{
    const existing=read(await client.from('proposal_target_resolutions').select('*').eq('plan_id',original.id))||[];
    const prior=undo?read(await client.from('proposal_target_resolutions').select('*').eq('plan_id',entry.sourcePlanId))||[]:[];
    const rows=[...new Map([...existing,...prior,...repair.records].map(r=>[r.item_id,{...r,plan_id:saved.id}])).values()];
    if(rows.length)read(await resolutionStore().from('proposal_target_resolutions').upsert(rows,{onConflict:'plan_id,item_id'}));
   }catch{warning='Assignments and undo history are saved. Some verification evidence could not be copied; rerun the page checks before relying on cleared flags.';}
   return reply({plan:await reviewedPlan(client,saved,paid),warning,repairSummary:undo?{message:'Undo saved as a new plan. Later manual edits and current dates are preserved.'}:['focused-targets','final-scope','wider-scope'].includes(input.action)?{changed:repair.changes.length,remaining:repair.remaining,message:`${repair.changes.length} targeting decisions saved with evidence and undo. ${repair.remaining} awaiting focused review. Manual edits and dates preserved; all work remains tentative.`}:{changed:repair.changes.length,protected:repair.protectedCount,message:`${repair.changes.length} assignments repaired. Manual edits and dates preserved; all work remains tentative.`}},201);
  }
  if(input.action==='resolve-overlaps'){
   if(!uuid(input.planId)||!Number.isInteger(input.version))throw Object.assign(Error('Invalid plan version.'),{status:422});
   const original=read(await client.from('proposed_content_plans').select('*').eq('id',input.planId).maybeSingle());
   if(!original)throw Object.assign(Error('Plan not found.'),{status:404});
   if(original.version!==input.version)throw Object.assign(Error('This plan changed. Reload before continuing.'),{status:409});
   const reviewed=await reviewedPlan(client,original,paid,false),pairs=overlapPairs(reviewed);
   const records=read(await client.from('proposal_target_resolutions').select('*').eq('plan_id',original.id))||[];
   if(input.pairKey&&!pairs.some(p=>p.key===input.pairKey))throw Object.assign(Error('Unknown related assignments.'),{status:422});
   const pending=pairs.filter(p=>input.pairKey?p.key===input.pairKey:!currentOverlap(p,records.find(r=>r.item_id===p.key))).slice(0,2);
   if(pending.length){
    const results=await Promise.all(pending.map(async p=>({plan_id:original.id,item_id:p.key,fingerprint:p.fingerprint,result:await resolveOverlap(p,pageReader)})));
    const latest=read(await client.from('proposed_content_plans').select('*').eq('id',original.id).maybeSingle());
    if(latest?.version!==input.version)throw Object.assign(Error('This plan changed during verification. Reload before continuing.'),{status:409});
    read(await resolutionStore().from('proposal_target_resolutions').upsert(results,{onConflict:'plan_id,item_id'}));
   }
   return reply({plan:await reviewedPlan(client,original,paid),processed:pending.length});
  }
  if(input.action==='resolve-targets'){
   if(!uuid(input.planId)||!Number.isInteger(input.version))throw Object.assign(Error('Invalid plan version.'),{status:422});
   const original=read(await client.from('proposed_content_plans').select('*').eq('id',input.planId).maybeSingle());
   if(!original)throw Object.assign(Error('Plan not found.'),{status:404});
   if(original.version!==input.version)throw Object.assign(Error('This plan changed. Reload before continuing the resolution pass.'),{status:409});
   const reviewed=await reviewedPlan(client,original,paid);
   const records=read(await client.from('proposal_target_resolutions').select('*').eq('plan_id',original.id))||[];
   if(input.itemId&&!reviewed.payload.items.some(i=>i.id===input.itemId))throw Object.assign(Error('Unknown assignment.'),{status:422});
   const pending=reviewed.payload.items.filter(i=>input.itemId?i.id===input.itemId:i.quality.flags.length&&!currentResolution(i,records.find(r=>r.item_id===i.id))).slice(0,2);
   if(pending.length){
    const run=read(await client.from('research_runs').select('*').eq('id',original.research_run_id).maybeSingle());
    const inventory=(await hydratePayload(client,run,['inventory'])).inventory?.pages||[];
    const store=resolutionStore();
    const results=await Promise.all(pending.map(async i=>({plan_id:original.id,item_id:i.id,fingerprint:targetFingerprint(i),result:await resolveTarget(i,inventory,pageReader)})));
    const latest=read(await client.from('proposed_content_plans').select('*').eq('id',original.id).maybeSingle());
    if(latest.version!==input.version)throw Object.assign(Error('This plan changed during verification. Reload before continuing.'),{status:409});
    read(await store.from('proposal_target_resolutions').upsert(results,{onConflict:'plan_id,item_id'}));
   }
   return reply({plan:await reviewedPlan(client,original,paid),processed:pending.length});
  }
  if(input.action==='generate'){

   if(!uuid(input.runId))throw Object.assign(Error('Choose completed research first.'),{status:422});
   const run=read(await client.from('research_runs').select('*').eq('id',input.runId).maybeSingle());if(run?.status!=='complete')throw Object.assign(Error('Completed research is required.'),{status:422});
   const source=await hydratePayload(client,run,['results','evidence','inventory']);
   const payload=generateProposals(source,run.settings);
   const plan=read(await client.from('proposed_content_plans').insert({research_run_id:run.id,payload}).select('*').single());return reply({plan:await reviewedPlan(client,plan,paid)},201);
  }
  if(input.action==='revise-paid'){
   if(!uuid(input.planId)||!Number.isInteger(input.version))throw Object.assign(Error('Invalid plan version.'),{status:422});
   const original=read(await client.from('proposed_content_plans').select('*').eq('id',input.planId).maybeSingle());
   if(!original)throw Object.assign(Error('Plan not found.'),{status:404});
   if(original.version!==input.version)throw Object.assign(Error('This plan changed in another tab. Reload before revising.'),{status:409});
   const run=read(await client.from('research_runs').select('*').eq('id',original.research_run_id).maybeSingle());
   if(run?.status!=='complete')throw Object.assign(Error('Completed research is required.'),{status:422});
   const source=await hydratePayload(client,run,['inventory']);
   const revision=revisePaidProposals(original,paid,source.inventory?.pages||[],run.settings);
   const result=await client.rpc('revise_paid_proposal_plan',{source_id:original.id,expected_version:input.version,revised_payload:revision.payload}).single();
   if(result.error?.code==='40001')throw Object.assign(Error('This plan changed in another tab. Reload before revising.'),{status:409});
   const plan=read(result);return reply({plan:await reviewedPlan(client,plan,paid)},201);
  }
  if(['edit','calendar-generate','calendar-move','calendar-lock'].includes(input.action)){
   if(!uuid(input.planId)||!Number.isInteger(input.version))throw Object.assign(Error('Invalid plan version.'),{status:422});
   const plan=read(await client.from('proposed_content_plans').select('*').eq('id',input.planId).maybeSingle());if(!plan)throw Object.assign(Error('Plan not found.'),{status:404});
   let update;
   if(input.action==='edit'){
    let fields;try{fields=proposalEdit(input,plan.payload.items);}catch(e){throw Object.assign(e,{status:422});}
    update={edits:{...plan.edits,[input.itemId]:{...plan.edits[input.itemId],...fields}}};
   }else{
    const items=publicProposalPlan(plan).payload.items;
    update={calendar:input.action==='calendar-generate'?generateCalendar(items,plan.calendar):changeCalendar(plan.calendar,items,input)};
   }
   const saved=read(await client.from('proposed_content_plans').update(update).eq('id',plan.id).eq('version',input.version).select('*').maybeSingle());
   if(!saved)throw Object.assign(Error('This plan changed in another tab. Reload before saving.'),{status:409});return reply({plan:await reviewedPlan(client,saved,paid)});
  }
  throw Object.assign(Error('Unsupported proposal action.'),{status:400});
 }catch(e){return fail(e);}}
 };}
