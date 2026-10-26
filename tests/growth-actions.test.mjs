import test from 'node:test';
import assert from 'node:assert/strict';
import {actionInput,actionWindow,rankEvidence} from '../lib/growth-hunter/actions.js';
import {actionHandlers} from '../lib/growth-hunter/action-handlers.js';
const id='11111111-1111-4111-8111-111111111111';
const now=new Date('2026-10-26T18:00:00Z');
test('action validation rejects unsafe URLs, unsupported status and future publication',()=>{
 assert.equal(actionInput({page:'https://www.medicarefaq.com/plans/#x',title:'  Update title '}).page,'https://www.medicarefaq.com/plans/');
 for(const page of ['javascript:alert(1)','https://evil.example/','https://www.medicarefaq.com/?lead=1'])assert.throws(()=>actionInput({page,title:'x'}));
 const input={id,version:1,title:'x',notes:'work',status:'published',published_on:'2026-10-25'};
 assert.equal(actionInput(input,true,now).status,'published');
 for(const bad of [{status:'deleted'},{published_on:'2026-10-27'},{published_on:null},{version:0}])assert.throws(()=>actionInput({...input,...bad},true,now));
});
test('follow-up windows are equal, exclude publication day and wait for complete days',()=>{
 assert.deepEqual(actionWindow('2026-10-17',7,now),{mode:'custom',compare:'custom',start:'2026-10-18',end:'2026-10-24',priorStart:'2026-10-10',priorEnd:'2026-10-16'});
 assert.throws(()=>actionWindow('2026-10-19',7,now),/Waiting/);
 assert.throws(()=>actionWindow('2026-10-01',14,now));
 const leap=actionWindow('2024-02-29',7,now);assert.equal(leap.priorStart,'2024-02-22');assert.equal(leap.end,'2024-03-07');
});
test('ranking changes compare only same-page numeric matched keywords',()=>{
 const page='https://www.medicarefaq.com/plans/';
 const before={end:'2026-10-01',rows:[{keyword:'Plan G',position:12,landing:page},{keyword:'Moved',position:5,landing:page},{keyword:'Unknown',position:null,landing:page}]};
 const after={end:'2026-10-20',rows:[{keyword:'plan g',position:8,landing:page},{keyword:'Moved',position:1,landing:page+'other/'},{keyword:'Unknown',position:7,landing:page}]};
 const r=rankEvidence(page,before,after);assert.equal(r.comparable,1);assert.equal(r.improved,1);assert.equal(r.rows[0].change,4);
 assert.equal(rankEvidence(page,null,after).improved,null);
});
test('write handlers enforce origin and role before mutations',async()=>{
 let calls=0;
 const h=actionHandlers({access:async()=>{calls++;throw Object.assign(new Error('Forbidden'),{status:403});},origin:()=> 'https://dashboard.example'});
 const request=origin=>new Request('https://dashboard.example/api',{method:'POST',headers:{origin,'Content-Type':'application/json'},body:'{}'});
 assert.equal((await h.POST(request('https://evil.example'))).status,403);assert.equal(calls,0);
 assert.equal((await h.POST(request('https://dashboard.example'))).status,403);assert.equal(calls,1);
});
test('optimistic updates return conflict when a revision no longer matches',async()=>{
 const filters=[];
 const query={update(){return this;},eq(k,v){filters.push([k,v]);return this;},select(){return this;},async maybeSingle(){return {data:null,error:null};}};
 const h=actionHandlers({access:async()=>({client:{from:()=>query}}),origin:()=> 'https://dashboard.example'});
 const r=await h.PATCH(new Request('https://dashboard.example/api',{method:'PATCH',headers:{origin:'https://dashboard.example','Content-Type':'application/json'},body:JSON.stringify({id,version:4,title:'Work',notes:'',status:'planned'})}));
 assert.equal(r.status,409);assert.deepEqual(filters,[['id',id],['version',4]]);
});

test('failed measurement does not create a result and stale revisions do not query sources',async()=>{
 let inserts=0,measures=0;
 const action={id,version:3,status:'published',published_on:'2024-01-01'};
 const query={select(){return this;},eq(){return this;},async maybeSingle(){return {data:action,error:null};},insert(){inserts++;return this;}};
 const h=actionHandlers({access:async()=>({client:{from:()=>query}}),origin:()=> 'https://dashboard.example',measure:async()=>{measures++;throw Error('Provider outage');}});
 const request=version=>new Request('https://dashboard.example/api',{method:'POST',headers:{origin:'https://dashboard.example','Content-Type':'application/json'},body:JSON.stringify({operation:'measure',id,version,days:7})});
 assert.equal((await h.POST(request(2))).status,409);assert.equal(measures,0);
 assert.equal((await h.POST(request(3))).status,503);assert.equal(measures,1);assert.equal(inserts,0);
});
