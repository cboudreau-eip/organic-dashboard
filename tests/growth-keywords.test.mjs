import test from 'node:test';
import assert from 'node:assert/strict';
import {loadQueryEvidence,compareQueryEvidence,queryPatterns} from '../lib/growth-hunter/keywords.js';
import {createQueryHandlers} from '../lib/growth-hunter/query-handlers.js';
import {API_COVERAGE} from '../lib/growth-hunter/live.js';
const runId='11111111-1111-4111-8111-111111111111';
const page='https://www.medicarefaq.com/faqs/medicare-prior-authorization/';
const target={page,priorPeriod:{start:'2026-08-23',end:'2026-09-19'},currentPeriod:{start:'2026-09-20',end:'2026-10-17'}};
const now=new Date('2026-10-19T20:00:00Z');
const row=(query,clicks=10,impressions=100,position=5)=>({query,clicks,impressions,ctr:clicks/impressions,position});
const providerRow=i=>({keys:['query '+i],clicks:10,impressions:100,ctr:.1,position:5});
function provider(count=1,change=x=>x){const calls=[];return {calls,query:async(start,end,dimensions,limit,filters,offset=0)=>{calls.push({start,end,dimensions,limit,filters,offset});return change(Array.from({length:Math.max(0,Math.min(1000,count-offset))},(_,i)=>providerRow(offset+i)));}};}
test('query capture uses saved dates, exact URL and bounded pagination without inventing missing rows',async()=>{
 const f=provider(2000),evidence=await loadQueryEvidence(f.query,target,now);
 assert.equal(evidence.prior.rows.length,2000);assert.equal(evidence.current.rows.length,2000);assert.equal(evidence.fetchedAt,now.toISOString());
 assert.deepEqual(f.calls.map(c=>c.offset).sort(),[0,0,1000,1000,2000,2000]);
 assert.ok(f.calls.every(c=>c.filters.length===1&&c.filters[0].operator==='equals'&&c.filters[0].expression===page&&c.dimensions[0]==='query'));
 assert.equal(evidence.prior.start,target.priorPeriod.start);assert.equal(evidence.current.end,target.currentPeriod.end);
 const empty=await loadQueryEvidence(provider(0).query,target,now);assert.equal(compareQueryEvidence(empty).matched.length,0);
});
test('query evidence rejects overflow, duplicate, foreign URLs, bad dates and invalid metrics',async()=>{
 for(const f of [provider(2001),provider(2,b=>[b[0],b[0]]),provider(1,b=>[{...b[0],ctr:.9}]),provider(1,b=>[{...b[0],keys:['bad\nquery']}])])await assert.rejects(loadQueryEvidence(f.query,target,now));
 for(const bad of [{...target,page:'https://evil.test/'},{...target,page:page+'?secret=1'},{...target,currentPeriod:{start:'2026-09-20',end:'2026-10-18'}}])await assert.rejects(loadQueryEvidence(provider().query,bad,now));
});
test('comparison ranks matched losses, preserves absent queries and avoids causal claims',()=>{
 const evidence={prior:{rows:[row('loss',20),row('earlier only',50),row('gain',0),row('tie',20)]},current:{rows:[row('loss',5),row('gain',10),row('later only',40),row('tie',5)]}};
 const result=compareQueryEvidence(evidence);assert.deepEqual(result.matched.map(r=>r.query),['loss','tie','gain']);
 assert.equal(result.matched[0].lostClicks,15);assert.equal(result.matched[0].declinePercent,75);assert.equal(result.matched[2].declinePercent,null);
 assert.equal(result.decliningQueries,2);assert.equal(result.priorOnly.length,1);assert.equal(result.currentOnly.length,1);
 assert.match(queryPatterns(row('x',20,100,5),row('x',10,100,6))[0],/Position worsened/);
 assert.match(queryPatterns(row('x',20,100,5),row('x',10,60,5.2))[0],/Fewer impressions/);
 assert.match(queryPatterns(row('x',20,100,5),row('x',10,100,5.2))[0],/Lower CTR/);
 assert.deepEqual(queryPatterns(row('x',20),row('x',30)),[]);
 assert.match(queryPatterns(row('x',10,10),row('x',5,10))[0],/Too few/);
});
const origin='https://dashboard.example.test';
const request=(body={runId,page},site=origin)=>new Request(origin+'/api/growth-hunter/keywords',{method:'POST',headers:{Origin:site,'Content-Type':'application/json'},body:JSON.stringify(body)});
function fixture({role='analyst',existing=null,coverage=API_COVERAGE,found=true,failure=false,dbError=null}={}){
 let reads=0,writes=0;
 const client={auth:{getUser:async()=>({data:{user:{id:runId,email:'fixture@example.test',email_confirmed_at:'2026-01-01',is_anonymous:false}}})},rpc:async(name,args)=>{if(name==='growth_access')return {data:role};writes++;assert.equal(name,'growth_save_query_research');assert.equal(args.selected_run,runId);return {error:dbError,data:{research:{id:'research',created_by:'private',payload:args.input},reused:false}};},from(table){
  const result=table==='growth_decline_runs'?{data:found?{prior_snapshot_id:'prior',current_snapshot_id:'current',result:{findings:[{url:page}]}}:null}:table==='growth_snapshots'?{data:[{id:'prior',coverage,period_start:target.priorPeriod.start,period_end:target.priorPeriod.end},{id:'current',coverage,period_start:target.currentPeriod.start,period_end:target.currentPeriod.end}]}:{data:existing};
  const builder={select:()=>builder,eq:()=>builder,in:async()=>result,maybeSingle:async()=>result};return builder;
 }};
 return {reads:()=>reads,writes:()=>writes,handlers:createQueryHandlers({getClient:async()=>client,enabled:()=>true,origin:()=>origin,loadEvidence:async input=>{reads++;assert.deepEqual(input,target);if(failure)throw Error('credential secret');return {page};}})};
}
test('keyword API checks membership, origin, finding membership and source scope before GSC',async()=>{
 for(const role of ['viewer',null]){const f=fixture({role});assert.equal((await f.handlers.POST(request())).status,403);assert.equal(f.reads(),0);}
 const f=fixture();assert.equal((await f.handlers.POST(request({runId,page},'https://evil.test'))).status,403);
 assert.equal((await f.handlers.POST(request({runId,page,start:'forged'}))).status,400);assert.equal(f.reads(),0);
 for(const opts of [{found:false},{coverage:'manual_pages_export_not_exhaustive'}]){const f=fixture(opts);assert.ok([404,422].includes((await f.handlers.POST(request())).status));assert.equal(f.reads(),0);}
 const off=createQueryHandlers({enabled:()=>false,getClient:()=>{throw Error('no calls')}});assert.equal((await off.POST(request())).status,404);
});
test('keyword API reads/reuses saved evidence without GSC, and never writes on fetch failure',async()=>{
 const reused=fixture({existing:{id:'saved'}});const response=await reused.handlers.POST(request());assert.equal(response.status,200);assert.equal((await response.json()).reused,true);assert.equal(reused.reads(),0);assert.equal(reused.writes(),0);
 const viewer=fixture({role:'viewer',existing:{id:'saved'}});const get=await viewer.handlers.GET(new Request(origin+'/api/growth-hunter/keywords?'+new URLSearchParams({runId,page})));assert.equal(get.status,200);assert.equal(viewer.reads(),0);
 const fresh=fixture();const saved=await fresh.handlers.POST(request());assert.equal(saved.status,201);assert.equal((await saved.json()).research.created_by,undefined);assert.equal(fresh.writes(),1);
 const broken=fixture({failure:true});const error=await broken.handlers.POST(request());assert.equal(error.status,503);assert.doesNotMatch(await error.text(),/credential/);assert.equal(broken.writes(),0);
 assert.equal((await fixture({dbError:{code:'42501'}}).handlers.POST(request())).status,403);
});
