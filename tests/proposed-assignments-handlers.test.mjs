import test from 'node:test';import assert from 'node:assert/strict';import {proposalHandlers} from '../lib/research/proposal-handlers.js';import {DEFAULTS} from '../lib/research/contracts.js';
const id='11111111-1111-4111-8111-111111111111';
const req=x=>new Request('https://dashboard.example/api/research/proposals',{method:'POST',headers:{origin:'https://dashboard.example'},body:JSON.stringify(x)});
function fixture(role='analyst'){
 const tables={research_runs:[{id,status:'complete',settings:DEFAULTS,payload:{}}],proposed_content_plans:[]};
 const client={from(table){let values,insert=false,filters=[],single=false;const chain={select(){return chain;},order(){return chain;},limit(){return chain;},eq(k,v){filters.push([k,v]);return chain;},insert(v){values=v;insert=true;return chain;},update(v){values=v;return chain;},single(){single=true;return finish();},maybeSingle(){single=true;return finish();},then(ok,bad){return Promise.resolve(finish()).then(ok,bad);}};function finish(){const rows=tables[table];let found=rows.filter(r=>filters.every(([k,v])=>r[k]===v));if(values){if(insert){const row={id,version:1,edits:{},...values};rows.push(row);found=[row];}else for(const row of found)Object.assign(row,values,{version:row.version+1});}return {data:single?found[0]||null:found};}return chain;}};
 return {tables,h:proposalHandlers({origin:()=> 'https://dashboard.example',access:async action=>{if(role==='outsider'||role==='viewer'&&action==='run')throw Object.assign(Error('No access'),{status:403});return {client,role};}})};
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
