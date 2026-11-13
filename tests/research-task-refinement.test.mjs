import test from 'node:test';
import assert from 'node:assert/strict';
import {matchPages,separateTasks} from '../lib/research/task-refinement.js';
const url=s=>'https://www.medicarefaq.com/'+s;
test('matching prefers exact carrier and product over earlier unrelated page, excluding navigation',()=>{
 const pages=[{url:url('blog/humana-advantage-cut'),title:'Humana Medicare Advantage plans dropped'},{url:url('part-d/humana-prescription-plans'),title:'Humana prescription plans'},{url:url('sitemap'),title:'Humana prescription plans'},{url:url('part-d/aetna'),title:'Aetna Part D plans'}];
 const matches=matchPages({title:'humana prescription plans'},pages,pages[0].url);
 assert.equal(matches[0].url,pages[1].url);assert.ok(!matches.some(p=>p.url===pages[2].url));assert.ok(matches[0].reasons.includes('Named carrier in title or URL'));
});
test('splits preserve topic evidence and lineage but remove inherited result and fixed target',()=>{
 const a={key:'a'.repeat(24),title:'Carrier page',targetUrl:url('carrier'),topics:[{key:'one',title:'Aetna Plan G',score:80,evidence:{gsc:[{clicks:2}]}},{key:'two',title:'Aetna complaints',score:75}],result:{readiness:'Needs research'},state:'done'};
 const tasks=separateTasks(a,[{url:url('aetna-plan-g'),title:'Aetna Plan G'}]);
 assert.equal(tasks.length,2);assert.notEqual(tasks[0].key,tasks[1].key);assert.equal(tasks[0].parentAssignment.key,a.key);assert.deepEqual(tasks[0].topics[0].evidence,a.topics[0].evidence);assert.equal(tasks[0].targetUrl,null);assert.equal(tasks[0].result,null);assert.equal(a.state,'done');assert.equal(tasks[0].parentAssignment.topics.length,2);
});
test('unmatched topic stays unmatched instead of defaulting to generic navigation',()=>{
 assert.deepEqual(matchPages({title:'Lumico complaints'},[{url:url('faqs'),title:'Lumico complaints'},{url:url('medigap-plans'),title:'Medigap plans'}]),[]);
});

test('BCBS supplement matching recognizes hyphenated URLs and rejects an Advantage-only winner',()=>{
 const pages=[{url:url('blog/bcbs-texas-ending-medicare-advantage-plans-steps-for-2027'),title:'BCBS Texas Medicare Advantage Plan Exit'},{url:url('medicare-supplement-plans/medigap-by-carrier/blue-cross-blue-shield-medigap-plans'),title:'Blue Cross Blue Shield Medicare Supplement Plans'}];
 const matches=matchPages({title:'blue cross blue shield medicare supplement plan g'},pages);
 assert.equal(matches[0].url,pages[1].url);assert.ok(!matches.some(p=>p.url===pages[0].url));
});
