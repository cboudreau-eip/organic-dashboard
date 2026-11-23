import test from 'node:test';import assert from 'node:assert/strict';
import {assessmentFingerprint,assessmentCurrent,checkedAssessment,assessmentBrief,reviewedAssessment,assessmentReviewSystem} from '../lib/work-queue/assessment.js';
import {assessmentHandlers} from '../lib/work-queue/assessment-handler.js';
const id='11111111-1111-4111-8111-111111111111';
const entry={assignment_id:'a',planned_date:'2027-01-05',status:'In progress',brief:'Keep my edits',snapshot:{id:'a',title:'Switch plans',targetUrl:'https://www.medicarefaq.com/faqs/switch',terms:['without underwriting']}};
const pages=[{id:'target',url:entry.snapshot.targetUrl,kind:'target',passages:[{id:'targetp1',text:'Enrollment periods and underwriting are distinct.'}]},{id:'official',url:'https://www.medicare.gov/medigap',kind:'official',passages:[{id:'officialp1',text:'Official protection conditions.'}]}];
const output={summary:'Clarify eligibility.',changes:[{section:'Enrollment',change:'Separate enrollment from protections.',why:'The distinction is unclear.',evidenceIds:['targetp1'],needsVerification:false}],preserve:['Keep the comparison'],outline:['Direct answer'],checks:['Verify state rules'],links:[]};
test('independent review replaces unsafe draft wording and never falls back when review fails',async()=>{
 const draft={...output,summary:'Initial draft'},corrected={...output,summary:'Separate plan changes from guaranteed issue eligibility.'};let calls=0;
 const result=await reviewedAssessment({assignment:entry.snapshot},pages,async(system,input)=>{calls++;if(calls===1)return draft;assert.equal(system,assessmentReviewSystem);assert.equal(input.proposal,draft);return corrected;});
 assert.equal(calls,2);assert.equal(result.summary,corrected.summary);
 calls=0;await assert.rejects(reviewedAssessment({},pages,async()=>{if(++calls===1)return draft;throw Error('Reviewer unavailable');}),/Reviewer unavailable/);
 calls=0;await assert.rejects(reviewedAssessment({},pages,async()=>++calls===1?draft:{...corrected,changes:[{...corrected.changes[0],evidenceIds:['invented']}]}),/Unknown source/);
 calls=0;const repaired=await reviewedAssessment({},pages,async(system,input)=>{calls++;if(calls===1)return {...draft,summary:'x'.repeat(1600)};if(calls===2)return {...corrected,changes:[{...corrected.changes[0],evidenceIds:['invented']}]};assert.match(input.validationFeedback,/structural validation/);return corrected;});assert.equal(calls,3);assert.equal(repaired.summary,corrected.summary);
});
test('assessment references are traceable, unknown links rejected, and fingerprints preserve dates/status independence',()=>{
 const r=checkedAssessment(output,pages);assert.equal(r.changes[0].needsVerification,true);assert.equal(r.changes[0].evidence[0].text,pages[0].passages[0].text);assert.match(assessmentBrief(r,entry.snapshot.targetUrl),/Verify state rules/);
 assert.throws(()=>checkedAssessment({...output,links:[{sourceId:'invented',reason:'Link'}]},pages));assert.throws(()=>checkedAssessment({...output,changes:[{...output.changes[0],evidenceIds:['fake']}]},pages));
 const unresolved=checkedAssessment({...output,changes:[{...output.changes[0],evidenceIds:[]}]},pages);assert.equal(unresolved.changes[0].needsVerification,true);assert.match(assessmentBrief(unresolved,entry.snapshot.targetUrl),/No supporting passage retrieved/);
 const qualified=checkedAssessment({...output,changes:[{...output.changes[0],evidenceIds:Array(6).fill('targetp1')}]},pages);assert.equal(qualified.changes[0].evidence.length,1);
 const f=assessmentFingerprint(entry,{});assert.equal(f,assessmentFingerprint({...entry,status:'Completed',planned_date:'2027-02-01'},{}));assert.notEqual(f,assessmentFingerprint({...entry,brief:'Changed'},{}));assert.notEqual(f,assessmentFingerprint(entry,{gsc:{fetchedAt:'new'}}));
 assert.equal(assessmentCurrent({status:'complete',fingerprint:f,created_at:new Date().toISOString()},f),true);assert.equal(assessmentCurrent({status:'complete',fingerprint:f,created_at:'2020-01-01'},f),false);
});
function fixture({role='analyst',generate,existing=[]}={}){
 const state={queue:{id,source_plan_id:id,entries:[structuredClone(entry)]},plan:{payload:{items:[structuredClone(entry.snapshot)],sourceDates:{}},edits:{}},rows:existing,writes:[],generations:0};
 const client={from(table){let op='select',values,filters=[];const rows=()=>table==='content_work_pilots'?[state.queue]:table==='proposed_content_plans'?[state.plan]:state.rows;
  const chain={select(){return chain;},eq(k,v){filters.push(r=>r[k]===v);return chain;},lt(k,v){filters.push(r=>r[k]<v);return chain;},gte(k,v){filters.push(r=>r[k]>=v);return chain;},order(){return chain;},limit(){return chain;},insert(v){op='insert';values=v;return chain;},update(v){op='update';values=v;return chain;},maybeSingle:()=>exec(true),single:()=>exec(true),then:(a,b)=>exec(false).then(a,b)};
  async function exec(single){let result;if(op==='insert'){state.writes.push(table);result={...values,id:'job',created_at:new Date().toISOString()};state.rows.unshift(result);return {data:result};}
   result=rows().filter(r=>table!=='content_work_assessments'||filters.every(f=>f(r)));if(op==='update'){state.writes.push(table);result.forEach(r=>Object.assign(r,values));}return {data:single?result[0]||null:result};}return chain;
 }};
 const h=assessmentHandlers({access:async action=>{if(action==='run'&&role==='viewer')throw Object.assign(Error('Forbidden'),{status:403});return {client,user:{id},role};},origin:()=> 'https://test.example',configured:()=>true,store:()=>client,generate:async(...args)=>{state.generations++;return generate?generate(state,...args):{brief:'Generated',result:output};}});
 const post=(extra={},origin='https://test.example')=>h.POST(new Request('https://test.example/api/content-work/assessment',{method:'POST',headers:{origin,'Content-Type':'application/json'},body:JSON.stringify({queueId:id,assignmentId:'a',fingerprint:assessmentFingerprint(state.queue.entries[0],{}),...extra})}));return {state,h,post};
}
test('generation saves only separate assessment rows, caches success and denies forged inputs/viewers',async()=>{
 const f=fixture(),before=JSON.stringify(f.state.queue);assert.equal((await f.post()).status,201);assert.equal(JSON.stringify(f.state.queue),before);assert.ok(f.state.writes.every(t=>t==='content_work_assessments'));assert.equal(f.state.rows[0].status,'complete');
 assert.equal((await f.post()).status,200);assert.equal(f.state.generations,1);assert.equal((await f.post({targetUrl:'https://evil.com'})).status,422);assert.equal((await f.post({},'https://evil.com')).status,403);assert.equal((await fixture({role:'viewer'}).post()).status,403);assert.equal((await f.post({fingerprint:'stale'})).status,409);
});
test('failed generation and edits during assessment never replace saved instructions',async()=>{
 const f=fixture({generate:async()=>{throw Error('Source down');}});assert.equal((await f.post()).status,503);assert.equal(f.state.rows[0].status,'failed');assert.equal(f.state.queue.entries[0].brief,'Keep my edits');
 const g=fixture({generate:async state=>{state.queue.entries[0].brief='New user edits';return {};}});assert.equal((await g.post()).status,409);assert.equal(g.state.rows[0].status,'failed');assert.equal(g.state.queue.entries[0].brief,'New user edits');
});
