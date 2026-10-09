import {test} from 'node:test';
import assert from 'node:assert/strict';
import {conversionQueries,parseConversions} from '../lib/posthog/conversions.js';
import {overviewPeriod} from '../lib/posthog/overview.js';
test('conversion cohort is scoped to organic MedicareFAQ entrants with explicit final step and ordering',()=>{
  const queries=conversionQueries(overviewPeriod(7,new Date('2026-10-09T12:00:00Z')));
  assert.equal(queries.length,3);
  for(const {query} of queries){
    assert.match(query,/session\.\$entry_hostname IN \('www.medicarefaq.com','medicarefaq.com'\)/);
    assert.match(query,/session\.\$channel_type = 'Organic Search'/);
    assert.match(query,/step_3_contact/);
    assert.match(query,/last_contact >= first_zip/);
    assert.match(query,/GROUP BY sid HAVING views > 0/);
    assert.doesNotMatch(query,/lead_submitted/);
  }
  assert.match(queries[0].query,/2026-10-09 00:00:00/);
  assert.match(queries[1].query,/2026-09-25 00:00:00/);
  assert.throws(()=>conversionQueries({start:"invalid'",end:'2026-10-08'}));
});
test('conversion rates use session denominator, preserve zero and reject impossible funnel or missing values',()=>{
  const row=[100,20,10,8,4,5,12];const r={results:[row]};
  const result=parseConversions(r,r,{results:[['/test/',...row]]});
  assert.equal(result.current.rate,10);
  assert.equal(result.current.contactSessions,10);
  assert.equal(result.current.contactEvents,12);
  assert.equal(result.pages[0].rate,10);
  const empty={results:[[0,0,0,0,0,0,0]]};
  assert.equal(parseConversions(empty,empty,{results:[]}).current.rate,null);
  assert.throws(()=>parseConversions({results:[[1,0,2,2,0,0,2]]},r,{results:[]}));
  assert.throws(()=>parseConversions({results:[[100,20,null,8,4,5,12]]},r,{results:[]}));
  assert.throws(()=>parseConversions({results:[]},r,{results:[]}));
});
