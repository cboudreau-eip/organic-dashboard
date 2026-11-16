import test from 'node:test';import assert from 'node:assert/strict';
import {overlapPairs,resolveOverlap,currentOverlap,applyOverlapResolutions} from '../lib/research/overlap-resolution.js';
const url='https://www.medicarefaq.com/medicare-supplement-plans/plan-g',now=new Date('2026-11-16T18:00:00Z');
function plan(code='shared-page'){
 const items=['cost','benefits'].map((term,n)=>({id:String(n),title:'Medicare supplement plan g '+term,terms:['Medicare supplement plan g '+term],targetUrl:url,action:'Review '+term,notes:'',edited:n===0,quality:{flags:[{code,related:[String(1-n)]},{code:'target-scope',related:[]}],candidates:[]}}));
 return {payload:{items},calendar:{dates:{0:'2027-01-01',1:'2027-01-02'},locked:['0']},qualityAudit:{}};
}
const html='<title>Medicare Supplement Plan G</title><main>'+['cost','benefits'].map(x=>`<h2>Medicare supplement plan g ${x}</h2><p>${('Medicare supplement plan g '+x+' information is described here for readers investigating this specific topic. ').repeat(5)}</p>`).join('')+'</main>';
async function record(p){const pair=overlapPairs(p)[0];return {item_id:pair.key,fingerprint:pair.fingerprint,result:await resolveOverlap(pair,async()=>({url,html}),now)};}
test('separate supported sections clear only their shared-page flags, preserve manual work and locked dates',async()=>{
 const p=plan(),before=structuredClone(p),r=await record(p);assert.equal(r.result.clear,true);
 const out=applyOverlapResolutions(p,[r],+now);assert.equal(out.overlapResolutionSummary.cleared,1);
 assert.deepEqual(out.payload.items[0].quality.flags.map(f=>f.code),['target-scope']);assert.deepEqual(p,before);assert.deepEqual(out.calendar,p.calendar);assert.equal(out.payload.items[0].action,p.payload.items[0].action);
});
test('intent overlap stays open even with two matching sections',async()=>{const p=plan('intent-overlap'),r=await record(p);assert.equal(r.result.clear,false);assert.match(r.result.status,/Possible duplicate/);assert.equal(applyOverlapResolutions(p,[r],+now).qualityAudit.overlap,2);});
test('broad work, unreadable pages and same section do not clear flags',async()=>{
 const p=plan();p.payload.items[0].action='Review costs and benefits';assert.equal((await record(p)).result.clear,false);
 const pair=overlapPairs(plan())[0];assert.equal((await resolveOverlap(pair,async()=>{throw Error('timeout')},now)).clear,false);
 assert.equal((await resolveOverlap(pair,async()=>({url,html:html.replaceAll('benefits','cost')}),now)).clear,false);
});
test('either assignment edit, target change, stale or future evidence forces recheck',async()=>{
 const p=plan(),r=await record(p);assert.ok(currentOverlap(overlapPairs(p)[0],r,+now));
 for(const field of ['title','action','notes','targetUrl']){const copy=structuredClone(p);copy.payload.items[1][field]+=' changed';assert.equal(currentOverlap(overlapPairs(copy)[0],r,+now),null);}
 assert.equal(currentOverlap(overlapPairs(p)[0],r,+now+8*86400000),null);assert.equal(currentOverlap(overlapPairs(p)[0],r,+now-86400000),null);
});
test('one supported pair cannot clear an unresolved relationship in a larger group',async()=>{
 const p=plan(),r=await record(p);p.payload.items.push({...structuredClone(p.payload.items[1]),id:'2'});p.payload.items[0].quality.flags.push({code:'shared-page',related:['2']});
 const out=applyOverlapResolutions(p,[r],+now);assert.ok(out.payload.items[0].quality.flags.some(f=>f.related?.includes('2')));assert.equal(out.overlapResolutionSummary.remaining,1);
});
