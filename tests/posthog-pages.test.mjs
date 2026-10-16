import { test } from 'node:test';
import assert from 'node:assert/strict';
import { conversationPages, pageQuery } from '../lib/posthog/pages.js';
import { overviewPeriod, overviewQuery } from '../lib/posthog/overview.js';
import { parseLandingPages } from '../lib/posthog/details.js';

test('direct page lookup resolves follow-ups and prefers the newest URL', () => {
  const messages = [{role:'user',content:'https://www.medicarefaq.com/old/'}, {role:'assistant',content:'The page is https://www.medicarefaq.com/medicare-supplement-plans/compare/.'}, {role:'user',content:'What about visits to that page?'}];
  assert.deepEqual(conversationPages(messages), ['/medicare-supplement-plans/compare/']);
  assert.deepEqual(conversationPages([{content:'https://medicarefaq.com/test/?utm_source=x#hi https://medicarefaq.com/test/'}]), ['/test/']);
  assert.deepEqual(conversationPages([{content:'https://example.com/ https://medicarefaq.com.evil.test/a'}]), []);
});

test('page filters retain organic and host scope with structured path values', () => {
  const period = overviewPeriod(28);
  const query = pageQuery(period, '/compare/');
  assert.deepEqual(query.properties.slice(0,3), overviewQuery(period).properties);
  assert.deepEqual(query.properties[3].value, ['/compare','/compare/']);
  assert.equal(query.compareFilter.compare,true);
  assert.deepEqual(pageQuery(period, '/').properties[3].value, ['/']);
  assert.throws(() => pageQuery(period,'https://example.com'));
});

test('landing page parser preserves more than ten rows', () => {
  const results = Array.from({length:100}, (_,i) => [`/page-${i}/`,[100-i,null]]);
  assert.equal(parseLandingPages({results}).length,100);
});
