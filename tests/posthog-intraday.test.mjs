import test from 'node:test';
import assert from 'node:assert/strict';
import {reportingPeriod,periodParams,periodFromParams,formatReportDate} from '../lib/posthog/period.js';
import {hourlyQuery,parseHourly,instantSql} from '../lib/posthog/intraday.js';
import {explicitOverviewQueries} from '../lib/posthog/overview.js';
import {detailQueries} from '../lib/posthog/details.js';
import {conversionQueries} from '../lib/posthog/conversions.js';
import {engagementQuery} from '../lib/posthog/engagement.js';
function period(anchor){return reportingPeriod({mode:'hours',compare:'previous',anchor},new Date(anchor));}
test('past 24 hours uses exact elapsed time across DST transitions',()=>{
 for(const anchor of ['2026-10-26T16:30:15.000Z','2026-03-08T16:00:00.000Z','2026-11-01T16:00:00.000Z']){
   const p=period(anchor);
   assert.equal(Date.parse(p.end)-Date.parse(p.start),86400000);
   assert.equal(Date.parse(p.priorEnd)-Date.parse(p.priorStart),86400000);
   assert.equal(p.priorEnd,p.start);assert.equal(p.end,anchor);assert.equal(p.granularity,'hour');
 }
});
test('all report requests preserve one cutoff and exact half-open windows',()=>{
 const p=period('2026-10-26T16:30:15.000Z'),traffic=explicitOverviewQueries(p),details=detailQueries(p),conversions=conversionQueries(p);
 assert.equal(traffic[0].dateRange.date_from,p.start);
 assert.equal(Date.parse(traffic[0].dateRange.date_to),Date.parse(p.end)-1);
 assert.equal(traffic[1].dateRange.date_from,p.priorStart);
 assert.equal(Date.parse(traffic[1].dateRange.date_to),Date.parse(p.priorEnd)-1);
 assert.equal(details[0].kind,'HogQLQuery');assert.equal(details[2].dateRange.date_to,traffic[0].dateRange.date_to);
 assert.ok(details[0].query.includes('timestamp<'+instantSql(p.end)));
 assert.ok(conversions[0].query.includes('timestamp < '+instantSql(p.end)));
 assert.ok(conversions[1].query.includes('timestamp < '+instantSql(p.priorEnd)));
 const engagement=engagementQuery(p.priorStart,p.priorEnd,p.end).query;
 assert.ok(engagement.includes('timestamp<'+instantSql(p.priorEnd)));
 assert.ok(engagement.includes('AND timestamp<'+instantSql(p.end)));
});
test('hourly results are ordered, bounded and padded only after a successful query',()=>{
 const p=period('2026-10-26T16:30:15.000Z');
 const rows=parseHourly({results:[[23,5],[0,3]]},p.start);
 assert.equal(rows.length,24);assert.equal(rows[0].views,3);assert.equal(rows[1].views,0);assert.equal(rows[23].views,5);
 assert.equal(Date.parse(rows[23].date)-Date.parse(rows[0].date),23*3600000);
 for(const results of [[[24,1]],[[1,-1]],[[0,1],[0,2]],[[1.5,2]],[[1,null]]]) assert.throws(()=>parseHourly({results},p.start));
 assert.throws(()=>parseHourly({error:true,results:[]},p.start));
 assert.throws(()=>hourlyQuery(p.start,p.priorStart));
});
test('cutoff survives request serialization; bad, stale and future timestamps fail',()=>{
 const s={mode:'hours',compare:'previous',anchor:'2026-10-26T16:30:15.000Z'};
 assert.deepEqual(periodFromParams(new URLSearchParams(periodParams(s))),s);
 assert.throws(()=>reportingPeriod({...s,compare:'year'},new Date(s.anchor)));
 for(const anchor of ["2026-10-26'; DROP TABLE events",'2026-10-26','2026-02-30T16:00:00.000Z','2026-10-27T16:30:15.000Z','2026-10-01T16:30:15.000Z']){
   assert.throws(()=>reportingPeriod({...s,anchor},new Date(s.anchor)));
 }
 assert.ok(formatReportDate(s.anchor).includes('12:30:15'));
 assert.equal(formatReportDate('2026-10-26'),'2026-10-26');
});
