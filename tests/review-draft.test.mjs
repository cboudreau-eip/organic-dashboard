import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyReview,readReview,saveReview,formatReview,loadedReview} from '../components/dashboard/review-draft.js';
const memory=()=>{const values=new Map();return {getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value)};};
test('loaded review uses actual source periods, preserves zero, and withholds stale reports',()=>{
 const result={period:{start:'2026-10-01',end:'2026-10-31',priorStart:'2026-09-01',priorEnd:'2026-09-30'},metrics:[{key:'visitors',format:'count',value:0,previous:10},{key:'views',format:'count',value:null,previous:20}],fetchedAt:'2026-11-01T12:00:00Z'};
 const search={...result,period:{...result.period,start:'2026-10-03'},current:{clicks:20,impressions:100,ctr:.2,position:2},previous:{clicks:10,impressions:100,ctr:.1,position:3}};
 const draft=loadedReview({status:'ready',result},{status:'ready',result:search});
 assert.match(draft.period,/PostHog: 2026-10-01/);assert.match(draft.period,/Google Search Console: 2026-10-03/);
 assert.match(draft.performance,/0 current vs 10 prior; -100.0%/);assert.match(draft.performance,/— current vs 20 prior; Comparison unavailable/);
 assert.match(draft.performance,/20.00% current vs 10.00% prior; \+10.00 pp/);
 const loading=loadedReview({status:'loading',result},{status:'error',result:search});
 assert.equal(loading.performance,'No loaded report dates yet.');assert.doesNotMatch(loading.period,/2026/);assert.match(loading.freshness,/unavailable/);
});
test('review drafts persist exact notes and remain account scoped',()=>{
 const storage=memory(),fields=emptyReview();fields.period='October 2026';fields.opportunity1='Page: /example/\nEvidence: 40 vs 50 clicks\nNext: inspect query changes';
 assert.equal(readReview(storage,'alice'),null);saveReview(storage,'alice',fields);
 assert.deepEqual(readReview(storage,'alice').fields,fields);assert.equal(readReview(storage,'bob'),null);
 saveReview(storage,'bob',emptyReview());assert.equal(readReview(storage,'alice').fields.opportunity1,fields.opportunity1);
});
test('draft failures do not report success or overwrite saved content',()=>{
 const storage=memory();saveReview(storage,'alice',emptyReview());
 assert.throws(()=>saveReview(storage,'alice',{...emptyReview(),period:'x'.repeat(4001)}));
 assert.equal(readReview(storage,'alice').fields.period,'');
 assert.throws(()=>saveReview({setItem(){throw Error('Quota');}},'alice',emptyReview()));
 assert.throws(()=>readReview({getItem:()=>'{invalid'},'alice'));
 assert.throws(()=>readReview({getItem:()=>JSON.stringify({version:1,savedAt:'today',fields:{}})},'alice'));
 assert.throws(()=>saveReview(storage,'',emptyReview()));
});
test('copy output includes all review sections and explicit unfilled gaps',()=>{
 const fields=emptyReview();fields.performance='Observed clicks increased; cause unconfirmed.';const output=formatReview(fields);
 assert.match(output,/Observed clicks increased; cause unconfirmed/);assert.match(output,/Opportunity 1\n\[Not recorded\]/);assert.match(output,/Opportunity 3/);assert.match(output,/Previous work and available results/);assert.match(output,/Decisions and follow-up/);
});
