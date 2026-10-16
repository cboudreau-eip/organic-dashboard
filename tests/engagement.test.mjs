import { test } from 'node:test';
import assert from 'node:assert/strict';
import { engagementQuery, parseEngagement, withEngagement } from '../lib/posthog/engagement.js';
import { METRICS, parseOverview } from '../lib/posthog/overview.js';

test('engagement excludes the second SDK and preserves full sessions around date boundaries', () => {
  const { query } = engagementQuery('2026-03-08','2026-03-08');
  assert.match(query,/properties\.\$sdk_dist_channel='cdn'/);
  assert.match(query,/session\.\$channel_type='Organic Search'/);
  assert.match(query,/2026-03-07 00:00:00/);
  assert.match(query,/2026-03-10 00:00:00/);
  assert.match(query,/HAVING period_views>0/);
  assert.match(query,/leaves>0 AND last_leave>=last_view/);
  assert.match(query,/countIf\(views=1\) AS single_page_sessions/);
  assert.doesNotMatch(query,/session\.\$(duration|pageview_count|is_bounce)/);
  assert.throws(()=>engagementQuery("2026-01-01'",'2026-01-01'));
  assert.throws(()=>engagementQuery('2026-02-02','2026-02-01'));
});

test('single-page rate includes all sessions even without exit evidence', () => {
  const current=parseEngagement({results:[[100,60,9000,80]]});
  const previous=parseEngagement({results:[[90,50,5000,0]]});
  assert.equal(current.duration,150);
  assert.equal(current.singlePageRate,80); // All 100 sessions, not only the 60 with exits
  const metrics=withEngagement(parseOverview({results:METRICS.map(([key])=>({key,value:999,previous:888}))}),current,previous);
  assert.equal(metrics.find(m=>m.key==='views').value,999);
  assert.equal(metrics.find(m=>m.key==='sessions').value,100);
  const bounce=metrics.find(m=>m.key==='single-page session rate');
  assert.equal(bounce.value,80); assert.equal(bounce.previous,0);
  assert.equal(bounce.unavailableReason,undefined);
  assert.deepEqual(bounce.coverage,{measured:100,total:100,previousMeasured:90,previousTotal:90});
  const empty=parseEngagement({results:[[0,0,0,0]]});
  assert.equal(empty.duration,null); assert.equal(empty.singlePageRate,null);
  const unknown=parseEngagement({results:[[10,0,0,10]]});
  assert.equal(unknown.duration,null); assert.equal(unknown.singlePageRate,100);
});

test('malformed or impossible engagement results fail closed', () => {
  for(const row of [[10,11,10,1],[10,5,10,11],[10,0,1,0],[10,5,-1,1],[10,5,10,'1']])
    assert.throws(()=>parseEngagement({results:[row]}));
  assert.throws(()=>parseEngagement({results:[]}));
  assert.throws(()=>parseEngagement({results:[[1,1,0,1]],error:'failed'}));
});
