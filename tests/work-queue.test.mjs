import test from 'node:test';import assert from 'node:assert/strict';
import {workQueueHandlers} from '../lib/work-queue/handlers.js';
import {workTitle,exportWorkMarkdown} from '../lib/work-queue/model.js';
const id='11111111-1111-4111-8111-111111111111';
const entry={assignment_id:'a',planned_date:'2027-01-01',title_edited:true,owner:'Editor',status:'Ready',brief:'## My brief\nPreserve this text and ```markers```.',snapshot:{title:'My edited title',action:'Original action',terms:['plan g'],evidence:{gsc:[{keys:['plan g','https://www.medicarefaq.com/plan-g'],impressions:23}]}}};
const queue={id,version:2,source_plan_id:id,week_start:'2027-01-01',entries:[entry],sourceDates:{gsc:{period:{start:'2026-10-01',end:'2026-10-31'}}}};
test('Markdown uses saved brief, status, edited title, dates and source evidence without mutation',()=>{
 const before=structuredClone(queue),md=exportWorkMarkdown(queue);assert.equal(workTitle(entry),'My edited title');
 assert.ok(!md.includes('- Owner:'));
 for(const text of ['My edited title','Work status: To do','2027-01-01',entry.brief,'23','2026-10-01','no newly drafted article'])assert.ok(md.includes(text),text);
 assert.deepEqual(queue,before);assert.throws(()=>exportWorkMarkdown(queue,'missing'),/Choose/);
});
function fixture(role='analyst',rpcError=null){
 const calls=[];const client={from:table=>{const chain={select:()=>chain,order:()=>chain,limit:()=>chain,eq:()=>chain,maybeSingle:async()=>({data:table==='content_work_pilots'?queue:{id,version:1,sourceDates:{}}})};return chain;},rpc:(name,input)=>{calls.push({name,input});return {single:async()=>({data:queue,error:rpcError})};}};
 return {calls,h:workQueueHandlers({origin:()=> 'https://dashboard.example',access:async action=>{if(role==='viewer'&&action==='run')throw Object.assign(Error('Forbidden'),{status:403});return {client,role};}})};
}
const req=(input,origin='https://dashboard.example')=>new Request('https://dashboard.example/api/content-work',{method:'POST',headers:{origin},body:JSON.stringify(input)});
test('queue handlers enforce role, origin, versions and field limits and never write the calendar',async()=>{
 const {h,calls}=fixture();assert.equal((await h.GET()).status,200);
 const input={action:'save',queueId:id,version:2,assignmentId:'a',owner:'Editor',status:'Review',brief:'Saved directions'};
 assert.equal((await h.POST(req(input))).status,201);assert.equal(calls[0].name,'save_content_work_task');assert.equal(calls[0].input.work_brief,'Saved directions');
 assert.equal((await h.POST(req({...input,planned_date:'2027-02-01'}))).status,422);assert.equal((await h.POST(req({...input,brief:'x'.repeat(20001)}))).status,422);
 assert.equal((await h.POST(req(input,'https://evil.example'))).status,403);assert.equal((await fixture('viewer').h.POST(req(input))).status,403);
 assert.equal((await fixture('analyst',{code:'40001'}).h.POST(req(input))).status,409);
 assert.equal((await h.POST(req({action:'start',planId:id,version:1}))).status,201);assert.equal(calls[1].name,'start_content_work_pilot');
});

test('three workflow labels map to existing storage and preserve legacy entries',async()=>{
 const {WORK_STATUSES,workStage,storedWorkStatus,filterWork}=await import('../lib/work-queue/model.js');
 assert.deepEqual(WORK_STATUSES,['To do','In progress','Completed']);
 const entries=['Tentative','Ready','In progress','Review','Published'].map((status,i)=>({...entry,status,assignment_id:String(i)}));
 const before=JSON.stringify(entries);
 assert.deepEqual(entries.map(e=>workStage(e.status)),['To do','To do','In progress','In progress','Completed']);
 assert.equal(filterWork(entries,{status:'To do'}).length,2);assert.equal(filterWork(entries,{status:'In progress'}).length,2);assert.equal(filterWork(entries,{status:'Completed'}).length,1);
 assert.equal(storedWorkStatus('Ready'),'Ready');assert.equal(storedWorkStatus('Review'),'Review');
 const {h,calls}=fixture();
 for(const status of WORK_STATUSES)assert.equal((await h.POST(req({action:'save',queueId:id,version:2,assignmentId:'a',owner:'',status,brief:entry.brief}))).status,201);
 assert.deepEqual(calls.map(c=>c.input.work_status),['Tentative','In progress','Published']);
 assert.equal(JSON.stringify(entries),before);
});
