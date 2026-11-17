import test from 'node:test';import assert from 'node:assert/strict';import {proposalHandlers} from '../lib/research/proposal-handlers.js';import {DEFAULTS} from '../lib/research/contracts.js';
const id='11111111-1111-4111-8111-111111111111';
const req=x=>new Request('https://dashboard.example/api/research/proposals',{method:'POST',headers:{origin:'https://dashboard.example'},body:JSON.stringify(x)});
function fixture(role='analyst',options={}){
 const tables={proposal_target_resolutions:[],paid_search_research:[],research_runs:[{id,status:'complete',settings:DEFAULTS,payload:{}}],proposed_content_plans:[]};
 const client={from(table){let values,insert=false,filters=[],single=false;const chain={select(){return chain;},order(){return chain;},limit(){return chain;},eq(k,v){filters.push([k,v]);return chain;},insert(v){values=v;insert=true;return chain;},update(v){values=v;return chain;},single(){single=true;return finish();},maybeSingle(){single=true;return finish();},then(ok,bad){return Promise.resolve(finish()).then(ok,bad);}};function finish(){const rows=tables[table];let found=rows.filter(r=>filters.every(([k,v])=>r[k]===v));if(values){if(insert){const row={id,version:1,edits:{},...values};rows.push(row);found=[row];}else for(const row of found)Object.assign(row,values,{version:row.version+1});}return {data:single?found[0]||null:found};}return chain;}};
 return {tables,client,h:proposalHandlers({origin:()=> 'https://dashboard.example',access:async action=>{if(role==='outsider'||role==='viewer'&&action==='run')throw Object.assign(Error('No access'),{status:403});return {client,role};},...options})};
}
test('generate and edit persist without approval, preserving previous evidence and version conflicts',async()=>{
 const {h,tables}=fixture();const response=await h.POST(req({action:'generate',runId:id}));assert.equal(response.status,201);const {plan}=await response.json();assert.equal(plan.payload.items.length,90);
 const item=plan.payload.items[0];const edit={action:'edit',planId:id,version:1,itemId:item.id,fields:{title:'Pepper demo revision'}};
 assert.equal((await h.POST(req(edit))).status,200);assert.equal((await h.POST(req(edit))).status,409);
 const loaded=await (await h.GET(new Request('https://dashboard.example/api/research/proposals'))).json();assert.equal(loaded.plan.payload.items[0].title,'Pepper demo revision');assert.equal(tables.proposed_content_plans[0].payload.items[0].title,item.title);
 assert.equal((await h.POST(req({...edit,version:2,fields:{approved:true}}))).status,422);
});
test('viewers and cross-origin callers cannot generate or edit plans',async()=>{
 assert.equal((await fixture('viewer').h.POST(req({action:'generate',runId:id}))).status,403);
 const request=new Request('https://dashboard.example/api/research/proposals',{method:'POST',headers:{origin:'https://evil.example'},body:'{}'});assert.equal((await fixture().h.POST(request)).status,403);
});

test('calendar generation preserves proposal edits and rejects stale changes',async()=>{
 const {h}=fixture();const plan=await (await h.POST(req({action:'generate',runId:id}))).json();const item=plan.plan.payload.items[0];await h.POST(req({action:'edit',planId:id,version:1,itemId:item.id,fields:{title:'Preserve my title'}}));const generated=await h.POST(req({action:'calendar-generate',planId:id,version:2}));assert.equal(generated.status,200);const result=await generated.json();assert.equal(result.plan.payload.items[0].title,'Preserve my title');assert.equal(Object.keys(result.plan.calendar.dates).length,90);assert.equal((await h.POST(req({action:'calendar-generate',planId:id,version:2}))).status,409);
});


test('paid revision saves a new plan and returns its actual revised assignments',async()=>{
 const {h,tables,client}=fixture();await h.POST(req({action:'generate',runId:id}));
 const original=tables.proposed_content_plans[0];original.research_run_id=id;
 Object.assign(original.payload.items[0],{title:'medicare supplement plan j',terms:['medicare supplement plan j'],category:'High intent'});
 tables.paid_search_research.push({id:'paid',payload:{rows:[{term:'aarp medicare supplement plans',account:'MC+MFAQ',clicks:100,leads:15,sales:5}],period:{start:'2025-11-16',end:'2026-11-15'}}});
 let rpcCalls=0;client.rpc=(name,input)=>({single:async()=>{rpcCalls++;assert.equal(name,'revise_paid_proposal_plan');assert.equal(input.expected_version,1);return {data:{...original,id:'new',payload:input.revised_payload}};}});
 const response=await h.POST(req({action:'revise-paid',planId:id,version:1}));assert.equal(response.status,201);const body=await response.json();assert.equal(body.plan.id,'new');assert.match(body.plan.payload.items[0].title,/AARP/);assert.equal(original.payload.items[0].title,'medicare supplement plan j');assert.equal(rpcCalls,1);
 assert.equal((await h.POST(req({action:'revise-paid',planId:id,version:0}))).status,409);assert.equal(rpcCalls,1);
 client.rpc=()=>({single:async()=>({error:{code:'40001'}})});assert.equal((await h.POST(req({action:'revise-paid',planId:id,version:1}))).status,409);
 assert.equal((await fixture('viewer').h.POST(req({action:'revise-paid',planId:id,version:1}))).status,403);
});

