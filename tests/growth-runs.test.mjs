import test from 'node:test';
import assert from 'node:assert/strict';
import { createRunHandlers } from '../lib/growth-hunter/runs.js';
const priorId='11111111-1111-4111-8111-111111111111',currentId='22222222-2222-4222-8222-222222222222';
const origin='https://dashboard.example.test';
const body={priorId,currentId,scopeConfirmed:true};
const request=(value=body,site=origin)=>new Request(origin+'/api/growth-hunter/runs',{method:'POST',headers:{Origin:site,'Content-Type':'application/json'},body:JSON.stringify(value)});
function fixture(role='analyst',error=null,reused=false) {
 let writes=0;
 const client={auth:{getUser:async()=>({data:{user:{id:priorId,email:'fixture@example.test',email_confirmed_at:'2026-01-01',is_anonymous:false}}})},
 rpc:async(name,args)=>{if(name==='growth_access')return {data:role};writes++;assert.deepEqual(args,{prior_id:priorId,current_id:currentId,scope_confirmed:true});return {error,data:{run:{id:currentId,created_by:priorId,result:{}},reused}}}};
 return {handlers:createRunHandlers({getClient:async()=>client,enabled:()=>true,origin:()=>origin}),writes:()=>writes};
}
test('research requires membership, matching origin, explicit scope and valid bounded input',async()=>{
 const f=fixture();
 for(const [input,site,status] of [[body,'https://attacker.test',403],[{...body,scopeConfirmed:false},origin,400],[{...body,currentId:priorId},origin,400],[{...body,created_by:priorId},origin,400],[{...body,priorId:'bad'},origin,400],[{...body,padding:'x'.repeat(3000)},origin,413]])assert.equal((await f.handlers.POST(request(input,site))).status,status);
 assert.equal(f.writes(),0);
 assert.equal((await fixture('viewer').handlers.POST(request())).status,403);
 assert.equal((await fixture(null).handlers.POST(request())).status,403);
 const off=createRunHandlers({enabled:()=>false,getClient:()=>{throw Error('must not call')}});
 assert.equal((await off.GET()).status,404);
});
test('research returns persisted identifiers and safe database errors',async()=>{
 const f=fixture(); const response=await f.handlers.POST(request());
 assert.equal(response.status,201);assert.equal(response.headers.get('cache-control'),'private, no-store');
 assert.equal((await response.json()).run.created_by,undefined);assert.equal(f.writes(),1);
 assert.equal((await fixture('analyst',null,true).handlers.POST(request())).status,200);
 for(const [code,status] of [['42501',403],['P0002',404],['22023',400],['XX000',503]]) {
 const response=await fixture('analyst',{code,message:'secret provider detail'}).handlers.POST(request());
 assert.equal(response.status,status);assert.doesNotMatch(await response.text(),/secret provider/);
 }
});
