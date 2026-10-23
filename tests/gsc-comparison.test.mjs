import test from 'node:test';
import assert from 'node:assert/strict';
import {compareRows,selectRows,paginateRows,COMPARISON_LIMIT} from '../lib/gsc/comparison.js';
const row=(key,clicks,impressions=100,position=12)=>({keys:[key],clicks,impressions,ctr:impressions?clicks/impressions:null,position:impressions?position:null});

test('full union retains prior-only rows and computes measured deltas',()=>{
  const rows=compareRows([row('both',30,200,8),row('current-only',8)],[row('both',20,100,12),row('prior-only',50)]);
  assert.equal(rows.length,3);
  const both=rows.find(r=>r.key==='both');
  assert.equal(both.clicksChange,10);
  assert.equal(both.clicksPercent,50);
  assert.equal(both.impressionsChange,100);
  assert.ok(Math.abs(both.ctrChange+5)<1e-9);
  assert.equal(both.positionChange,4);
  const missing=rows.find(r=>r.key==='prior-only');
  assert.equal(missing.current,null);
  assert.equal(missing.previous.clicks,50);
  assert.equal(missing.clicksChange,null);
  assert.equal(missing.positionChange,null);
});
test('zero baseline never creates Infinity or a fake ranking',()=>{
  const [r]=compareRows([row('zero',3)],[row('zero',0,0)]);
  assert.equal(r.clicksPercent,null);
  assert.equal(r.clicksChange,3);
  assert.equal(r.ctrChange,null);
  assert.equal(r.positionChange,null);
});
test('filters distinguish measured losses from unreported rows',()=>{
  const rows=compareRows([row('gain',20),row('loss',5),row('same',10),row('new',3)],[row('gain',10),row('loss',10),row('same',10),row('missing',20)]);
  assert.deepEqual(selectRows(rows,{filter:'gainers'}).map(r=>r.key),['gain']);
  assert.deepEqual(selectRows(rows,{filter:'losers'}).map(r=>r.key),['loss']);
  assert.deepEqual(selectRows(rows,{filter:'unmatched'}).map(r=>r.key),['new','missing']);
  assert.equal(selectRows(rows,{search:'  LOSS  '})[0].key,'loss');
});
test('sorting is numeric, stable and missing values stay last in either direction',()=>{
  const rows=compareRows([row('b',100),row('a',2),row('c',2)],[row('prior',50)]);
  assert.deepEqual(selectRows(rows,{sort:'current.clicks',direction:'asc'}).map(r=>r.key),['a','c','b','prior']);
  assert.deepEqual(selectRows(rows,{sort:'current.clicks',direction:'desc'}).map(r=>r.key),['b','a','c','prior']);
  assert.deepEqual(selectRows(rows,{sort:'key',direction:'asc'}).map(r=>r.key),['a','b','c','prior']);
  assert.deepEqual(rows.map(r=>r.key),['b','a','c','prior']);
});
test('pagination clamps after filtering and supports last and empty pages',()=>{
  const rows=Array.from({length:57},(_,i)=>i);
  assert.deepEqual(paginateRows(rows,3,25),{page:3,pages:3,rows:rows.slice(50)});
  assert.equal(paginateRows(rows,8,50).page,2);
  assert.equal(paginateRows(rows,-1,25).page,1);
  assert.deepEqual(paginateRows([],9,25),{page:1,pages:1,rows:[]});
});
test('larger retrieval retains a losing page outside the current top 100',()=>{
  const current=Array.from({length:150},(_,i)=>row('page-'+i,150-i));
  const rows=compareRows(current,[row('page-149',200),row('vanished',300)]);
  assert.equal(selectRows(rows,{filter:'losers'})[0].key,'page-149');
  assert.equal(selectRows(rows,{filter:'unmatched'}).some(r=>r.key==='vanished'),true);
  assert.equal(COMPARISON_LIMIT,2500);
});
