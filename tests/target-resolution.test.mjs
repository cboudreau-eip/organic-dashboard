import test from 'node:test';import assert from 'node:assert/strict';
import {resolveTarget,verifyTarget,targetFingerprint,currentResolution,applyTargetResolutions} from '../lib/research/target-resolution.js';
const url='https://www.medicarefaq.com/medicare-supplement-plans/plan-g';
const item={id:'one',title:'Medicare supplement plan g cost',terms:['medicare supplement plan g cost'],action:'Review pricing',notes:'Keep my notes',targetUrl:url,quality:{flags:[{code:'target-weak-match',message:'Check target',related:[]},{code:'shared-page',message:'Coordinate',related:['two']}],candidates:[]}};
const now=new Date('2026-11-16T12:00:00Z');
const text='Medicare Supplement Plan G costs depend on your age and location. Compare Medicare Supplement Plan G premiums with identical quote inputs. '.repeat(5);
const html=`<title>Medicare Supplement Plan G Costs</title><main><h1>Medicare Supplement Plan G costs</h1><p>${text}</p></main>`;
test('live evidence can clear only supported current-target checks, preserving work and coordination flags',async()=>{
 const original=structuredClone(item);const result=await resolveTarget(item,[],async()=>({url,html}),now);
 assert.equal(result.status,'Current target supported');assert.ok(result.recommendation.excerpt.includes('Plan G'));
 const record={item_id:item.id,fingerprint:targetFingerprint(item),result};
 const plan={payload:{items:[item]},calendar:{dates:{one:'2027-01-01'},status:'Tentative'},qualityAudit:{}};
 const out=applyTargetResolutions(plan,[record],+now);assert.deepEqual(item,original);assert.deepEqual(out.calendar,plan.calendar);assert.equal(out.payload.items[0].action,item.action);assert.deepEqual(out.payload.items[0].quality.flags.map(f=>f.code),['shared-page']);
 assert.equal(currentResolution({...item,action:'Changed scope'},record,+now),null);assert.equal(currentResolution(item,record,+now+8*86400000),null);
});
test('recommendations do not assign missing targets or clear their flags without acceptance',async()=>{
 const i={...item,targetUrl:'',quality:{flags:[{code:'target-unassigned',related:[]}],candidates:[{url}]}};
 const result=await resolveTarget(i,[],async()=>({url,html}),now);assert.equal(result.status,'Recommended target ready');
 const out=applyTargetResolutions({payload:{items:[i]},qualityAudit:{}},[{item_id:i.id,fingerprint:targetFingerprint(i),result}],+now);assert.equal(out.payload.items[0].targetUrl,'');assert.equal(out.payload.items[0].quality.flags.length,1);
});
test('failed retrieval, generic text and wrong plan cannot resolve a target',async()=>{
 const r=await resolveTarget(item,[],async()=>{throw Error('timeout');},now);assert.equal(r.status,'More research needed');assert.equal(r.recommendation,null);
 const p={url,status:'read',title:'Plan N',headings:['Plan N'],text:text.replaceAll('Plan G','Plan N')};assert.equal(verifyTarget(item,p),null);
 assert.equal(verifyTarget(item,{...p,url:'https://evil.example/'}),null);
});
test('multiple supported alternatives remain ambiguous; unsafe source URLs are never requested',async()=>{
 const second=url+'-guide',i={...item,targetUrl:'',quality:{flags:[],candidates:[{url},{url:second},{url:'https://evil.example/'}]}};const seen=[];
 const r=await resolveTarget(i,[],async u=>{seen.push(u);return {url:u,html};},now);assert.equal(r.status,'Multiple supported pages — choose scope');assert.equal(r.recommendation,null);assert.ok(seen.every(u=>u.startsWith('https://www.medicarefaq.com/')));
});

test('narrower plan pages cannot establish coverage for a broad assignment',()=>{
 const broad={...item,title:'medicare supplement cost',terms:['medicare supplement cost']};assert.equal(verifyTarget(broad,{url,status:'read',title:'Medicare Supplement Plan G Costs',headings:['Plan G'],text}),null);
 const f={...item,terms:['medicare plan f benefits']};assert.equal(verifyTarget(f,{url:url+'-high-deductible',status:'read',title:'High deductible Medicare Plan F',headings:[],text:text.replaceAll('Plan G','Plan F')}),null);
});
