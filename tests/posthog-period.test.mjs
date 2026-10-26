import test from 'node:test';
import assert from 'node:assert/strict';
import {reportingPeriod,completeThrough,normalizePeriod,periodFromParams,periodParams,alignedDays} from '../lib/posthog/period.js';
import {overviewPeriod,explicitOverviewQueries,parseExplicitOverview} from '../lib/posthog/overview.js';
import {detailQueries} from '../lib/posthog/details.js';
import {conversionQueries} from '../lib/posthog/conversions.js';
const now=new Date('2026-10-26T15:00:00Z');
test('rolling windows retain legacy dates and add 90 days',()=>{
 const p=reportingPeriod(7,now),old=overviewPeriod(7,now);
 for(const k of ['start','end','priorStart','priorEnd'])assert.equal(p[k],old[k]);
 assert.equal(reportingPeriod({mode:'rolling',days:90},now).days,90);
 assert.equal(completeThrough(new Date('2026-10-26T02:00:00Z')),'2026-10-24');
});
test('month, custom and year comparisons use exact requested dates',()=>{
 const p=reportingPeriod({mode:'month',month:'2026-09'},now);
 assert.equal(p.start,'2026-09-01');assert.equal(p.end,'2026-09-30');assert.equal(p.priorStart,'2026-08-01');assert.equal(p.priorEnd,'2026-08-31');
 assert.equal(p.warnings.length,1);
 const y=reportingPeriod({mode:'month',month:'2026-09',compare:'year'},now);
 assert.equal(y.priorStart,'2025-09-01');
 const c=reportingPeriod({mode:'custom',start:'2026-09-01',end:'2026-09-07',compare:'custom',priorStart:'2026-08-10',priorEnd:'2026-08-16'},now);
 assert.equal(c.priorStart,'2026-08-10');assert.equal(c.priorDays,7);
});
test('YTD and leap days respect calendar boundaries',()=>{
 const p=reportingPeriod({mode:'ytd',compare:'year'},now);
 assert.equal(p.start,'2026-01-01');assert.equal(p.end,'2026-10-25');assert.equal(p.priorEnd,'2025-10-25');
 assert.throws(()=>reportingPeriod({mode:'ytd'},new Date('2026-01-01T17:00:00Z')),/no complete days/);
 const leap=reportingPeriod({mode:'custom',start:'2024-02-29',end:'2024-02-29',compare:'year'},now);
 assert.equal(leap.priorStart,'2023-02-28');assert.equal(leap.warnings.length,1);
});
test('invalid, future and unbounded ranges are rejected before queries',()=>{
 for(const s of [
  {mode:'custom',start:"2026-01-01' OR 1=1",end:'2026-01-02'},
  {mode:'custom',start:'2026-02-30',end:'2026-03-01'},
  {mode:'custom',start:'2026-10-01',end:'2026-09-01'},
  {mode:'custom',start:'2025-01-01',end:'2026-01-02'},
  {mode:'month',month:'2026-10'},
  {mode:'rolling',days:999},
  {mode:'rolling',days:7,compare:'custom',priorStart:'2026-10-20',priorEnd:'2026-10-26'}
 ]) assert.throws(()=>reportingPeriod(s,now));
});
test('selection survives request serialization without dropping comparison',()=>{
 const input={mode:'custom',start:'2026-09-01',end:'2026-09-30',compare:'custom',priorStart:'2026-07-01',priorEnd:'2026-07-31'};
 assert.deepEqual(periodFromParams(new URLSearchParams(periodParams(input))),input);
 assert.deepEqual(normalizePeriod(7),{mode:'rolling',compare:'previous',days:7});
});
test('traffic baselines come from second explicit query, not automatic previous values',()=>{
 const p=reportingPeriod({mode:'month',month:'2026-09',compare:'year'},now);
 const q=explicitOverviewQueries(p);
 assert.deepEqual(q.map(x=>x.dateRange),[{date_from:'2026-09-01',date_to:'2026-09-30'},{date_from:'2025-09-01',date_to:'2025-09-30'}]);
 assert.equal(q.every(x=>x.compareFilter.compare===false),true);
 assert.deepEqual(q[0].properties,q[1].properties);
 const response=(value,previous)=>({results:['visitors','views','sessions'].map(key=>({key,value,previous}))});
 const metrics=parseExplicitOverview(response(100,900),response(40,800));
 assert.equal(metrics[0].value,100);assert.equal(metrics[0].previous,40);
 assert.throws(()=>parseExplicitOverview(response(100,900),{results:[]}),/incomplete/);
});
test('traffic, conversion and trend requests use the same periods',()=>{
 const p=reportingPeriod({mode:'month',month:'2026-09',compare:'year'},now);
 const d=detailQueries(p),c=conversionQueries(p);
 assert.equal(d[0].dateRange.date_from,p.start);assert.equal(d[1].dateRange.date_from,p.priorStart);
 assert.ok(c[0].query.includes(p.start));assert.ok(c[1].query.includes(p.priorStart));
 const aligned=alignedDays([{date:'a',views:1}],[{date:'b',views:2},{date:'c',views:3}]);
 assert.equal(aligned.length,2);assert.equal(aligned[1].current,null);assert.equal(aligned[1].previous.views,3);
});
