import test from 'node:test';
import assert from 'node:assert/strict';
import {auditCandidates,topicEvidence} from '../lib/research/decision-audit.js';
import {resolveAssignment} from '../lib/research/resolution-sources.js';
test('audit includes all holds and only the five highest priority no-change results',()=>{
 const a=Array.from({length:8},(_,i)=>({key:String(i),priority:i,result:{readiness:'No change suggested'}}));
 const held={key:'held',result:{readiness:'Needs research'}},ready={key:'ready',result:{readiness:'Ready for review'}};
 assert.deepEqual(auditCandidates([...a,held,ready]).map(a=>a.key),['held','7','6','5','4','3']);assert.equal(a[0].key,'0');
});
test('review receives measured evidence with limits and no invented attribution',async()=>{
 const t={key:'one',title:'Compare Plan G',terms:[],evidence:{semrush:[{volume:1300}],posthog:{sessions:0,quoteStarts:null}}};
 assert.equal(topicEvidence(t).evidence.posthog.sessions,0);assert.equal(topicEvidence(t).evidence.posthog.quoteStarts,null);assert.equal(topicEvidence({}).evidence.posthog,null);
 let context;const url='https://www.medicarefaq.com/plan-g';
 await resolveAssignment({topics:[t],candidateUrls:[url]}, {gsc:{status:'available'}},{read:async()=>({url,html:'<main>'+('Compare Plan G costs. '.repeat(20))+'</main>'}),search:async()=>({sources:[]}),generate:async c=>{context=c;throw Error('stop');},verify:async()=>{}});
 assert.equal(context.assignment.topics[0].evidence.semrush[0].volume,1300);assert.equal(context.sourceDates.gsc.status,'available');assert.match(context.assignment.topics[0].interpretation,/not keyword attribution/);
});
