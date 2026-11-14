import test from 'node:test';
import assert from 'node:assert/strict';
import {discoveryQueue} from '../lib/research/discovery.js';
const item=(key,patch={})=>({key,title:key,terms:['compare medicare supplement plan g costs'],score:60,evidence:{gsc:[{impressions:2}],semrush:[],otterly:[]},...patch});
test('discovery distinguishes review from implementation and retains low-volume long-tail',()=>{
 const result=discoveryQueue([item('old'),item('new'),item('alias',{previousKeys:['old']})],['old']);
 assert.deepEqual(result.shortlist,['new']);assert.equal(result.counts.previouslyEvaluated,2);
 assert.equal(result.items.find(x=>x.key==='new').discovery.longTail,true);
 assert.ok(result.items.every(x=>x.discovery.implementationReady===false));
 assert.equal(result.items.find(x=>x.key==='new').evidence.gsc[0].impressions,2);
});
test('shortlist diversifies matched pages without inventing more candidates',()=>{
 const rows=Array.from({length:30},(_,i)=>item(String(i),{targetUrl:'https://www.medicarefaq.com/same/'}));
 const result=discoveryQueue(rows);assert.equal(result.shortlist.length,2);assert.equal(result.items.length,30);
 assert.equal(discoveryQueue([]).shortlist.length,0);
});
test('specificity bonus cannot overwhelm materially stronger supported priority',()=>{
 const result=discoveryQueue([item('long',{score:50}),item('strong',{score:80,terms:['medigap quotes']})]);
 assert.equal(result.items[0].key,'strong');
});

test('changed grouping keys and year variants do not recycle previously evaluated wording',()=>{
 const result=discoveryQueue([item('changed',{terms:['compare medicare supplement plan g costs 2027']})],[],['compare medicare supplement plan g costs 2026']);
 assert.equal(result.shortlist.length,0);assert.equal(result.counts.previouslyEvaluated,1);
});
