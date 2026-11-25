import test from 'node:test';
import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import {buildProposalWorkbook,exportProposalXlsx} from '../lib/research/proposal-export.js';
import {generateProposals,publicProposalPlan} from '../lib/research/proposals.js';
import {generateCalendar} from '../lib/research/demo-calendar.js';
import {DEFAULTS} from '../lib/research/contracts.js';
function fixture(){const payload=generateProposals({},DEFAULTS),calendar=generateCalendar(payload.items);const id=payload.items[0].id;calendar.locked=[id];return publicProposalPlan({id:'test-plan',version:5,payload,calendar,edits:{[id]:{title:'My edited title',notes:'A note, with quotes "kept"\nSecond line'}}});}
test('Excel snapshot preserves all 90 assignments, edits, dates and fixed flags without mutations',async()=>{
 const p=fixture(),before=structuredClone(p),bytes=await exportProposalXlsx(p),w=new ExcelJS.Workbook();await w.xlsx.load(bytes);
 assert.deepEqual(p,before);assert.deepEqual(w.worksheets.map(s=>s.name),['Overview','January','February','March','Assignment details','Full details']);
 const s=w.getWorksheet('Assignment details');assert.equal(s.rowCount,95);assert.equal(s.views[0].ySplit,5);assert.ok(s.getTable('Assignments'));
 const sorted=[...p.payload.items].sort((a,b)=>p.calendar.dates[a.id].localeCompare(p.calendar.dates[b.id]));
 sorted.forEach((i,n)=>{const r=s.getRow(n+6);assert.equal(r.getCell(4).value.text,i.title);assert.equal(r.getCell(2).value.toISOString().slice(0,10),p.calendar.dates[i.id]);assert.equal(r.getCell(5).value,'Tentative');assert.equal(r.getCell(6).value,p.calendar.locked.includes(i.id)?'Yes':'No');});
 for(const [m,count] of [['January',31],['February',28],['March',31]]){let links=0;w.getWorksheet(m).eachRow(r=>r.eachCell(c=>{if(c.value?.hyperlink)links++;}));assert.equal(links,count);assert.equal(w.getWorksheet(m).pageSetup.fitToHeight,1);}
 let notes='';w.getWorksheet('Full details').eachRow(r=>{notes+=r.getCell(2).text;});assert.ok(notes.includes('A note, with quotes "kept"\nSecond line'));
});
test('monthly export includes every title when assignments share a day',async()=>{
 const p=fixture(),first=p.payload.items[0],extra={...first,id:'additional',title:'Additional new content'};
 p.payload.items.push(extra);p.calendar.dates[extra.id]=p.calendar.dates[first.id];const before=structuredClone(p);
 const wb=await buildProposalWorkbook(p),month=['January','February','March'][Number(p.calendar.dates[first.id].slice(5,7))-1];let titles=[];
 wb.getWorksheet(month).eachRow(r=>r.eachCell(c=>{if(c.value?.hyperlink)titles.push(c.value.text);}));
 assert.ok(titles.includes(first.title));assert.ok(titles.includes(extra.title));assert.equal(wb.getWorksheet('Assignment details').rowCount,96);assert.deepEqual(p,before);
});
test('untrusted text stays literal, long notes are retained, and missing dates remain unscheduled',async()=>{
 const p={payload:{items:[{id:'x',title:'=HYPERLINK("evil")',category:'Long-tail',notes:'n'.repeat(3000),action:'@SUM(A1)'}]}};
 const w=await buildProposalWorkbook(p);assert.equal(w.getWorksheet('Assignment details').getCell('B6').value,'Unscheduled');
 let notes='';w.getWorksheet('Full details').eachRow(r=>{const c=r.getCell(2);assert.equal(c.type===6,false);if(/^n+$/.test(c.text))notes+=c.text;assert.ok((r.height||22)<=409);});assert.equal(notes.length,3000);
 await assert.rejects(()=>buildProposalWorkbook(null));
});
