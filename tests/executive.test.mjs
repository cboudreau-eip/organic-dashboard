import test from 'node:test';
import assert from 'node:assert/strict';
import {executiveDefaults,executivePeriod,executiveChange,leadCoverage} from '../lib/posthog/executive.js';
const now=new Date('2026-11-06T15:00:00Z');
test('monthly, quarterly and YTD use full calendar periods and year-over-year dates',()=>{
 const d=executiveDefaults(now);assert.equal(d.month,'2026-10');assert.equal(d.quarter,'3');
 const month=executivePeriod(d,now).period;assert.equal(month.start,'2026-10-01');assert.equal(month.priorEnd,'2025-10-31');
 const q=executivePeriod({...d,mode:'quarter'},now).period;assert.equal(q.start,'2026-07-01');assert.equal(q.end,'2026-09-30');assert.equal(q.priorStart,'2025-07-01');
 const ytd=executivePeriod({...d,mode:'ytd'},now).period;assert.equal(ytd.start,'2026-01-01');assert.equal(ytd.end,'2026-11-05');assert.equal(ytd.priorEnd,'2025-11-05');
 assert.throws(()=>executivePeriod({...d,mode:'quarter',quarter:'4'},now));
 assert.equal(executiveDefaults(new Date('2026-01-05T15:00:00Z')).year,'2025');
});
test('missing history, incomplete data and zero baselines never become false growth',()=>{
 assert.equal(executiveChange(10,0).text,'No prior baseline');
 assert.equal(executiveChange(10,20,false).text,'Comparison unavailable');
 assert.equal(executiveChange(null,20).tone,'neutral');
 assert.equal(executiveChange(30,20).text,'↑ +50.0%');
 assert.equal(executiveChange(10,20).tone,'negative');
 const p=executivePeriod({...executiveDefaults(now),mode:'ytd'},now).period;
 assert.match(leadCoverage({available:{start:'2025-01-01'},leadDataThrough:'2026-11-03'},p),/only through 2026-11-03/);
 assert.match(leadCoverage({available:{start:'2026-01-01'},leadDataThrough:'2026-11-05'},p),/before/);
});
