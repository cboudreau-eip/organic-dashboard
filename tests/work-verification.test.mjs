import test from 'node:test';import assert from 'node:assert/strict';
import {outstandingItems,verifyVerdicts,validatedVerification,correctedAssessment,annotationVerdict,isAnnotationCheck} from '../lib/work-queue/verification.js';
const page={id:'o',kind:'official',url:'https://www.medicare.gov/example',fetchedAt:'2026-11-23',passages:[{id:'op1',text:'Qualifying conditions apply.'}]};
const parent={id:'parent',payload:{target:'https://www.medicarefaq.com/faqs/example',sources:[],warnings:[],sourceDates:{},result:{summary:'Old',changes:[{section:'Eligibility',change:'Original uncertain instruction',why:'Check facts',needsVerification:true,evidence:[]}],checks:['Check trial rights'],outline:['Old unverified claim'],preserve:['Page structure'],links:[]}}};
test('partial resolutions separate usable instructions and preserve unanswered questions across retries',()=>{
 const items=outstandingItems(parent.payload),proposed={items:items.map(i=>({id:i.id,status:'Partially resolved',evidenceType:'Factual rule',instruction:'Separate timing from eligibility.',remainingQuestion:'Which state protection applies?',reason:'Federal guidance supports the narrower change.',evidenceIds:['op1']}))};
 const v=verifyVerdicts(proposed,items,[page]),reviews=verifyVerdicts({items:items.map(i=>({id:i.id,supported:true,reason:'Narrow instruction supported.',evidenceIds:['op1']}))},v,[page],true);
 const saved=correctedAssessment(parent,v,reviews,[page],[]);assert.equal(outstandingItems(saved).length,2);assert.match(saved.brief,/### Ready to implement/);assert.match(saved.brief,/### Unresolved — do not use as claims/);assert.match(saved.brief,/Which state protection/);assert.equal(saved.result.changes[0].needsVerification,false);
 const target={...page,kind:'target'};const observation=verifyVerdicts({items:proposed.items.map(i=>({...i,evidenceType:'Page observation'}))},items,[target]);assert.equal(observation[0].status,'Unresolved');assert.equal(verifyVerdicts(proposed,items,[target])[0].status,'Unresolved');
 const rejected=correctedAssessment(parent,v,reviews.map(r=>({...r,supported:false})),[page],[]);assert.ok(!rejected.brief.split('### Unresolved')[0].includes('Separate timing from eligibility.'));
});
test('malformed verification gets one bounded repair without weakening evidence validation',async()=>{
 const items=outstandingItems(parent.payload);let calls=0;
 const good={items:items.map(i=>({id:i.id,status:'Unresolved',instruction:'Verify conditions.',reason:'Insufficient evidence.',evidenceIds:[]}))};
 const result=await validatedVerification(async feedback=>{calls++;if(calls===1)return {items:[]};assert.match(feedback,/Incomplete/);return good;},items,[page]);
 assert.equal(calls,2);assert.ok(result.every(i=>i.status==='Unresolved'));
 calls=0;await assert.rejects(()=>validatedVerification(async()=>{calls++;return {items:[]};},items,[page]),e=>e.assessmentStage==='verification decisions format repair');assert.equal(calls,2);
});
test('annotation check uses a complete page read and never clears a missing or truncated read',()=>{const item={id:'check:4',question:'Are internal passage IDs visible in user-facing prose?'};assert.equal(isAnnotationCheck(item),true);assert.equal(annotationVerdict(item,{text:'Clean article',url:page.url},'now').status,'Supported');assert.equal(annotationVerdict(item,{text:'See targetp15',url:page.url},'now').status,'Correction needed');assert.equal(annotationVerdict(item,{text:'x'.repeat(18000)},'now').status,'Unresolved');assert.equal(annotationVerdict(item,null,'now').status,'Unresolved');});
test('corrected brief avoids repeating long original questions and fits the editor',()=>{
 const verdicts=Array.from({length:9},(_,i)=>({id:'check:'+i,section:'Publication check',question:'Original long question '.repeat(50),status:'Unresolved',reason:'Unverified detail '.repeat(60),instruction:'Verify first',evidence:[]}));
 const saved=correctedAssessment(parent,verdicts,[],[],[]);assert.ok(saved.brief.length+640<20000);assert.ok(!saved.brief.includes('Original long question'));assert.equal(saved.verification.items[0].question,verdicts[0].question);
});
test('verification requires complete item coverage and exact official evidence; independent rejection keeps a flag',()=>{
 const items=outstandingItems(parent.payload);assert.equal(items.length,2);
 const proposed={items:items.map(i=>({...i,status:'Correction needed',instruction:'Explain qualifying conditions.',reason:'Source supplies conditions.',evidenceIds:['op1']}))};
 assert.throws(()=>verifyVerdicts({items:proposed.items.slice(0,1)},items,[page]),/Incomplete/);
 assert.throws(()=>verifyVerdicts({items:proposed.items.map(i=>({...i,evidenceIds:['fake']}))},items,[page]),/Invented/);
 const noAuthority=verifyVerdicts(proposed,items,[{...page,kind:'target'}]);assert.ok(noAuthority.every(i=>i.status==='Unresolved'));
 const verdicts=verifyVerdicts(proposed,items,[page]);
 const reviews=verifyVerdicts({items:items.map((i,index)=>({id:i.id,supported:index===0,reason:index?'Conditions remain incomplete.':'Supported.',evidenceIds:['op1']}))},items,[page],true);
 const before=JSON.stringify(parent),saved=correctedAssessment(parent,verdicts,reviews,[page],[]);
 assert.equal(JSON.stringify(parent),before);assert.equal(saved.result.changes[0].needsVerification,false);assert.equal(saved.result.changes[0].change,'Explain qualifying conditions.');assert.equal(saved.verification.parentAssessmentId,'parent');assert.equal(outstandingItems(saved).length,1);assert.equal(outstandingItems(saved)[0].id,'check:0');assert.ok(!saved.brief.includes('Old unverified claim'));assert.match(saved.brief,/Unresolved/);
 const retried=correctedAssessment({id:'second',payload:saved},[verdicts[1]],[{...reviews[1],supported:true}],[page],[]);assert.equal(retried.verification.items.length,2);assert.equal(outstandingItems(retried).length,0);assert.equal(retried.result.changes[0].change,'Explain qualifying conditions.');
});
