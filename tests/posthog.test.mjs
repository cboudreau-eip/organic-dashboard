import { test } from 'node:test';
import assert from 'node:assert/strict';
import { overviewPeriod, overviewQuery, parseOverview, metricChange, metricValue, METRICS } from '../lib/posthog/overview.js';

test('complete New York calendar periods across UTC midnight, DST, and leap day', () => {
  assert.deepEqual(overviewPeriod(7, new Date('2026-10-09T02:00:00Z')), { start:'2026-10-01', end:'2026-10-07', priorStart:'2026-09-24', priorEnd:'2026-09-30' });
  assert.equal(overviewPeriod(7, new Date('2026-03-09T12:00:00Z')).start, '2026-03-02');
  assert.equal(overviewPeriod(7, new Date('2024-03-01T12:00:00Z')).end, '2024-02-29');
  assert.throws(() => overviewPeriod(365));
});
test('all metrics share strict organic, hostname and comparison filters', () => {
  const query = overviewQuery(overviewPeriod(7, new Date('2026-10-09T12:00:00Z')));
  assert.deepEqual(query.properties.map(p => [p.type,p.key,p.operator,p.value]), [
    ['session','$channel_type','exact',['Organic Search']], ['event','$host','exact',['www.medicarefaq.com','medicarefaq.com']],
  ]);
  assert.equal(query.compareFilter.compare,true);
  assert.deepEqual(query.dateRange,{date_from:'2026-10-02',date_to:'2026-10-08'});
});
test('missing or malformed provider data never becomes synthetic or zero', () => {
  const results = METRICS.map(([key]) => ({key,value:0,previous:null}));
  assert.equal(parseOverview({results})[0].previous,null);
  assert.throws(() => parseOverview({results:results.slice(1)}));
  assert.throws(() => parseOverview({results:[{...results[0],value:'12'},...results.slice(1)]}));
  assert.throws(() => parseOverview({results,error:'provider failure'}));
  assert.equal(metricValue(null,'count'),'—');
  assert.equal(metricValue(11.08,'percent'),'11.1%');
  assert.equal(metricValue(288.56,'duration'),'4m 49s');
  assert.equal(metricChange({value:10,previous:0,format:'count'}),'No prior baseline');
  assert.equal(metricChange({value:11,previous:12,format:'percent'}),'-1.0 pp');
});
