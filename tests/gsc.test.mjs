import { test } from 'node:test';
import assert from 'node:assert/strict';
import { reportingPeriod, metricRow, displayMetric, changeLabel } from '../lib/gsc/report.js';
test('GSC inclusive periods span leap days and compare equal lengths', () => {
  assert.deepEqual(reportingPeriod('2024-03-02', 7), { start: '2024-02-25', end: '2024-03-02', priorStart: '2024-02-18', priorEnd: '2024-02-24' });
  assert.throws(() => reportingPeriod('2026-10-01', 365));
});
test('GSC distinguishes missing rates from zero and uses percent points for CTR', () => {
  assert.equal(metricRow().position, null);
  assert.equal(metricRow({ clicks: 0, impressions: 50, ctr: 0, position: 12 }).ctr, 0);
  assert.throws(() => metricRow({ clicks: 1, impressions: 100, ctr: .01 }));
  assert.throws(() => metricRow({ clicks: 1, impressions: 100, ctr: 2, position: 1 }));
  assert.equal(displayMetric(.0123, 'ctr'), '1.23%');
  assert.equal(changeLabel(.02, .01, 'ctr'), '+1.00 pp');
  assert.equal(changeLabel(5, 0, 'clicks'), 'No prior activity');
  assert.equal(changeLabel(8, 10, 'position'), '-2.0 positions (lower is better)');
});
