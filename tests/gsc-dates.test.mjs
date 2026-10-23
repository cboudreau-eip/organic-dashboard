import test from 'node:test';
import assert from 'node:assert/strict';
import {resolvePeriod,normalizeSelection,validDate,trendRows,shiftMonths} from '../lib/gsc/dates.js';
const latest='2026-10-21',today='2026-10-23';
test('legacy rolling periods preserve exact adjacent dates',()=>{
 const p=resolvePeriod(28,latest,today);
 assert.equal(p.start,'2026-09-24');assert.equal(p.end,latest);
 assert.equal(p.priorStart,'2026-08-27');assert.equal(p.priorEnd,'2026-09-23');assert.equal(p.days,28);
});
test('calendar comparisons use full months and flag unequal lengths',()=>{
 const p=resolvePeriod({mode:'month',month:'2026-09'},latest,today);
 assert.equal(p.start,'2026-09-01');assert.equal(p.end,'2026-09-30');
 assert.equal(p.priorStart,'2026-08-01');assert.equal(p.priorEnd,'2026-08-31');
 assert.equal(p.priorDays,31);assert.equal(p.warnings.length,1);
 const jan=resolvePeriod({mode:'month',month:'2026-01'},latest,today);
 assert.equal(jan.priorStart,'2025-12-01');
});
test('year comparison matches calendar dates and leap years explicitly',()=>{
 const p=resolvePeriod({mode:'custom',start:'2026-10-15',end:'2026-10-21',compare:'year'},latest,today);
 assert.equal(p.priorStart,'2025-10-15');assert.equal(p.priorEnd,'2025-10-21');
 const leap=resolvePeriod({mode:'custom',start:'2024-02-29',end:'2024-02-29',compare:'year'},'2024-03-01','2024-03-03');
 assert.equal(leap.priorStart,'2023-02-28');assert.equal(leap.days,1);assert.equal(leap.warnings.length,1);
 const month=resolvePeriod({mode:'month',month:'2025-02',compare:'year'},'2025-03-03','2025-03-05');
 assert.equal(month.priorEnd,'2024-02-29');assert.equal(month.priorDays,29);
 assert.equal(shiftMonths('2026-03-31',-1),'2026-02-28');
});
test('explicit comparisons support independent dates and disclose overlap',()=>{
 const p=resolvePeriod({mode:'custom',start:'2026-09-01',end:'2026-09-30',compare:'custom',priorStart:'2026-09-15',priorEnd:'2026-10-15'},latest,today);
 assert.equal(p.priorStart,'2026-09-15');assert.equal(p.warnings.length,2);
});
test('invalid, future, reversed, excessive and expired ranges are rejected',()=>{
 assert.equal(validDate('2026-02-30'),false);
 assert.throws(()=>normalizeSelection({mode:'rolling',days:90}));
 assert.throws(()=>normalizeSelection({mode:'custom',start:'2026-10-01',end:'2026-09-01'}));
 assert.throws(()=>normalizeSelection({mode:'custom',start:'2025-01-01',end:'2026-01-02'}),/366/);
 assert.throws(()=>resolvePeriod({mode:'month',month:'2026-10'},latest,today),/finalized/i);
 assert.throws(()=>resolvePeriod({mode:'month',month:'2025-09',compare:'year'},latest,today),/16-month/);
 assert.throws(()=>normalizeSelection({mode:'month',month:'2026-13'}));
});
test('unequal and single-day trends do not fabricate extra days',()=>{
 const daily=[{keys:['2026-09-01'],clicks:10},{keys:['2026-08-31'],clicks:5}];
 const period=resolvePeriod({mode:'month',month:'2026-09'},latest,today);
 const rows=trendRows({daily,period});
 assert.equal(rows.length,31);assert.equal(rows[30].date,null);assert.equal(rows[30].current,null);assert.equal(rows[30].previous,5);
 assert.equal(rows[0].current,10);
 const single=trendRows({daily:[],period:{start:'2026-10-01',end:'2026-10-01',priorStart:'2026-09-30',priorEnd:'2026-09-30'}});
 assert.equal(single.length,1);assert.equal(single[0].day,1);
});
