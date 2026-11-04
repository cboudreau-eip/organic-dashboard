import test from 'node:test';
import assert from 'node:assert/strict';
import {compareReports} from '../lib/otterly/changes.js';
import {REPORT_ID,WORKSPACE_ID} from '../lib/otterly/report.js';
const prompt=(id,mentions,domainMentions)=>({id,prompt:'Question '+id,mentions,domainMentions});
const report=(end,rows)=>({reportId:REPORT_ID,workspaceId:WORKSPACE_ID,domain:'medicarefaq.com',country:'us',period:{start:end==='2026-11-03'?'2026-10-05':'2026-10-04',end},prompts:rows,promptPlatforms:[{id:'chatgpt',prompts:rows}],fetchedAt:end+'T14:00:00Z'});
test('compares matching platform prompts and distinguishes gains, losses, zeros and missing metrics',()=>{
 const old=report('2026-11-02',[prompt('a',0,8),prompt('b',4,null),prompt('c',0,0)]);
 const now=report('2026-11-03',[prompt('a',3,2),prompt('b',4,9),prompt('c',0,0)]);
 const r=compareReports(now,old);assert.equal(r.available,true);assert.equal(r.overlap,true);assert.equal(r.rows.length,1);assert.deepEqual(r.rows[0].changes,{mentions:{before:0,after:3,delta:3},domainMentions:{before:8,after:2,delta:-6}});assert.deepEqual(r.totals.mentions,{up:1,down:0,unchanged:2});assert.deepEqual(r.totals.domainMentions,{up:0,down:1,unchanged:1});
});
test('new, removed, renamed prompts and unavailable platforms are not treated as gains or losses',()=>{
 const old=report('2026-11-02',[prompt('removed',8,9),prompt('renamed',2,2)]);
 const now=report('2026-11-03',[prompt('new',5,5),{...prompt('renamed',0,0),prompt:'Different question'}]);
 assert.equal(compareReports(now,old).available,false);
 now.promptPlatforms=null;assert.equal(compareReports(now,old).available,false);
});
test('requires prior report, matching scope, equal duration and earlier dates',()=>{
 const old=report('2026-11-02',[prompt('a',1,1)]),now=report('2026-11-03',[prompt('a',2,2)]);
 assert.equal(compareReports(now,null).available,false);
 for(const changed of [{...old,country:'gb'},{...old,domain:'other.com'},{...old,period:now.period},{...old,period:{start:'2026-10-01',end:'2026-11-02'}}])assert.equal(compareReports(now,changed).available,false);
});
test('one unavailable metric does not suppress the other or invent zero',()=>{
 const old=report('2026-11-02',[prompt('a',null,0)]),now=report('2026-11-03',[prompt('a',3,2)]);
 const r=compareReports(now,old);assert.equal(r.rows[0].changes.mentions,undefined);assert.equal(r.rows[0].changes.domainMentions.delta,2);assert.equal(r.totals.mentions.up,0);
});
