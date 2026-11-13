import test from 'node:test';
import assert from 'node:assert/strict';
import {validationHandlers} from '../lib/research/validation-handlers.js';
const id='11111111-1111-4111-8111-111111111111',key='a'.repeat(24);
const req=(input,origin='https://dashboard.example')=>new Request(origin+'/api/research/validation',{method:'POST',headers:{origin},body:JSON.stringify(input)});
function fixture(role='analyst',validate=async()=>({readiness:'Ready for review',verification:{status:'Passed'}})){
 const tables={research_validations:[{id,research_run_id:id,rules_version:'validation-v2',version:1,status:'running',payload:{sourceDates:{},assignments:[{key,state:'pending'},{key:'b'.repeat(24),state:'pending'},{key:'c'.repeat(24),state:'pending'}]}}],research_assignment_reviews:[],research_runs:[]};
 const client={from(table){let values,insert=false,filters=[],single=false;const chain={select(){return chain;},order(){return chain;},limit(){return chain;},eq(k,v){filters.push([k,v]);return chain;},insert(v){values=v;insert=true;return chain;},update(v){values=v;return chain;},single(){single=true;return finish();},maybeSingle(){single=true;return finish();},then(ok,bad){return Promise.resolve(finish()).then(ok,bad);}};
 function finish(){let found=tables[table].filter(r=>filters.every(([k,v])=>r[k]===v));if(values){if(insert){const row={id,version:1,status:'running',...values};tables[table].push(row);found=[row];}else for(const row of found)Object.assign(row,values,{version:row.version+1});}return {data:structuredClone(single?found[0]||null:found)};}return chain;}};
 const handlers=validationHandlers({client,origin:()=> 'https://dashboard.example',configured:()=>true,validate,resolve:validate,access:async action=>{if(role==='viewer'&&action==='run')throw Object.assign(Error('No access'),{status:403});return {client,role};}});
 return {tables,h:handlers};
}
test('validation batches save progress and reloads do not repeat completed AI work',async()=>{
 let calls=0;const {h,tables}=fixture('analyst',async()=>{calls++;return {readiness:'Ready for review',verification:{status:'Passed'}};});
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
 row.status='complete';row.payload.assignments[2]={key:'c'.repeat(24),state:'done',result:{readiness:'Ready for review',verification:{status:'Passed'}}};
 assert.equal((await h.POST(req({action:'review',id,key,decision:'Keep',reason:'',version:0}))).status,422);
 const retry=await (await h.POST(req({action:'retry',runId:id}))).json();assert.equal(retry.run.payload.assignments.filter(a=>a.state==='pending').length,2);assert.equal(retry.run.payload.assignments[2].state,'done');
});
test('validation writes require same origin and analyst access',async()=>{
 assert.equal((await fixture('viewer').h.POST(req({action:'start',runId:id}))).status,403);
 assert.equal((await fixture().h.POST(req({action:'start',runId:id},'https://attacker.example'))).status,403);
});

test('resolution snapshots only held assignments and preserves successful work and review records',async()=>{
 const {h,tables}=fixture();const old=tables.research_validations[0];old.status='complete';
 old.payload.assignments=[{key,state:'done',targetUrl:null,topics:[{title:'Compare Plan G'}],candidateUrls:[],result:{readiness:'Needs research'}},{key:'b'.repeat(24),state:'done',result:{readiness:'No change suggested',summary:'Retain this result'}}];
 tables.research_runs=[{id,status:'complete',payload:{inventory:{pages:[{url:'https://www.medicarefaq.com/plan-g',title:'Compare Plan G'}]}}}];
 tables.research_assignment_reviews=[{validation_id:id,assignment_key:key,decision:'Defer',reason:'Original note'}];
 assert.equal((await h.POST(req({action:'resolve',runId:id,id,version:9}))).status,409);
 const response=await h.POST(req({action:'resolve',runId:id,id,version:1}));assert.equal(response.status,201);const {run}=await response.json();
 assert.equal(run.payload.resolution.selected,1);assert.equal(run.payload.assignments[0].state,'pending');assert.equal(run.payload.assignments[1].result.summary,'Retain this result');assert.equal(old.payload.assignments[0].state,'done');assert.equal(tables.research_assignment_reviews[0].reason,'Original note');assert.equal(run.payload.assignments[0].resolutionUrls.length,1);
});

