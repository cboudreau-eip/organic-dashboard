import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pageFilters } from '../lib/gsc/page-filter.js';
import { conversionQueries } from '../lib/posthog/conversions.js';
import { overviewPeriod } from '../lib/posthog/overview.js';
test('GSC exact page filter anchors hostname, escapes regex and combines slash variants', () => {
  const regex = new RegExp(pageFilters('/compare.v2/')[0].expression);
  assert.ok(regex.test('https://www.medicarefaq.com/compare.v2/?x=1'));
  assert.ok(regex.test('https://www.medicarefaq.com/compare.v2'));
  assert.ok(!regex.test('https://www.medicarefaq.com/compareXv2/'));
  assert.ok(!regex.test('https://evil.test/compare.v2/'));
  assert.ok(!regex.test('https://www.medicarefaq.com/compare.v2/child/'));
});
test('conversion page queries filter the landing session in both periods and reject SQL syntax', () => {
  const queries = conversionQueries(overviewPeriod(28), '/compare/');
  assert.ok(queries.every(q => q.query.includes("session.$entry_pathname IN ('/compare','/compare/')")));
  assert.ok(queries.every(q => q.query.includes("session.$channel_type = 'Organic Search'")));
  assert.match(queries[2].query,/LIMIT 100$/);
  assert.throws(() => conversionQueries(overviewPeriod(28), "/x' OR 1=1"));
});
