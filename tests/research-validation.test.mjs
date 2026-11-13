import test from 'node:test';
import {verifiedQuote} from '../lib/research/validation.js';
import {sourcePassages,attachVerifiedPassages} from '../lib/research/validation-sources.js';
test('assessment citations select actual passages and cannot cross source identities',()=>{
 const source={id:'own1',text:'This is the unchanged original evidence passage. '.repeat(15)};source.passages=sourcePassages(source);
 assert.ok(source.passages.every(p=>p.text.length<=300&&source.text.includes(p.text)));
 const output={findings:[{sourceId:'own1',passageId:'own1p2',judgement:'improve'}]};
 assert.equal(attachVerifiedPassages(output,[source]).findings[0].quote,source.passages[1].text);
 assert.throws(()=>attachVerifiedPassages({findings:[{sourceId:'own2',passageId:'own1p2'}]},[source]));
});
test('heading punctuation is recovered as verbatim source text without accepting rewritten facts',()=>{
 assert.equal(verifiedQuote('4 Submit the enrollment request Keep the confirmation number.','Submit the enrollment request. Keep the confirmation number.'),'Submit the enrollment request Keep the confirmation number');
 assert.equal(verifiedQuote('The premium is $150 per month.','The premium is $15 per month.'),null);
 assert.equal(verifiedQuote('The premium is $150 per month.','The premium is 150 per month.'),null);
 assert.equal(verifiedQuote('Submit only during a valid enrollment period.','Submit during a valid enrollment period.'),null);
});
test('SDK text citations are retained ahead of uncited search listings',()=>{
 const r=searchEvidence({sources:Array.from({length:8},(_,i)=>({url:`https://listing${i}.example/`})),content:[{type:'text',citations:[{source:{url:'https://cited.example/',title:'Verified source'},citedText:'A provider supplied citation excerpt with enough detail.'}]}]},'query');
 assert.equal(r.status,'available');assert.equal(r.sources[0].url,'https://cited.example/');
});
import assert from 'node:assert/strict';
import {consolidateAssignments,assessValidation,validationPayload} from '../lib/research/validation.js';
import {searchEvidence,validateAssignment,publicSearchUrl} from '../lib/research/validation-sources.js';
const url='https://www.medicarefaq.com/medicare-supplement-plans/plan-g';
const item=(key,target=url)=>({key,title:'Compare Plan G '+key,product:'Medigap',targetUrl:target,score:75,scoreMax:85,terms:['compare plan g quotes','plan g without underwriting'],intent:'Commercial',type:'Update existing page',relatedPages:target?[{url:target,canonical:url,title:'Medigap Plan G'}]:[],evidence:{gsc:[],gscRows:0,semrush:[{keyword:'plan g',volume:100}],otterly:[],posthog:{sessions:10,quoteStarts:0}}});
const dates={semrush:{status:'available',period:{end:'2027-01-01'}}},now=new Date('2027-01-03');
const source={id:'own1',kind:'own',url,title:'Medigap Plan G',text:'Compare available Plan G options. Eligibility conditions vary, so compare your choices.',fetchedAt:now.toISOString()};
const output=a=>({summary:'Clarify how to compare the options already discussed.',effort:'Small',checks:['Editorial accuracy review.'],findings:a.topics.map(t=>({topicKey:t.key,judgement:'improve',observation:'The passage asks readers to compare available options.',task:'Clarify the comparison steps surrounding this passage.',sourceId:'own1',quote:'Compare available Plan G options.'}))});

test('top 20 consolidate by canonical page and preserve distinct topics without adding metrics',()=>{
 const items=[item('a',url+'/'),item('b'),item('c',null),item('d',null),...Array.from({length:20},(_,i)=>item('x'+i,'https://www.medicarefaq.com/page-'+i)).map(x=>({...x,relatedPages:[]}))];
 const a=consolidateAssignments(items);assert.equal(a.reduce((s,a)=>s+a.topics.length,0),20);assert.equal(a[0].topics.length,2);assert.equal(a[0].topics[0].evidence.posthog.quoteStarts,0);assert.notEqual(a[1].key,a[2].key);assert.equal(a[0].targetUrl,url);assert.equal(a[0].sessions,undefined);
});
test('verified findings become review proposals; fabricated quotes and missing topics are rejected',()=>{
 const a=consolidateAssignments([item('a'),item('b')])[0],o=output(a);
 const result=assessValidation(o,a,[source],{status:'available'},dates,now);
 assert.equal(result.readiness,'Ready for review');assert.equal(result.confidence,'Moderate');assert.equal(result.draft,undefined);assert.equal(result.sources[0].text,undefined);
 const invented=structuredClone(o);invented.findings[0].quote='A fabricated coverage guarantee.';assert.throws(()=>assessValidation(invented,a,[source],{status:'available'},dates,now));
 const missing=structuredClone(o);missing.findings.pop();assert.throws(()=>assessValidation(missing,a,[source],{status:'available'},dates,now));
 const competitor=structuredClone(source);competitor.kind='search';assert.throws(()=>assessValidation(o,a,[competitor],{status:'available'},dates,now));
});
test('missing search, stale metrics and uncertainty never become planning-ready work',()=>{
 const a=consolidateAssignments([item('a')])[0],o=output(a);
 assert.equal(assessValidation(o,a,[source],{status:'unavailable'},dates,now).readiness,'Needs research');
 assert.equal(assessValidation(o,a,[source],{status:'available'},dates,new Date('2027-03-01')).readiness,'Needs research');
 const covered=structuredClone(o);covered.findings[0].judgement='covered';assert.equal(assessValidation(covered,a,[source],{status:'available'},dates,now).readiness,'No change suggested');
 const uncertain=structuredClone(o);Object.assign(uncertain.findings[0],{judgement:'uncertain',sourceId:null,quote:''});assert.equal(assessValidation(uncertain,a,[source],{status:'available'},dates,now).readiness,'Needs research');
});
test('external evidence uses provider sources, rejects unsafe links and distinguishes listings from excerpts',()=>{
 assert.equal(publicSearchUrl('javascript:alert(1)'),null);assert.equal(publicSearchUrl('https://127.0.0.1/x'),null);
 const result=searchEvidence({sources:[{url:'https://example.com/plan-g',title:'Plans',providerMetadata:{anthropic:{citedText:'Compare Plan G choices and their premiums.'}}},{url:'javascript:bad'}]},'plan g',now);
 assert.equal(result.status,'available');assert.equal(result.sources.length,1);
 assert.equal(searchEvidence({sources:[{url:'https://example.com/plan-g'}]},'plan g',now).status,'limited');
});
test('page/search/model failures retain an explicit research-needed outcome',async()=>{
 const a=consolidateAssignments([item('a')])[0];let called=0;
 const fail=await validateAssignment(a,dates,{read:async()=>{throw Error('private');},search:async()=>{throw Error('private');},generate:async()=>{called++;}});
 assert.equal(fail.readiness,'Needs research');assert.equal(called,0);assert.ok(!JSON.stringify(fail).includes('private'));
 const invalid=await validateAssignment(a,dates,{read:async()=>({url,html:'<main>'+source.text.repeat(10)+'</main>'}),search:async()=>({status:'available',sources:[]}),generate:async()=>({draft:'not allowed'})});assert.equal(invalid.retryable,true);assert.equal(invalid.findings.length,0);
});