test('target resolution processes bounded batches and never writes assignment edits or dates',async()=>{
 let tablesRef;const {h,tables}=fixture('analyst',{pageReader:async()=>{throw Error('unavailable');},resolutionStore:()=>({from:()=>({upsert:async rows=>{tablesRef.proposal_target_resolutions.push(...rows);return {data:rows};}})})});tablesRef=tables;
 await h.POST(req({action:'generate',runId:id}));const before=structuredClone(tables.proposed_content_plans[0]);
 const response=await h.POST(req({action:'resolve-targets',planId:id,version:1}));assert.equal(response.status,200);const d=await response.json();assert.equal(d.processed,2);assert.equal(tables.proposal_target_resolutions.length,2);assert.deepEqual(tables.proposed_content_plans[0],before);assert.equal(d.plan.targetResolutionSummary.processed,2);
 assert.equal((await h.POST(req({action:'resolve-targets',planId:id,version:0}))).status,409);
 assert.equal((await fixture('viewer').h.POST(req({action:'resolve-targets',planId:id,version:1}))).status,403);
});

 test('overlap pass saves namespaced evidence, resumes, and never rewrites plan or accepts stale requests',async()=>{
 let ref;const {h,tables}=fixture('analyst',{pageReader:async()=>{throw Error('unavailable');},resolutionStore:()=>({from:()=>({upsert:async rows=>{ref.proposal_target_resolutions.push(...rows);return {data:rows};}})})});ref=tables;
 await h.POST(req({action:'generate',runId:id}));const p=tables.proposed_content_plans[0];
 p.payload.items=p.payload.items.slice(0,3).map((i,n)=>({...i,title:['medicare plan g cost','medicare plan g benefits','medicare plan g eligibility'][n],terms:[['medicare plan g cost','medicare plan g benefits','medicare plan g eligibility'][n]],targetUrl:'https://www.medicarefaq.com/medicare-supplement-plans/plan-g'}));
 p.edits={[p.payload.items[0].id]:{notes:'Preserve this note'}};p.calendar={dates:{[p.payload.items[0].id]:'2027-01-01'},locked:[p.payload.items[0].id]};
 const before=structuredClone(p),input={action:'resolve-overlaps',planId:id,version:1};
 let response=await h.POST(req(input));assert.equal(response.status,200);let d=await response.json();assert.equal(d.processed,2);assert.equal(d.plan.overlapResolutionSummary.remaining,1);assert.ok(ref.proposal_target_resolutions.every(r=>r.item_id.startsWith('overlap:')));
 response=await h.POST(req(input));d=await response.json();assert.equal(d.processed,1);assert.equal(d.plan.overlapResolutionSummary.remaining,0);assert.equal(d.plan.overlapResolutionSummary.cleared,0);assert.deepEqual(p,before);
 assert.equal((await h.POST(req({...input,version:0}))).status,409);assert.equal((await h.POST(req({...input,pairKey:'invalid'}))).status,422);
 assert.equal((await fixture('viewer').h.POST(req(input))).status,403);
 });
test('repair action commits supported improvements through atomic RPC and keeps original plan intact',async()=>{
 const url='https://www.medicarefaq.com/medicare-supplement-plans/plan-n',term='medicare plan n cost';let ref;
 const {h,tables,client}=fixture('analyst',{pageReader:async()=>({url,html:'<title>Medicare Plan N cost</title><main>'+('Medicare Plan N cost depends on age and location. '.repeat(15))+'</main>'}),resolutionStore:()=>({from:()=>({upsert:async rows=>{ref.proposal_target_resolutions.push(...rows);return {data:rows};}})})});ref=tables;
 await h.POST(req({action:'generate',runId:id}));const original=tables.proposed_content_plans[0];original.payload.items=[{...original.payload.items[0],title:'Unknown old topic',terms:['unknown old topic'],category:'High intent',targetUrl:''}];
 tables.research_runs[0].payload={inventory:{pages:[{url,title:'Medicare Plan N cost',headings:[],status:'read'}]},evidence:{gsc:{rows:[{keys:[term,url],impressions:100}]}}};
 const before=structuredClone(original);let calls=0;client.rpc=(name,input)=>({single:async()=>{calls++;assert.equal(name,'repair_calendar_plan');assert.equal(input.changes.length,1);const saved={...original,id:'22222222-2222-4222-8222-222222222222',payload:{...original.payload,items:[input.changes[0].item]}};tables.proposed_content_plans.push(saved);return {data:saved};}});
 const response=await h.POST(req({action:'repair-calendar',planId:id,version:1}));assert.equal(response.status,201);const body=await response.json();assert.equal(body.repairSummary.changed,1);assert.equal(body.plan.payload.items[0].terms[0],term);assert.deepEqual(original,before);assert.equal(calls,1);
 assert.equal((await fixture('viewer').h.POST(req({action:'repair-calendar',planId:id,version:1}))).status,403);
 assert.equal((await h.POST(req({action:'undo-repair',planId:id,version:1,repairId:'missing'}))).status,422);
});

