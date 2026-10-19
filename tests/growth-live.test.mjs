import test from 'node:test';
import assert from 'node:assert/strict';
import {loadGrowthEvidence,API_COVERAGE} from '../lib/growth-hunter/live.js';
import {createAnalyzeHandler} from '../lib/growth-hunter/analyze.js';
import {shiftDate} from '../lib/gsc/report.js';
const now=new Date('2026-10-19T20:00:00Z');
const page=i=>({keys:['https://www.medicarefaq.com/page-'+i+'/'],clicks:30,impressions:100,ctr:.3,position:4});
function provider(count=1,change=x=>x) {
 const calls=[];
 return {calls,query:async(start,end,dims,limit,filters,offset=0)=>{
  calls.push({start,end,dims,limit,filters,offset});
  if(dims[0]==='date')return Array.from({length:(Date.parse(end)-Date.parse(start))/86400000+1},(_,i)=>({keys:[shiftDate(start,i)]}));
  return change(Array.from({length:Math.min(1000,Math.max(0,count-offset))},(_,i)=>page(i+offset)));
 }};
}
test('live GSC uses finalized adjacent windows, all bounded pages and fixed filters',async()=>{
 const f=provider(2000),result=await loadGrowthEvidence(f.query,7,now);
 assert.equal(result.current.start,'2026-10-12');assert.equal(result.current.end,'2026-10-18');assert.equal(result.prior.start,'2026-10-05');assert.equal(result.prior.end,'2026-10-11');
 assert.equal(result.current.rows.length,2000);assert.equal(result.current.coverage,API_COVERAGE);
 assert.equal(f.calls.filter(c=>c.offset===2000).length,2,'probe prevents silent truncation at limit');
 assert.ok(f.calls.filter(c=>c.dims[0]==='page').every(c=>c.filters[0].expression==='[?#]'));
});
test('live GSC rejects empty, oversized, duplicate, invalid and missing-day evidence',async()=>{
 for(const f of [provider(0),provider(2001),provider(2,rows=>[rows[0],rows[0]]),provider(1,rows=>[{...rows[0],impressions:0}]),provider(1,rows=>[{...rows[0],keys:['https://attacker.test/']}])])await assert.rejects(loadGrowthEvidence(f.query,7,now));
 const f=provider();await assert.rejects(loadGrowthEvidence(async(...args)=>(await f.query(...args)).slice(1),7,now));
 await assert.rejects(loadGrowthEvidence(f.query,30,now));
});
const origin='https://dashboard.example.test';
const request=(body={days:7},site=origin)=>new Request(origin+'/api/growth-hunter/analyze',{method:'POST',headers:{Origin:site,'Content-Type':'application/json'},body:JSON.stringify(body)});
function handler(role='analyst',failure=false) {
 let reads=0,writes=0;
 const client={auth:{getUser:async()=>({data:{user:{id:'test',email:'fixture@example.test',email_confirmed_at:'2026-01-01',is_anonymous:false}}})},rpc:async(name,args)=>{
  if(name==='growth_access')return {data:role};writes++;assert.equal(name,'growth_analyze_gsc');assert.deepEqual(Object.keys(args),['prior_input','current_input']);return {data:{run:{id:'saved',created_by:'private'},reused:false}};
 }};
 return {reads:()=>reads,writes:()=>writes,post:createAnalyzeHandler({getClient:async()=>client,enabled:()=>true,origin:()=>origin,loadEvidence:async()=>{reads++;if(failure)throw Error('secret');return {prior:{},current:{}};}})};
}
test('live API gates provider access and saves only one atomic request',async()=>{
 for(const role of ['viewer',null]){const f=handler(role);assert.equal((await f.post(request())).status,403);assert.equal(f.reads(),0);}
 const f=handler();assert.equal((await f.post(request({days:7},'https://attacker.test'))).status,403);
 for(const body of [{days:30},{days:7,prior:{}},null])assert.equal((await f.post(request(body))).status,400);
 assert.equal(f.reads(),0);const response=await f.post(request());assert.equal(response.status,201);assert.equal((await response.json()).run.created_by,undefined);assert.equal(f.writes(),1);
 const broken=handler('analyst',true);const error=await broken.post(request());assert.equal(error.status,503);assert.doesNotMatch(await error.text(),/secret/);assert.equal(broken.writes(),0);
 const disabled=createAnalyzeHandler({enabled:()=>false,getClient:()=>{throw Error('must not call')}});assert.equal((await disabled(request())).status,404);
});
