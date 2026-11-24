import test from 'node:test';
import assert from 'node:assert/strict';
import {verificationQuestions,verificationSearches,verificationUrls} from '../lib/work-queue/verification-research.js';
test('retry research retains the precise unanswered question and rejected qualifications',()=>{
 const pending=[{id:'change:0',section:'Guaranteed issue (targetp12)',question:'Review eligibility',remainingQuestion:'California birthday window requires prior Medigap?',reviewReason:'Age and previous policy conditions missing.',instruction:'Earlier unverified wording'}];
 const before=JSON.stringify(pending),items=verificationQuestions(pending),searches=verificationSearches('Switching plans',items);
 assert.match(searches[0].query,/California birthday/);assert.match(searches[0].query,/Age and previous/);assert.equal(items[0].question,pending[0].question);assert.equal(items[0].previousInstruction,pending[0].instruction);assert.equal(items[0].section,'Guaranteed issue');assert.equal(JSON.stringify(pending),before);
});
test('source selection gives each question coverage before extra federal results',()=>{
 const searches=[[{url:'https://medicare.gov/a'},{url:'https://medicare.gov/b'}],[{url:'https://insurance.ca.gov/birthday?year=2027'}],[{url:'https://cms.gov/costs'}]];
 assert.deepEqual(verificationUrls(searches,[],3),['https://medicare.gov/a','https://insurance.ca.gov/birthday?year=2027','https://cms.gov/costs']);
 assert.deepEqual(verificationUrls([[{url:'http://medicare.gov/a'},{url:'https://evil.test/a'},{url:'https://cms.gov/a#p1'}]],['https://cms.gov/a','https://medicare.gov/fallback']),['https://cms.gov/a','https://medicare.gov/fallback']);
});
