import test from 'node:test';
import assert from 'node:assert/strict';
import {applyResolution,blockersFor,sourceAuthority} from '../lib/research/resolution.js';
import {resolveAssignment,resolutionCandidates} from '../lib/research/resolution-sources.js';
const url='https://www.medicarefaq.com/medicare-supplement-plans/plan-g';
const a={targetUrl:null,topics:[{key:'one',title:'Compare Plan G costs',terms:[],evidence:{}}],candidateUrls:[url],coverage:{inventoryComplete:false},result:{readiness:'Needs research',checks:[],verification:{verdicts:[]}}};
const page={id:'own1',kind:'own',url,passages:[{id:'own1p1',text:'Compare Plan G using the same applicant profile and rating method.'}]};
const finding={topicKey:'one',judgement:'covered',observation:'The page directly answers the comparison question.',task:'No change needed',passageId:'own1p1'};
const output=f=>({summary:'Existing comparison guidance answers the question.',effort:'Small',findings:[f],optionalChecks:['Consider whether navigation could make this easier to find.']});
const verdict=f=>({...f,support:'supported',qualifications:'preserved',overlap:'distinct',factualConcern:'none',authorityType:'none',authorityPassageId:null,reason:'The cited comparison guidance answers the question with its qualifications.'});
test('positive coverage resolves an unmapped candidate despite incomplete inventory, without certifying facts',()=>{
 const r=applyResolution(a,output(finding),output(verdict(finding)),[page],{});
 assert.equal(r.readiness,'No change suggested');assert.equal(r.verifiedTarget,url);assert.equal(r.resolution.blockers.length,0);assert.equal(r.resolution.optionalChecks.length,1);assert.equal(a.targetUrl,null);
 assert.equal(applyResolution(a,output(finding),output(verdict({...finding,task:'No change needed.'})),[page],{}).findings[0].task,'No change needed');
 const coverageOnly=applyResolution(a,output(finding),output({...verdict(finding),authorityType:'rule'}),[page],{});assert.equal(coverageOnly.readiness,'No change suggested');assert.equal(coverageOnly.verification.verdicts[0].authority,'not applicable');
});
test('independent reviewer can reject duplicate proposed work but cannot invent a replacement task',()=>{
 const proposed={...finding,judgement:'improve',task:'Add a comparison checklist.'};
 const r=applyResolution(a,output(proposed),output(verdict(finding)),[page],{});assert.equal(r.readiness,'No change suggested');assert.deepEqual(r.resolution.changedTopics,['one']);
 assert.throws(()=>applyResolution(a,output(proposed),output(verdict({...proposed,task:'Invent a different assignment.'})),[page],{}),/replacement/);
});
test('factual conflicts, unsupported changes and duplicate coverage remain blocked',()=>{
 for(const change of [{factualConcern:'conflict'},{support:'unsupported'},{qualifications:'changed'}]){const r=applyResolution(a,output(finding),output({...verdict(finding),...change}),[page],{});assert.equal(r.readiness,'Needs research');assert.ok(r.resolution.blockers.length);}
 const f={...finding,judgement:'improve',task:'Add comparison steps.'};const r=applyResolution(a,output(f),output({...verdict(f),overlap:'covered elsewhere'}),[page],{});assert.equal(r.readiness,'Needs research');assert.equal(r.resolution.blockers[0].code,'overlap');
});
test('rule changes require supplied authoritative passages and cannot use a commercial host',()=>{
 const f={...finding,judgement:'improve',task:'Correct the eligibility deadline.'},v={...verdict(f),authorityType:'rule',authorityPassageId:'officialp1'};
 for(const host of ['publisher.example','medicare.gov.evil.example']){const r=applyResolution(a,output(f),output(v),[page,{id:'official',kind:'search',url:'https://'+host,passages:[{id:'officialp1',text:'Official eligibility details.'}]}],{});assert.equal(r.readiness,'Needs research');}
 const r=applyResolution(a,output(f),output(v),[page,{id:'official',kind:'search',url:'https://www.medicare.gov/eligibility',passages:[{id:'officialp1',text:'Official eligibility details.'}]}],{});assert.equal(r.readiness,'Ready for review');assert.equal(r.verification.verdicts[0].authorityQuote,'Official eligibility details.');
 const missing=applyResolution(a,output(f),output(verdict(f)),[page],{});assert.equal(missing.readiness,'Needs research');
 assert.equal(sourceAuthority('https://www.naic.org','carrier'),true);assert.equal(sourceAuthority('https://www.naic.org','rule'),false);
});
test('evidence IDs, source ownership, covered tasks and topic completeness are enforced',()=>{
 assert.throws(()=>applyResolution(a,output(finding),output(verdict({...finding,passageId:'invented'})),[page],{}));
 assert.throws(()=>applyResolution(a,output(finding),output(verdict({...finding,task:'Add more content.'})),[page],{}));
 assert.throws(()=>applyResolution(a,output(finding),{...output(verdict(finding)),findings:[]},[page],{}));
 assert.throws(()=>applyResolution(a,output(finding),output(verdict(finding)),[{...page,kind:'search'}],{}));
});
test('new-page scope and stale metrics remain blocked, optional checks do not block supported work',()=>{
 const external={...page,id:'external',kind:'search',url:'https://publisher.example',passages:[{id:'externalp1',text:'Comparison demand evidence.'}]},f={...finding,judgement:'new candidate',passageId:'externalp1',task:'Investigate a distinct calculator scope.'};
 assert.equal(applyResolution(a,output(f),output(verdict(f)),[external],{}).resolution.blockers[0].code,'scope');
 const improvement={...finding,judgement:'improve',task:'Add a visible comparison checklist.'};
 assert.equal(applyResolution(a,output(improvement),output(verdict(improvement)),[page],{}).readiness,'Ready for review');
 const dated={...a,topics:[{...a.topics[0],evidence:{gsc:[{}]}}]};assert.equal(applyResolution(dated,output(improvement),output(verdict(improvement)),[page],{}).resolution.blockers[0].code,'freshness');
});
test('candidate matching prefers the correct plan letter, keeps the assigned target and caps reads',()=>{
 const inventory=[{url:'https://www.medicarefaq.com/plan-n',title:'Compare Plan N costs'},...Array.from({length:10},(_,i)=>({url:url+'-'+i,title:'Compare Plan G costs'}))];
 const urls=resolutionCandidates({...a,targetUrl:url},inventory);assert.equal(urls.length,6);assert.equal(urls[0],url);assert.ok(!urls.includes(inventory[0].url));
});
test('resolution bounds searches and repairs, saves actual citations, and does not rerun evidence for repair',async()=>{
 let searches=0,reads=0,generations=0;const r=await resolveAssignment(a,{}, {read:async()=>{reads++;return {url,html:'<main>'+page.passages[0].text.repeat(6)+'</main>'};},search:async()=>{searches++;return {status:'available',sources:[]};},generate:async()=>{if(++generations===1)throw Error('invalid response');return output(finding);},verify:async()=>output(verdict(finding))});
 assert.equal(r.readiness,'No change suggested');assert.equal(searches,2);assert.equal(reads,1);assert.equal(generations,2);assert.ok(r.findings[0].quote.startsWith('Compare Plan G'));assert.equal(r.resolution.audit.verificationAttempts,1);
});
test('provider failures stay distinct from evidence holds and never expose private error text',async()=>{
 const r=await resolveAssignment(a,{}, {read:async()=>({url,html:'<main>'+page.passages[0].text.repeat(6)+'</main>'}),search:async()=>({status:'available',sources:[]}),generate:async()=>output(finding),verify:async()=>{throw Error('secret key and raw provider data');}});
 assert.equal(r.retryable,true);assert.equal(blockersFor({...a,result:r})[0].code,'technical');assert.equal(r.resolution.failure.stage,'verification');assert.ok(!JSON.stringify(r).includes('secret key'));
});
