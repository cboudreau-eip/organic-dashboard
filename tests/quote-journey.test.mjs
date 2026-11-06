import test from 'node:test';
import assert from 'node:assert/strict';
import {quoteJourney} from '../lib/posthog/quote-journey.js';
test('completion uses ordered completions rather than all contact submissions',()=>{
 assert.deepEqual(quoteJourney({quoteStarts:20,completedFunnel:8,contactSessions:10}),{starts:20,completed:8,dropOff:12,completionRate:40,dropOffRate:60});
});
test('no starts, no completions and missing totals are distinct',()=>{
 assert.equal(quoteJourney({quoteStarts:0,completedFunnel:0}).completionRate,null);
 assert.equal(quoteJourney({quoteStarts:5,completedFunnel:0}).completionRate,0);
 assert.equal(quoteJourney({quoteStarts:5,completedFunnel:0}).dropOffRate,100);
 for(const value of [null,{}, {quoteStarts:2,completedFunnel:3},{quoteStarts:-1,completedFunnel:0}])assert.equal(quoteJourney(value).starts,null);
});
