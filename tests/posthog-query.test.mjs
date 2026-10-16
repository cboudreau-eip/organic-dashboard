import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createPostHogQueryRunner } from '../lib/posthog/query.js';
import { withEngagement } from '../lib/posthog/engagement.js';

const request = {host:'https://example.test',project:'1',key:'test-only',query:{kind:'HogQLQuery',query:'SELECT 1'}};
test('busy queries retry with backoff and recover', async () => {
  const delays=[]; let calls=0;
  const run=createPostHogQueryRunner({sleep:async ms=>delays.push(ms),fetchImpl:async()=>{
    calls++; return calls<3 ? new Response('{}',{status:calls===1?503:429}) : Response.json({results:[[1]]});
  }});
  assert.deepEqual(await run(request),{results:[[1]]});
  assert.equal(calls,3);assert.deepEqual(delays,[1000,2000]);
});
test('dashboard request fan-out never exceeds two queries', async () => {
  let active=0,peak=0;
  const run=createPostHogQueryRunner({fetchImpl:async()=>{
    active++;peak=Math.max(peak,active);await new Promise(r=>setTimeout(r,5));active--;return Response.json({results:[]});
  }});
  await Promise.all(Array.from({length:9},()=>run(request)));
  assert.equal(peak,2);
});
test('permanent failures are not retried and released slots can be reused', async () => {
  let calls=0;
  const run=createPostHogQueryRunner({concurrency:1,fetchImpl:async()=>++calls===1?new Response('{}',{status:403}):Response.json({results:[]})});
  await assert.rejects(run(request),/access was denied/);
  await run(request);assert.equal(calls,2);
});
test('transient failure retries are bounded', async () => {
  let calls=0;
  const run=createPostHogQueryRunner({sleep:async()=>{},fetchImpl:async()=>{calls++;return new Response('{}',{status:503});}});
  await assert.rejects(run(request),/temporarily unavailable/);assert.equal(calls,3);
});
test('a failed prior period does not hide valid current engagement', () => {
  const metrics=[{key:'session duration',value:null,previous:null},{key:'bounce rate',value:null,previous:null}];
  const current={sessions:100,durationSessions:80,bounceSessions:90,duration:180,bounceRate:10};
  const result=withEngagement(metrics,current,null);
  assert.equal(result[0].value,180);assert.equal(result[1].value,10);
  assert.equal(result[0].previous,null);assert.equal(result[0].unavailableReason,undefined);
  assert.equal(result[0].coverage.previousMeasured,null);
  const reverse=withEngagement(metrics,null,current);
  assert.equal(reverse[0].value,null);assert.equal(reverse[0].previous,180);
  assert.match(reverse[0].unavailableReason,/temporarily unavailable/);
});