test('completed resolution is idempotent and retry preserves the previous finding context',async()=>{
 let calls=0;const {h,tables}=fixture('analyst',async()=>{calls++;});const old=tables.research_validations[0];old.status='complete';old.payload.resolution={version:'resolution-v2',selected:1};old.payload.assignments=[{key,state:'done',result:{readiness:'Needs research',retryable:true,summary:'Prior evidence',resolution:{failure:{stage:'verification'}}}}];
 assert.equal((await h.POST(req({action:'resolve',runId:id,id,version:1}))).status,200);assert.equal(calls,0);assert.equal(tables.research_validations.length,1);
 const {run}=await (await h.POST(req({action:'retry',runId:id}))).json();assert.equal(run.payload.assignments[0].result.summary,'Prior evidence');assert.equal(run.payload.assignments[0].state,'pending');assert.equal(calls,0);
});

test('updated resolution retains valid coverage but reopens a falsely cleared brand-specific query',async()=>{
 const {h,tables}=fixture();const old=tables.research_validations[0];old.status='complete';old.payload.resolution={version:'resolution-v1'};
 const result={readiness:'No change suggested',sources:[{id:'own1',url:'https://www.medicarefaq.com/plan-g',title:'Plan G comparison'}],findings:[{topicKey:'one',judgement:'covered',sourceId:'own1',quote:'Compare Plan G using the same applicant details.'}],resolution:{version:'resolution-v1',blockers:[]}};
 old.payload.assignments=[{key,state:'done',targetUrl:null,candidateUrls:[],topics:[{key:'one',title:'Lumico Medicare supplement'}],result:structuredClone(result)},{key:'b'.repeat(24),state:'done',targetUrl:null,candidateUrls:[],topics:[{key:'one',title:'Compare Plan G'}],result:structuredClone(result)}];
 tables.research_runs=[{id,status:'complete',payload:{inventory:{pages:[]}}}];
 const {run}=await (await h.POST(req({action:'resolve',runId:id,id,version:1}))).json();assert.equal(run.payload.resolution.reused,1);assert.equal(run.payload.assignments[0].state,'pending');assert.match(run.payload.assignments[0].result.resolution.blockers[0].question,/named carrier/);assert.equal(run.payload.assignments[1].state,'done');assert.equal(run.payload.assignments[1].result.resolution.version,'resolution-v2');assert.equal(old.payload.assignments[0].result.readiness,'No change suggested');
});
test('primary verification preserves completed results and appends only unreviewed ranked topics',async()=>{
 const {h,tables}=fixture();const old=tables.research_validations[0];old.status='complete';
 old.payload.selectedCount=2;old.payload.assignments=[{key,topics:[{key:'seen'}],targetUrl:'https://www.medicarefaq.com/old',state:'done',result:{readiness:'No change suggested'}},{key:'b'.repeat(24),topics:[{key:'held',title:'Compare costs'}],candidateUrls:[],state:'done',result:{readiness:'Needs research'}}];
 const item=(key,target)=>({key,title:'compare medicare plan g quotes',targetUrl:target,type:'Update existing page',intent:'Transactional',score:80,terms:[],evidence:{gsc:[],semrush:[],otterly:[]}});
 tables.research_runs=[{id,status:'complete',payload:{results:{items:[item('seen','https://www.medicarefaq.com/old'),item('duplicate','https://www.medicarefaq.com/old'),item('fresh','https://www.medicarefaq.com/new')]},inventory:{pages:[]}}}];
 const response=await h.POST(req({action:'advance',runId:id,id,version:1}));assert.equal(response.status,201);const {run}=await response.json();assert.equal(run.payload.addedTopics,1);assert.equal(run.payload.assignments.length,3);assert.equal(run.payload.assignments[0].state,'done');assert.equal(run.payload.assignments[1].primaryVerification,true);assert.equal(run.payload.assignments[2].topics[0].rank,3);assert.equal(old.payload.assignments.length,2);
});

test('decision audit snapshots holds and a bounded sample, retaining untouched results',async()=>{
 const {h,tables}=fixture();const old=tables.research_validations[0];old.status='complete';
 old.payload.assignments=Array.from({length:7},(_,i)=>({key:String(i),priority:i,state:'done',topics:[{title:'Plan G'}],candidateUrls:[],result:{readiness:'No change suggested',summary:'Saved '+i}}));
 old.payload.assignments.push({key:'held',state:'done',topics:[{title:'Plan G'}],candidateUrls:[],result:{readiness:'Needs research'}});
 tables.research_runs=[{id,status:'complete',payload:{inventory:{pages:[]}}}];
 assert.equal((await h.POST(req({action:'audit',runId:id,id,version:9}))).status,409);
 const {run}=await (await h.POST(req({action:'audit',runId:id,id,version:1}))).json();
 assert.equal(run.payload.decisionAudit.keys.length,6);assert.equal(run.payload.assignments.filter(a=>a.state==='pending').length,6);assert.equal(run.payload.assignments[0].result.summary,'Saved 0');assert.ok(old.payload.assignments.every(a=>a.state==='done'));assert.equal(old.payload.decisionAudit,undefined);
});
