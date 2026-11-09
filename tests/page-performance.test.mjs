import {test} from 'node:test';
import assert from 'node:assert/strict';
import {performanceQueries,parsePerformance,isLocalPage} from '../lib/posthog/page-performance.js';
const ok=results=>({status:'fulfilled',value:{results}}),bad={status:'rejected'};
test('local pages use known content families, not state words in unrelated articles',()=>{
 for(const p of ['/medicare-supplement-plans/florida/plan-g/','/medicare-supplement-plans/medigap-by-state/new-york-medigap-plans/','/medicare-by-state/texas/'])assert.equal(isLocalPage(p),true);
 for(const p of ['/blog/florida-news/','/medicare-by-state/','/medicare-supplement-plans/washingtonian/','/'])assert.equal(isLocalPage(p),false);
});
test('measured denominators and independent failures remain explicit',()=>{
 const e=ok([['/x/',100,60,6000,70,12,40,20]]),c=ok([['/x/',98,10,7,6,0,0,7]]);
 const r=parsePerformance([e,c]);assert.equal(r.rows[0].engagement.bounceRate,20);assert.equal(r.rows[0].engagement.scroll,50);assert.equal(r.rows[0].conversions.sessions,98);
 assert.deepEqual(parsePerformance([e,bad]).unavailable,['conversions']);assert.equal(parsePerformance([bad,c]).rows[0].engagement,undefined);
 const empty=parsePerformance([ok([['/x/',10,0,0,10,0,0,null]]),ok([])]);assert.equal(empty.rows[0].engagement.scroll,null);assert.equal(empty.rows[0].engagement.bounceRate,null);assert.equal(empty.rows[0].conversions,undefined);
 assert.throws(()=>parsePerformance([ok([['/x/',10,5,10,6,1,2,null]]),bad]));
 assert.throws(()=>parsePerformance([bad,bad]));
 assert.throws(()=>parsePerformance([ok([['/x/',10,5,10,6,7,2,1]]),bad]));
});
test('queries preserve one stream, landing attribution and period boundaries',()=>{
 const [e,c]=performanceQueries({start:'2026-11-01',end:'2026-11-08'});
 assert.match(e.query,/\$sdk_dist_channel='cdn'/);assert.match(e.query,/2026-10-31/);assert.match(e.query,/2026-11-10/);
 assert.match(e.query,/\$prev_pageview_pathname=session\.\$entry_pathname/);assert.match(e.query,/duration_seconds<10/);
 assert.match(c.query,/\$sdk_dist_channel = 'cdn'/);assert.match(c.query,/last_contact >= first_zip/);
});
