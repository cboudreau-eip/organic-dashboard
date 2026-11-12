import test from 'node:test';
import assert from 'node:assert/strict';
import {planHandlers} from '../lib/content-plan/handlers.js';
const shortlist={items:[{id:'plan-g',score:90,evidence:{source:'GSC'}}]};
const input={id:'plan-g',version:0,status:'Needs review',owner:'Editor',brief:'Review cost comparison',approved:false,scheduledDate:null};
const request=(body=input,origin='https://dashboard.example')=>new Request('https://dashboard.example/api/content-plan',{method:'PATCH',headers:{origin,'Content-Type':'application/json'},body:JSON.stringify(body)});
function fixture(role='analyst'){
 let row=null,fail=false;
 const client={from(){let fields,version,insert=false;const chain={select(){return chain;},insert(value){fields=value;insert=true;return chain;},update(value){fields=value;return chain;},eq(key,value){if(key==='version')version=value;return chain;},single(){return finish();},maybeSingle(){return finish();},then(resolve,reject){return Promise.resolve({data:row?[row]:[],error:fail?{}:null}).then(resolve,reject);}};
 function finish(){if(fail)return {error:{code:'offline'}};if(insert&&row)return {error:{code:'23505'}};if(!insert&&row?.version!==version)return {data:null};row={...row,...fields,version:(row?.version||0)+1};return {data:row};}return chain;}};
 return {handlers:planHandlers({shortlist,origin:()=> 'https://dashboard.example',access:async action=>{if(role==='outsider'||(action==='run'&&role==='viewer'))throw Object.assign(Error('No access'),{status:403});return {client,role};}}),setFail:value=>{fail=value;}};
}
test('save persists across reads, merges evidence and rejects competing edits',async()=>{
 const {handlers}=fixture();assert.equal((await handlers.PATCH(request())).status,200);
 const body=await (await handlers.GET()).json();assert.equal(body.items[0].owner,'Editor');assert.equal(body.items[0].version,1);assert.equal(body.items[0].score,90);
 assert.equal((await handlers.PATCH(request())).status,409);
 assert.equal((await handlers.PATCH(request({...input,version:1,brief:'Revised'}))).status,200);
 assert.equal((await handlers.PATCH(request({...input,version:1}))).status,409);
});
test('permissions, origin and unavailable storage fail closed',async()=>{
 const viewer=fixture('viewer');assert.equal((await viewer.handlers.GET()).status,200);assert.equal((await (await viewer.handlers.GET()).json()).canEdit,false);
 assert.equal((await viewer.handlers.PATCH(request())).status,403);
 assert.equal((await fixture('outsider').handlers.GET()).status,403);
 const normal=fixture();assert.equal((await normal.handlers.PATCH(request(input,'https://untrusted.example'))).status,403);
 assert.equal((await normal.handlers.PATCH(request({...input,scheduledDate:'2027-01-01'}))).status,422);
 normal.setFail(true);assert.equal((await normal.handlers.GET()).status,503);assert.equal((await normal.handlers.PATCH(request())).status,503);
});
