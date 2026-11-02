import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyReview,readReview,saveReview,formatReview} from '../components/dashboard/review-draft.js';
const memory=()=>{const values=new Map();return {getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value)};};
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
