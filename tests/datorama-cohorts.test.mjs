import test from 'node:test';
import assert from 'node:assert/strict';
import {followUpMonths, cohortMetrics} from '../lib/datorama/cohorts.js';

test('four subsequent calendar checkpoints cross years and leap February', () => {
  const points = followUpMonths('2023-11', '2024-02-29');
  assert.deepEqual(points.map(p => p.end), ['2023-12-31','2024-01-31','2024-02-29','2024-03-31']);
  assert.equal(points[2].status, 'Follow-up date reached · see saved exports');
  assert.equal(points[3].status, 'Not yet due in this import');
  assert.throws(() => followUpMonths('2024-13', '2024-02-29'));
});
test('latest cohort totals preserve gaps, zero, and separate policy statuses', () => {
  const cohort = {partial:false, metrics: ['eipLeads','grossMS','grossMA','approvedMS','approvedMA'].map((key,i) => ({key,total:[10,4,2,0,null][i],missingDays:i===4?1:0}))};
  const metrics = cohortMetrics(cohort);
  assert.equal(metrics[0].total,10);
  assert.equal(metrics[1].total,6);
  assert.equal(metrics[2].total,null);
  assert.equal(metrics[2].incomplete,true);
  assert.ok(metrics.slice(3).every(m => m.total === null && m.unavailable));
  cohort.metrics[4]={key:'approvedMA',total:0,missingDays:0};
  assert.equal(cohortMetrics(cohort)[2].total,0);
  cohort.partial=true;
  assert.equal(cohortMetrics(cohort)[0].incomplete,true);
});

test('opportunity cohorts show source subtotal and retain missing-day warning', () => {
  const cohort={partial:false,metrics:[{key:'opportunities',total:14,reportedDays:29,missingDays:2}]};
  const metric=cohortMetrics(cohort).find(m=>m.label==='Salesforce opportunities');
  assert.equal(metric.total,14);
  assert.equal(metric.unavailable,false);
  assert.equal(metric.incomplete,true);
});
