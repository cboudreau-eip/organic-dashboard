import test from 'node:test';import assert from 'node:assert/strict';
import {finalScopePass,finalScopeSummary,directionSupported,finalScopeOverlap} from '../lib/research/final-scope.js';
import {publicProposalPlan} from '../lib/research/proposals.js';
const url='https://www.medicarefaq.com/faqs/medigap-pricing',term='Medicare supplement rates by age';
const text='Medigap pricing methods include attained age and issue age. Your Medigap rates and premiums depend on age and location. '.repeat(8);
const page={url,title:'Medigap pricing methods by age',headings:[]};
const base={id:'one',title:'Unsupported mystery topic',terms:['Unsupported mystery topic'],action:'Review',targetUrl:'',category:'AI citations',notes:'',basis:'Observed opportunity',evidence:{gsc:[],semrush:[],otterly:[]}};
const read=async()=>({url,html:'<title>'+page.title+'</title><main>'+text+'</main>'});
const review=p=>({...publicProposalPlan(p),payload:{items:publicProposalPlan(p).payload.items.map(i=>({...i,quality:{flags:i.id==='one'?[{code:'target-unassigned'}]:[]}}))}});
test('final pass replaces only with a monitored prompt and live evidence, preserving original data',async()=>{
 const p={payload:{items:[base]},edits:{},calendar:{dates:{one:'2027-01-01'}}},before=structuredClone(p),source={inventory:{pages:[page]},evidence:{otterly:{prompts:[{id:'p',prompt:term}]}}};
 const r=await finalScopePass(p,review(p),source,null,{},read);
 assert.equal(r.changes.length,1);assert.equal(r.changes[0].item.targetUrl,url);assert.equal(r.changes[0].item.scopePass.kind,'Monitored replacement');assert.equal(r.changes[0].item.evidence.otterly[0].id,'p');assert.deepEqual(p,before);
 const saved={...p,payload:{items:[r.changes[0].item]}};assert.equal(finalScopeSummary(review(saved)).pending,0);
});
test('shortfalls remain flagged, do not mutate old decisions, and manual edits are protected',async()=>{
 const p={payload:{items:[{...base,targetDecision:{kind:'Needs research',fingerprint:'old'}}]},edits:{}},before=structuredClone(p);
 const r=await finalScopePass(p,review(p),{inventory:{pages:[]}},null,{},read);
 assert.equal(r.changes[0].item.scopePass.kind,'Evidence shortfall');assert.equal(r.changes[0].item.targetDecision.kind,'Needs research');assert.deepEqual(p,before);
 p.edits={one:{notes:'Mine'}};assert.equal((await finalScopePass(p,review(p),{},null,{},read)).changes.length,0);
});
test('linked question moves require a replacement and retain evidence on both changes',async()=>{
 const owner={...base,id:'owner',title:term,terms:[term],targetUrl:url},slot={...base,title:term,terms:[term]},otherUrl='https://www.medicarefaq.com/faqs/part-d',otherTerm='Medicare Part D drug costs',otherPage={url:otherUrl,title:otherTerm,headings:[]};
 const p={payload:{items:[slot,owner]},edits:{}},source={inventory:{pages:[page,otherPage]},evidence:{otterly:{prompts:[{id:'replacement',prompt:otherTerm}]}}};
 const reader=async u=>u===url?read():({url:otherUrl,html:'<title>'+otherTerm+'</title><main>'+('Medicare Part D drug costs explained. '.repeat(30))+'</main>'});
 const r=await finalScopePass(p,review(p),source,null,{},reader);
 assert.equal(r.changes.length,2);assert.equal(r.changes[0].evidence.undoGroup,r.changes[1].evidence.undoGroup);assert.equal(r.changes[1].item.scopeQuestions[0].prompt,term);assert.ok(r.changes[1].item.scopeQuestions[0].evidence.excerpt);
 const noReplacement=await finalScopePass(p,review(p),{...source,evidence:{}},null,{},reader);assert.equal(noReplacement.changes.length,1);assert.equal(noReplacement.changes[0].item.scopePass.kind,'Evidence shortfall');
});
test('directional switches cannot use evidence for the reverse direction',()=>{
 assert.equal(directionSupported('Switch from Medicare Advantage to Medigap without underwriting','Switch from Medigap to Medicare Advantage'),false);
 assert.equal(directionSupported('Switch from Medicare Advantage to Medigap without underwriting','Switch from Medicare Advantage to Medigap without underwriting'),true);
});

test('replacement overlap guard recognizes conversational comparison questions',()=>{assert.equal(finalScopeOverlap({terms:['How can I compare Medicare Advantage versus Medigap coverage?']},{terms:['medicare advantage vs supplement']}),true);});
