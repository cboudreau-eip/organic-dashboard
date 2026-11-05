import test from 'node:test';
import assert from 'node:assert/strict';
import {growthContentHandler} from '../lib/growth-hunter/content-handler.js';
import {growthRecommendation,growthContentMarkdown} from '../lib/growth-hunter/content.js';
const id='11111111-1111-4111-8111-111111111111',page='https://www.medicarefaq.com/medicare/';
const finding={url:page,prior:{clicks:100,impressions:1000,ctr:.1,position:3},current:{clicks:60,impressions:800,ctr:.075,position:4},lostClicks:40};
const evidence={runId:id,priorSnapshotId:id,currentSnapshotId:id,priorPeriod:{start:'2026-10-01',end:'2026-10-07'},currentPeriod:{start:'2026-10-08',end:'2026-10-14'},finding,keywords:[],keywordResearchId:null};
const pages=[{id:'target',url:page,text:'Source text'}],output={targetId:'target',reason:'Clarify the explanation.',placement:'After introduction.',draft:'Proposed copy for review.',linkIds:[]};
const request=(body={runId:id,page},origin='https://dashboard.test')=>new Request('https://dashboard.test/api',{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify(body)});
function setup({role='analyst',run=true,researchError=false}={}){
 let generated=0;
 const client={auth:{getUser:async()=>({data:{user:{id:'user',email:'user@example.com',email_confirmed_at:'yes'}}})},rpc:async()=>({data:role}),from(table){return {select(){return this;},eq(){return this;},async maybeSingle(){return table==='growth_decline_runs'?{data:run?{id,result:{...evidence,findings:[finding]}}:null}:{data:null,error:researchError};}};}};
 const deps={getClient:async()=>client,enabled:()=>true,origin:()=> 'https://dashboard.test',configured:()=>true,sources:async()=>pages,generate:async e=>{generated++;assert.equal(e.finding.prior.clicks,100);assert.equal(e.keywordResearchId,null);return output;}};
 return {handler:growthContentHandler(deps),deps,count:()=>generated};
}
test('generation uses saved findings, blocks injected metrics and foreign origin, preserves missing research',async()=>{
 const s=setup();assert.equal((await s.handler(request(undefined,'https://evil.test'))).status,403);
 assert.equal((await s.handler(request({runId:id,page,finding:{clicks:999}}))).status,400);
 assert.equal((await s.handler(request({runId:id,page:'https://www.medicarefaq.com/not-a-finding/'}))).status,404);
 const r=await s.handler(request());assert.equal(r.status,200);const data=await r.json();assert.equal(data.evidence.finding.prior.clicks,100);assert.match(data.suggestion.notes,/Not available/);assert.doesNotMatch(data.suggestion.notes,/Otterly/);
 await s.handler(request());await s.handler(request());assert.equal((await s.handler(request())).status,429);assert.equal(s.count(),3);
});
test('viewers, unavailable evidence and failed source fetch cannot generate',async()=>{
 for(const [options,status] of [[{role:'viewer'},403],[{run:false},404],[{researchError:true},503]]){const s=setup(options);assert.equal((await s.handler(request())).status,status);assert.equal(s.count(),0);}
 const s=setup();assert.equal((await growthContentHandler({...s.deps,sources:async()=>[]})(request())).status,422);assert.equal(s.count(),0);
});
test('model cannot switch target or invent links; export preserves edited text and baseline',()=>{
 assert.throws(()=>growthRecommendation({...output,targetId:'other'},pages,evidence));
 assert.throws(()=>growthRecommendation({...output,linkIds:['fake']},pages,evidence));
 const suggestion=growthRecommendation(output,pages,evidence),notes='My edit\n```\nPreserve this exactly';
 const exported=growthContentMarkdown({suggestion,evidence,sources:pages,generatedAt:'2026-11-05T12:00:00Z'},notes);
 assert.ok(exported.text.includes(notes));assert.match(exported.text,/````text/);assert.match(exported.text,/\| clicks \| 100 \| 60 \|/);assert.match(exported.text,/No saved keyword research/);assert.match(exported.text,/Do not publish automatically/);
});
