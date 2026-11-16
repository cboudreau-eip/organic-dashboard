import test from 'node:test';
import assert from 'node:assert/strict';
import {revisePaidProposals} from '../lib/research/revise-proposals.js';
import {publicProposalPlan} from '../lib/research/proposals.js';
import {generateCalendar} from '../lib/research/demo-calendar.js';
const fixture=()=>{
 const items=Array.from({length:90},(_,i)=>({id:'slot'+i,title:'Retained '+i,category:'Evergreen',terms:['retained '+i],action:'Original work',targetUrl:'',evidence:{gsc:[],semrush:[],otterly:[]}}));
 Object.assign(items[0],{title:'medicare supplement plan j',category:'High intent',terms:['medicare supplement plan j'],evidence:{gsc:[{keys:['old query','old page']}],semrush:[],otterly:[],posthog:{quoteStarts:9}}});
 Object.assign(items[1],{title:'enroll in medicare part d',category:'Long-tail',terms:['enroll in medicare part d']});
 Object.assign(items[2],{title:'medicare $90',terms:['medicare $90']});
 Object.assign(items[3],{title:'$90 medicare refund',category:'AI citations'});
 const plan={id:'source',version:3,payload:{items,sourceDates:{}},edits:{slot2:{notes:'Keep this assignment'}},calendar:generateCalendar(items)};
 const snapshot={id:'paid',payload:{period:{start:'2025-11-16',end:'2026-11-15'},rows:['aarp medicare supplement plans','medicare plan g pricing by state','how to apply for medicare','what is the best medicare plan that covers everything'].map(term=>({term,account:'MC+MFAQ',clicks:200,leads:25,sales:4}))}};
 return {plan,snapshot};
};
test('revisions replace actual work, keep slots/dates/manual edits and remove old-topic evidence',()=>{
 const {plan,snapshot}=fixture(),original=structuredClone(plan),out=revisePaidProposals(plan,snapshot);
 assert.deepEqual(plan,original);assert.equal(out.payload.items.length,90);assert.deepEqual(out.calendar,plan.calendar);assert.deepEqual(out.edits,plan.edits);
 assert.deepEqual(out.payload.items.map(i=>i.id),plan.payload.items.map(i=>i.id));assert.deepEqual(out.payload.items.map(i=>i.category),plan.payload.items.map(i=>i.category));
 assert.deepEqual(out.payload.items[2],plan.payload.items[2]);assert.deepEqual(out.payload.items[3],plan.payload.items[3]);
 assert.notEqual(out.payload.items[0].action,plan.payload.items[0].action);assert.match(out.payload.items[0].title,/AARP/);assert.deepEqual(out.payload.items[0].evidence.gsc,[]);assert.equal(out.payload.items[0].evidence.posthog,null);
 assert.equal(out.payload.items[1].terms[0],'medicare plan g pricing by state');assert.equal(out.payload.revision.replaced,2);
 const shown=publicProposalPlan({...plan,...out});assert.equal(shown.payload.items[0].title,out.payload.items[0].title);assert.match(shown.payload.items[0].whyAssignment.facts.join(' '),/Combined MedicareCompared/);
 assert.throws(()=>revisePaidProposals({...plan,...out},snapshot),/No further/);
});
test('unsupported, MC-only, low-click and inconsistent evidence never causes replacements',()=>{
 for(const change of [{account:'MC'},{qualityIssue:true},{clicks:19},{sales:0}]){const {plan,snapshot}=fixture();snapshot.payload.rows=snapshot.payload.rows.map(r=>({...r,...change}));assert.throws(()=>revisePaidProposals(plan,snapshot),/No further/);}
});
test('excluded terms and product scope prevent replacements',()=>{
 const {plan,snapshot}=fixture();assert.throws(()=>revisePaidProposals(plan,snapshot,[],{products:['Part D']}),/No further/);
 assert.throws(()=>revisePaidProposals(plan,snapshot,[],{excluded:['aarp','plan g']}),/No further/);
});