test('focused targeting commits evidence through undo-capable RPC and enforces version, role and origin',async()=>{
 const url='https://www.medicarefaq.com/faqs/medigap-pricing',term='medicare supplement rates by age';
 const {h,tables,client}=fixture('analyst',{pageReader:async()=>({url,html:'<title>Medigap pricing by age</title><main>'+('Medigap pricing by age depends on age and rating methods. '.repeat(15))+'</main>'})});
 await h.POST(req({action:'generate',runId:id}));const original=tables.proposed_content_plans[0];original.payload.items=[{...original.payload.items[0],title:term,terms:[term],category:'High intent',targetUrl:''}];original.calendar={dates:{[original.payload.items[0].id]:'2027-01-01'}};
 tables.research_runs[0].payload={inventory:{pages:[{url,title:'Medigap pricing by age',headings:[],status:'read'}]}};
 const before=structuredClone(original);let calls=0;client.rpc=(name,input)=>({single:async()=>{calls++;assert.equal(name,'repair_calendar_plan');assert.equal(input.changes[0].item.targetDecision.kind,'Existing-page update');assert.ok(input.changes[0].evidence.page.excerpt);const saved={...original,id:'22222222-2222-4222-8222-222222222222',payload:{...original.payload,items:[input.changes[0].item]}};tables.proposed_content_plans.push(saved);return {data:saved};}});
 const response=await h.POST(req({action:'focused-targets',planId:id,version:1}));assert.equal(response.status,201);const body=await response.json();assert.equal(body.plan.qualityAudit.flagged,0);assert.equal(body.plan.focusedSummary.pending,0);assert.deepEqual(original,before);assert.equal(calls,1);
 assert.equal((await h.POST(req({action:'focused-targets',planId:id,version:0}))).status,409);assert.equal(calls,1);
 assert.equal((await fixture('viewer').h.POST(req({action:'focused-targets',planId:id,version:1}))).status,403);
 assert.equal((await h.POST(new Request('https://dashboard.example/api/research/proposals',{method:'POST',headers:{origin:'https://evil.example'},body:JSON.stringify({action:'focused-targets',planId:id,version:1})}))).status,403);
});

test('wider resolution saves calendar review evidence and enforces version role and origin',async()=>{
 const url='https://www.medicarefaq.com/faqs/medigap-pricing',term='medicare supplement rates by age';
 const {h,tables,client}=fixture('analyst',{pageReader:async()=>({url,html:'<title>Medigap pricing by age</title><main>'+('Medigap pricing by age depends on age and rating methods. '.repeat(15))+'</main>'})});
 await h.POST(req({action:'generate',runId:id}));const original=tables.proposed_content_plans[0];original.payload.items=[{...original.payload.items[0],title:term,terms:[term],category:'AI citations',targetUrl:''}];original.calendar={dates:{[original.payload.items[0].id]:'2027-01-01'}};
 tables.research_runs[0].payload={inventory:{pages:[{url,title:'Medigap pricing by age',headings:[],status:'read'}]}};
 const before=structuredClone(original);let calls=0;client.rpc=(name,input)=>({single:async()=>{calls++;assert.equal(name,'repair_calendar_plan');assert.equal(input.changes[0].item.targetDecision.kind,'Existing-page update');assert.ok(input.changes[0].evidence.page.excerpt);assert.equal(input.changes[0].evidence.finalCalendarReview.assignments,1);const saved={...original,id:'22222222-2222-4222-8222-222222222222',payload:{...original.payload,items:[input.changes[0].item]}};tables.proposed_content_plans.push(saved);return {data:saved};}});
 const response=await h.POST(req({action:'wider-scope',planId:id,version:1}));assert.equal(response.status,201);const body=await response.json();assert.equal(body.plan.qualityAudit.flagged,0);assert.equal(body.plan.widerScopeSummary.pending,0);assert.deepEqual(original,before);assert.equal(calls,1);
 assert.equal((await h.POST(req({action:'wider-scope',planId:id,version:0}))).status,409);assert.equal(calls,1);
 assert.equal((await fixture('viewer').h.POST(req({action:'wider-scope',planId:id,version:1}))).status,403);
 assert.equal((await h.POST(new Request('https://dashboard.example/api/research/proposals',{method:'POST',headers:{origin:'https://evil.example'},body:JSON.stringify({action:'wider-scope',planId:id,version:1})}))).status,403);
});
