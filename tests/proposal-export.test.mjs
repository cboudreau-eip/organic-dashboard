import test from 'node:test';
import assert from 'node:assert/strict';
import {exportProposalCsv} from '../lib/research/proposal-export.js';
test('exports the entire saved plan chronologically with edits, fixed dates, evidence and tentative status',()=>{
 const plan={id:'plan',version:3,calendar:{dates:{a:'2027-01-02',b:'2027-01-01'},locked:['a']},payload:{sourceDates:{gsc:{period:{start:'2026-10-01',end:'2026-10-31'},status:'partial'}},items:[{id:'a',title:'Edited, "title"',notes:'Line one\nLine two',whyAssignment:{summary:'Reason',facts:['Evidence'],sourceScope:'Saved source'},terms:['long tail question']},{id:'b',title:'First'}]}};
 const before=structuredClone(plan),csv=exportProposalCsv(plan);
 assert.ok(csv.startsWith('\uFEFF'));assert.ok(csv.indexOf('First')<csv.indexOf('Edited'));
 assert.match(csv,/"2027-01-02","Tentative","Yes"/);assert.ok(csv.includes('"Edited, ""title"""'));assert.ok(csv.includes('Line one\nLine two'));assert.ok(csv.includes('2026-10-01 to 2026-10-31; partial'));assert.match(csv,/Evidence/);assert.deepEqual(plan,before);
});
test('protects spreadsheet text from formula execution and supports unscheduled assignments',()=>{
 const csv=exportProposalCsv({payload:{items:[{id:'a',title:'=HYPERLINK("evil")',notes:'  +formula',action:'@SUM(A1)'}]}});
 assert.ok(csv.includes("'=HYPERLINK"));assert.ok(csv.includes("'  +formula"));assert.ok(csv.includes("'@SUM"));assert.match(csv,/Unscheduled/);assert.throws(()=>exportProposalCsv(null));
});
