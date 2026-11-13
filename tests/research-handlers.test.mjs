import test from 'node:test';
import assert from 'node:assert/strict';
import {researchHandlers} from '../lib/research/handlers.js';
import {DEFAULTS} from '../lib/research/contracts.js';
const id='11111111-1111-4111-8111-111111111111';
const req=(input,origin='https://dashboard.example')=>new Request('https://dashboard.example/api/research',{method:'POST',headers:{origin,'Content-Type':'application/json'},body:JSON.stringify(input)});
function fixture(role='analyst'){
 const tables={research_settings:[],research_runs:[],research_reviews:[],research_evidence_chunks:[]};
 const client={from(table){let values,insert=false,filters=[],single=false;const chain={select(){return chain;},order(){return chain;},limit(){return chain;},eq(k,v){filters.push([k,v]);return chain;},insert(v){values=v;insert=true;return chain;},update(v){values=v;return chain;},single(){single=true;return finish();},maybeSingle(){single=true;return finish();},then(ok,bad){return Promise.resolve(finish()).then(ok,bad);}};
 function finish(){const rows=tables[table];let found=rows.filter(r=>filters.every(([k,v])=>r[k]===v));if(values){if(insert){if(rows.some(r=>(values.key&&r.key===values.key)||(values.id&&r.id===values.id)))return {error:{code:'23505'}};const row={id,stage:'gsc',status:'running',created_at:new Date().toISOString(),...values,version:1};rows.push(row);found=[row];}else{for(const row of found)Object.assign(row,values,{version:row.version+1});}}return {data:single?found[0]||null:found};}return chain;}};
 return {tables,handlers:researchHandlers({origin:()=> 'https://dashboard.example',access:async action=>{if(role==='outsider'||role==='viewer'&&action==='run')throw Object.assign(Error('No access'),{status:403});return {client,role};},adapters:()=>({gsc:async()=>({rows:[],status:'available'})})})};
}
test('research settings and runs persist, with conflict checks and server-held settings',async()=>{
 const {handlers:h,tables}=fixture();
 assert.equal((await h.POST(req({action:'start'}))).status,422);
 assert.equal((await h.POST(req({action:'settings',settings:DEFAULTS,version:0}))).status,200);
 assert.equal((await h.POST(req({action:'settings',settings:DEFAULTS,version:0}))).status,409);
 const r=await (await h.POST(req({action:'start',settings:{malicious:true}}))).json();
 assert.deepEqual(r.run.settings,DEFAULTS);
 assert.equal((await h.POST(req({action:'step',runId:id,version:0}))).status,409);
 assert.equal((await h.POST(req({action:'step',runId:id,version:1}))).status,200);
 assert.equal(tables.research_runs[0].stage,'posthog');
 const view=await (await h.GET(new Request('https://dashboard.example/api/research'))).json();assert.equal(view.run.version,2);assert.equal(view.run.sources.gsc.rows,undefined);
 assert.equal((await h.POST(req({action:'review',runId:id,key:'abcdefabcdefabcdefabcdef',decision:'Keep',reason:'',version:0}))).status,422);
});
test('research writes require authorized role, same origin and bounded valid inputs',async()=>{
 const {handlers:h}=fixture();
 assert.equal((await h.POST(req({action:'start'},'https://evil.example'))).status,403);
 assert.equal((await fixture('viewer').handlers.POST(req({action:'start'}))).status,403);
 assert.equal((await fixture('outsider').handlers.GET(new Request('https://dashboard.example/api/research'))).status,403);
 assert.equal((await h.POST(req({action:'settings',settings:{...DEFAULTS,start:'2027-02-30'},version:0}))).status,422);
 assert.equal((await h.POST(req({action:'settings',junk:'x'.repeat(17000)}))).status,413);
 assert.equal((await h.GET(new Request('https://dashboard.example/api/research?run=oops'))).status,400);
});
