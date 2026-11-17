import test from 'node:test';import assert from 'node:assert/strict';
import {verifyFocusedTarget,focusTargets,currentFocusedDecision,applyFocusedDecisions,newPageEvidence,focusedFingerprint} from '../lib/research/focused-targets.js';
import {publicProposalPlan} from '../lib/research/proposals.js';
import {auditProposalPlan} from '../lib/research/proposal-audit.js';
const url='https://www.medicarefaq.com/faqs/medigap-pricing',term='Medicare supplement rates by age';
const text='Medigap pricing methods include attained age and issue age. Your Medigap rates and premiums depend on age and location. '.repeat(8);
const page={url,title:'Medigap pricing methods by age',text,status:'read',fetchedAt:new Date().toISOString(),headings:[]};
const item={id:'one',title:term,terms:[term],action:'Review costs',targetUrl:'',category:'High intent',notes:'',evidence:{gsc:[{keys:[term,url],impressions:80}],semrush:[],otterly:[]}};
test('focused verification handles cost synonyms while rejecting narrow or wrong-entity targets',()=>{
 assert.ok(verifyFocusedTarget(item,page));assert.equal(verifyFocusedTarget(item,{...page,title:'Medigap rates in Florida'}),null);assert.equal(verifyFocusedTarget(item,{...page,title:'Anesthesia coverage for surgery'}),null);assert.equal(verifyFocusedTarget(item,{...page,status:'unavailable'}),null);assert.equal(verifyFocusedTarget({...item,terms:['Medicare plan g costs']},{...page,title:'Medicare Plan N costs',text:'Medicare Plan G costs '.repeat(50)}),null);
});
test('focused pass saves real assignment changes and decision evidence, protects manual edits and invalidates changed scope',async()=>{
 const original={id:'plan',payload:{items:[item,{...item,id:'manual'}]},edits:{manual:{notes:'Do not touch'}},calendar:{dates:{one:'2027-01-01',manual:'2027-01-02'}}},before=structuredClone(original),source={inventory:{pages:[page]},evidence:{}};
 const reviewed=auditProposalPlan(publicProposalPlan(original),[page]);
 const r=await focusTargets(original,reviewed,source,null,{},async()=>({url,html:`<title>${page.title}</title><main>${text}</main>`}));
 assert.equal(r.changes.length,1);assert.equal(r.changes[0].item.targetUrl,url);assert.equal(r.changes[0].item.targetDecision.kind,'Existing-page update');assert.ok(r.changes[0].evidence.checks[0].evidence.excerpt);assert.deepEqual(original,before);
 const visible=publicProposalPlan({...original,payload:{items:[r.changes[0].item]}}).payload.items[0];assert.ok(currentFocusedDecision(visible));assert.equal(currentFocusedDecision({...visible,notes:'changed'}),null);assert.equal(currentFocusedDecision({...visible,targetUrl:url+'/other'}),null);
 assert.equal(currentFocusedDecision(visible,Date.now()+8*86400000),null);
 const ready=applyFocusedDecisions(auditProposalPlan({payload:{items:[visible]}},[page]));assert.equal(ready.qualityAudit.flagged,0);
});
test('new-page decisions require observed demand, a distinct missing entity and successful related-page checks',()=>{
 const usaa={...item,terms:['usaa medicare supplement'],evidence:{semrush:[{keyword:'usaa medicare supplement',volume:100}]}},inventory=Array.from({length:20},(_,n)=>({...page,url:url+n})),checks=Array.from({length:3},()=>({status:'read',supported:false}));
 assert.ok(newPageEvidence(usaa,inventory,checks));assert.equal(newPageEvidence({...usaa,evidence:{}},inventory,checks),null);assert.equal(newPageEvidence(usaa,inventory,[...checks,{status:'unavailable'}]),null);assert.equal(newPageEvidence(item,inventory,checks),null);
 assert.equal(newPageEvidence({...usaa,evidence:item.evidence},inventory,checks),null);
});
test('uncertain decisions remain flagged and new-page support never clears overlap flags',()=>{
 const i={...item,targetDecision:{kind:'Needs research',checkedAt:new Date().toISOString()}};i.targetDecision.fingerprint=focusedFingerprint(i);
 const p=applyFocusedDecisions(auditProposalPlan({payload:{items:[i]}},[page]));assert.equal(p.qualityAudit.flagged,1);
 const n={...i,targetDecision:{...i.targetDecision,kind:'New-page proposal',gap:{missingEntities:['usaa']},checks:Array.from({length:3},()=>({status:'read',supported:false}))}};
 const result=applyFocusedDecisions({payload:{items:[{...n,quality:{flags:[{code:'target-unassigned'},{code:'intent-overlap'}]}}]},qualityAudit:{}});assert.deepEqual(result.payload.items[0].quality.flags,[{code:'intent-overlap'}]);
});
