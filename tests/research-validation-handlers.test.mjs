import test from 'node:test';
import assert from 'node:assert/strict';
import {validationHandlers} from '../lib/research/validation-handlers.js';
const id='11111111-1111-4111-8111-111111111111',key='a'.repeat(24);
const req=(input,origin='https://dashboard.example')=>new Request(origin+'/api/research/validation',{method:'POST',headers:{origin},body:JSON.stringify(input)});
function fixture(role='analyst',validate=async()=>({readiness:'Ready for review'})){
 const tables={research_validations:[{id,research_run_id:id,rules_version:'validation-v1',version:1,status:'running',payload:{sourceDates:{},assignments:[{key,state:'pending'},{key:'b'.repeat(24),state:'pending'},{key:'c'.repeat(24),state:'pending'}]}}],research_assignment_reviews:[],research_runs:[]};
 const client={from(table){let values,insert=false,filters=[],single=false;const chain={select(){return chain;},order(){return chain;},limit(){return chain;},eq(k,v){filters.push([k,v]);return chain;},insert(v){values=v;insert=true;return chain;},update(v){values=v;return chain;},single(){single=true;return finish();},maybeSingle(){single=true;return finish();},then(ok,bad){return Promise.resolve(finish()).then(ok,bad);}};
 function finish(){let found=tables[table].filter(r=>filters.every(([k,v])=>r[k]===v));if(values){if(insert){const row={id,version:1,status:'running',...values};tables[table].push(row);found=[row];}else for(const row of found)Object.assign(row,values,{version:row.version+1});}return {data:structuredClone(single?found[0]||null:found)};}return chain;}};
 const handlers=validationHandlers({client,origin:()=> 'https://dashboard.example',configured:()=>true,validate,access:async action=>{if(role==='viewer'&&action==='run')throw Object.assign(Error('No access'),{status:403});return {client,role};}});
 return {tables,h:handlers};
}
test('validation batches save progress and reloads do not repeat completed AI work',async()=>{
 let calls=0;const {h,tables}=fixture('analyst',async()=>{calls++;return {readiness:'Ready for review'};});
 assert.equal((await h.POST(req({action:'start',runId:id}))).status,200);assert.equal(calls,0);
 let response=await (await h.POST(req({action:'step',id,version:1}))).json();assert.equal(calls,2);assert.equal(response.run.status,'running');assert.equal(response.run.lease_token,undefined);
 assert.equal((await h.POST(req({action:'step',id,version:1}))).status,409);assert.equal(calls,2);
 response=await (await h.POST(req({action:'step',id,version:response.run.version}))).json();assert.equal(calls,3);assert.equal(response.run.status,'complete');
 await h.POST(req({action:'step',id,version:response.run.version}));assert.equal(calls,3);
 assert.equal((await h.POST(req({action:'review',id,key,decision:'Keep',reason:'Reviewed evidence',version:0}))).status,200);
 assert.equal((await h.POST(req({action:'review',id,key,decision:'Keep',reason:'Stale edit',version:9}))).status,409);
 assert.equal(tables.research_assignment_reviews[0].reason,'Reviewed evidence');
});
test('leases prevent overlapping calls; failed checks are retained and retry only failures',async()=>{
 const {h,tables}=fixture('analyst',async()=>{throw Error('private provider failure');});const row=tables.research_validations[0];
 row.lease_token=id;row.lease_expires_at=new Date(Date.now()+60000).toISOString();
 assert.equal((await h.POST(req({action:'step',id,version:1}))).status,409);row.lease_token=null;row.lease_expires_at=null;
 await h.POST(req({action:'step',id,version:1}));assert.equal(row.payload.assignments[0].result.readiness,'Needs research');
 row.status='complete';row.payload.assignments[2]={key:'c'.repeat(24),state:'done',result:{readiness:'Ready for review'}};
 assert.equal((await h.POST(req({action:'review',id,key,decision:'Keep',reason:'',version:0}))).status,422);
 const retry=await (await h.POST(req({action:'retry',runId:id}))).json();assert.equal(retry.run.payload.assignments.filter(a=>a.state==='pending').length,2);assert.equal(retry.run.payload.assignments[2].state,'done');
});
test('validation writes require same origin and analyst access',async()=>{
 assert.equal((await fixture('viewer').h.POST(req({action:'start',runId:id}))).status,403);
 assert.equal((await fixture().h.POST(req({action:'start',runId:id},'https://attacker.example'))).status,403);
});
