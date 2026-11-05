import test from 'node:test';
import assert from 'node:assert/strict';
import {queryStep,advanceJob,newJob,publicReport,reportKey,FRESH_MS} from '../lib/posthog/async-conversions.js';
const period={start:'2026-08-07',end:'2026-11-04',priorStart:'2026-05-09',priorEnd:'2026-08-06'};
const row=[100,20,10,8,2,3,11];
test('async submission ignores stale result rows until completed, then unwraps polling results',async()=>{
 let calls=0;
 const fetchImpl=async(url,options)=>{
  calls++;
  if(calls===1){assert.equal(JSON.parse(options.body).refresh,'async');return Response.json({results:[row],query_status:{id:'query-123',complete:false}});}
  assert.match(url,/query\/query-123\/$/);assert.equal(options.method,'GET');
  return Response.json({query_status:{complete:true,results:{results:[row],last_refresh:'2026-11-05T12:00:00Z'}}});
 };
 const pending=await queryStep({}, {},{key:'test',fetchImpl});assert.equal(pending.result,undefined);
 const done=await queryStep({},pending,{key:'test',fetchImpl});assert.deepEqual(done.result.results,[row]);
});
test('sections finish independently and rejected sections never replace a complete saved report',async()=>{
 const job=newJob(1000);job.sections[1]={result:{results:[row]}};
 let i=0;
 const next=await advanceJob(job,period,{now:2000,key:'test',fetchImpl:async()=>++i===1?Response.json({query_status:{id:'abc',complete:false}}):Response.json({results:[]})});
 assert.equal(next.job.done,false);assert.equal(next.report.current,null);assert.equal(next.report.previous.contactSessions,10);assert.deepEqual(next.report.pages,[]);
 const saved={...next.report,status:'complete',fetchedAt:new Date(0).toISOString(),current:{contactSessions:99}};
 const view=publicReport({report:saved,partial:next.report,job:next.job},period,FRESH_MS+1);
 assert.equal(view.current.contactSessions,99);assert.equal(view.refreshing,true);assert.equal(view.stale,true);assert.equal(view.fetchedAt,saved.fetchedAt);
});
test('transient failures have bounded attempts and expired jobs stop polling',async()=>{
 let job=newJob(0);const options={now:1,key:'test',fetchImpl:async()=>new Response('',{status:504})};
 for(let i=0;i<3;i++)job=(await advanceJob(job,period,options)).job;
 assert.equal(job.done,true);assert.ok(job.sections.every(s=>s.failed));
 const expired=await advanceJob(newJob(0),period,{...options,now:600001,fetchImpl:()=>assert.fail('expired jobs must not call provider')});assert.equal(expired.job.done,true);
});
test('invalid totals and provider errors are rejected rather than saved as zero',async()=>{
 const invalid=await advanceJob(newJob(0),period,{now:1,key:'test',fetchImpl:async()=>Response.json({results:[[1,-1]]})});
 assert.ok(invalid.job.sections.every(s=>s.failed));assert.equal(invalid.report.current,null);
 await assert.rejects(queryStep({}, {},{key:'test',fetchImpl:async()=>Response.json({query_status:{complete:true,error:true,results:{results:[row]}}})}));
});
test('cache keys bind both periods and metric query definitions',()=>{
 assert.notEqual(reportKey(period),reportKey({...period,priorStart:'2026-05-10'}));
 assert.notEqual(reportKey(period),reportKey({...period,end:'2026-11-03'}));
 assert.equal(reportKey(period),reportKey({...period}));
});
