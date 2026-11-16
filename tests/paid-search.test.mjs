import test from 'node:test';import assert from 'node:assert/strict';import ExcelJS from 'exceljs';
import {parsePaidWorkbook} from '../lib/research/paid-search-import.js';import {enrichPaidPlan} from '../lib/research/paid-search.js';
async function workbook(account='MC+MFAQ',leads=8.5){const w=new ExcelJS.Workbook(),s=w.addWorksheet('All Terms'),n=w.addWorksheet('Notes');n.getCell('B3').value='11/16/2025 – 11/15/2026';s.getRow(4).values=['Rank','Search Term','Category','Account(s)','Total Impr.','Google Impr.','Bing Impr.','Clicks','CTR','Leads','Lead Rate','Sales'];s.getRow(5).values=[1,'medicare supplement plan g','Plan G',account,100,80,20,25,.25,leads,.34,2.5];return w;}
test('paid import preserves fractional attribution, source scope and dates; rejects unknown scope, missing values and duplicate terms',async()=>{
 const w=await workbook(),p=await parsePaidWorkbook(await w.xlsx.writeBuffer());assert.equal(p.payload.rows[0].leads,8.5);assert.equal(p.payload.rows[0].account,'MC+MFAQ');assert.equal(p.payload.period.end,'2026-11-15');
 const bad=await workbook('unknown');await assert.rejects(()=>bad.xlsx.writeBuffer().then(parsePaidWorkbook),/scope/);
 w.getWorksheet('All Terms').getCell('J5').value=null;await assert.rejects(()=>w.xlsx.writeBuffer().then(parsePaidWorkbook),/metrics/);
 const duplicate=await workbook();duplicate.getWorksheet('All Terms').getRow(6).values=duplicate.getWorksheet('All Terms').getRow(5).values;await assert.rejects(()=>duplicate.xlsx.writeBuffer().then(parsePaidWorkbook),/Duplicate/);
});
test('anomalous counts are labeled, not silently used as evidence',async()=>{const w=await workbook();w.getWorksheet('All Terms').getCell('H5').value=101;const p=await parsePaidWorkbook(await w.xlsx.writeBuffer());assert.match(p.payload.rows[0].qualityIssue,/Clicks exceed/);});
test('matching excludes MC and anomalous rows, respects plan/state/carrier boundaries, preserves dates and edits',()=>{
 const plan={calendar:{dates:{a:'2027-01-01'},locked:['a']},payload:{items:[{id:'a',title:'My title',originalTitle:'medicare supplement plan g texas',terms:['medicare supplement plan g texas'],whyAssignment:{facts:[]}}]}};
 const row={term:'medigap plan g texas',account:'MC+MFAQ',leads:50.5,sales:5.5,clicks:100};
 const snapshot={id:'s',payload:{period:{start:'2025-11-16',end:'2026-11-15'},rows:[row,{...row,term:'medigap plan n texas'},{...row,term:'medigap plan g florida'},{...row,term:'aetna medigap plan g texas'},{...row,term:'medicare supplement plan g texas',account:'MC'},{...row,term:'plan g texas costs',qualityIssue:'bad'}],methodology:'Not Salesforce counts'}};
 const before=structuredClone(plan),result=enrichPaidPlan(plan,snapshot);assert.deepEqual(plan,before);assert.deepEqual(result.calendar,plan.calendar);assert.equal(result.payload.items[0].title,'My title');assert.equal(result.payload.items[0].paidSearch.matchCount,1);assert.match(result.payload.items[0].whyAssignment.facts[0],/Combined/);assert.ok(result.payload.items[0].paidSearch.reviewScore>0);
});
test('edited scope does not inherit old keyword matches, and missing matches are not zeros',()=>{
 const result=enrichPaidPlan({payload:{items:[{id:'a',edited:true,title:'New unrelated direction',originalTitle:'plan g',terms:['plan g'],whyAssignment:{facts:[]}}]}},{payload:{rows:[{term:'plan g',account:'MFAQ',leads:20,sales:2,clicks:40}],period:{}}});assert.equal(result.payload.items[0].paidSearch.matchCount,0);assert.equal(result.payload.items[0].paidSearch.focus,null);
});
