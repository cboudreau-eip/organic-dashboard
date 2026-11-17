import test from 'node:test';import assert from 'node:assert/strict';
import {calendarReview} from '../lib/research/calendar-review.js';
import {generateCalendar} from '../lib/research/demo-calendar.js';
import {buildProposalWorkbook} from '../lib/research/proposal-export.js';
const items=Array.from({length:90},(_,n)=>({id:'i'+n,title:'Task '+n,action:'Update answer',verification:'Verify current rules',measure:'GSC',terms:['query '+n],category:'Evergreen',evidence:{gsc:[{impressions:25}]}}));
const plan={payload:{items},calendar:generateCalendar(items),qualityAudit:{flagged:0}};
test('final review checks 90 unique dates, instructions, evidence, tentative status and open flags without mutation',()=>{
 const before=structuredClone(plan);assert.equal(calendarReview(plan).ready,true);assert.deepEqual(plan,before);
 for(const bad of [{...plan,calendar:{...plan.calendar,dates:{...plan.calendar.dates,i1:plan.calendar.dates.i0}}},{...plan,qualityAudit:{flagged:1}},{...plan,calendar:{...plan.calendar,status:'Published'}},{...plan,payload:{items:items.map((i,n)=>n?i:{...i,action:''})}},{...plan,payload:{items:items.map((i,n)=>n?i:{...i,evidence:{}})}}])assert.equal(calendarReview(bad).ready,false);
});
test('Excel includes the same final review and all 90 saved assignments',async()=>{
 const p={...plan,calendarReview:calendarReview(plan)},wb=await buildProposalWorkbook(p);
 assert.match(wb.getWorksheet('Overview').getCell('B21').value,/ready for tentative planning/);
 assert.equal(wb.getWorksheet('Assignment details').getRow(95).getCell(1).value,90);
});
