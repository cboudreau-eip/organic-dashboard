import test from 'node:test';
import assert from 'node:assert/strict';
import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {JSDOM} from 'jsdom';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import * as contracts from '../lib/content-plan/contracts.js';
import {resolve} from 'node:path';
import {transform,loadBindings} from 'next/dist/build/swc/index.js';
const require=createRequire(import.meta.url);
await loadBindings();
const filename=resolve('components/dashboard/ContentPlan.jsx');
const {code}=await transform(await readFile(filename,'utf8'),{filename,jsc:{parser:{syntax:'ecmascript',jsx:true},transform:{react:{runtime:'automatic'}}},module:{type:'commonjs'}});
const mod={exports:{}};
new Function('require','module','exports',code)(name=>name.endsWith('.css')?{}:name==='./ContentPlanEditor'?()=>null:name.includes('content-plan/contracts')?contracts:require(name),mod,mod.exports);
const data=JSON.parse(await readFile('docs/content-plan/shortlist-draft.json','utf8'));
test('draft opportunities show evidence and calendar has correct 2027 dates without invented schedule',async()=>{
 const dom=new JSDOM('<div id="root"></div>',{url:'https://dashboard.example'});
 const old={window:globalThis.window,document:globalThis.document,fetch:globalThis.fetch,IS_REACT_ACT_ENVIRONMENT:globalThis.IS_REACT_ACT_ENVIRONMENT};
 Object.assign(globalThis,{window:dom.window,document:dom.window.document,fetch:async()=>Response.json(data),IS_REACT_ACT_ENVIRONMENT:true});
 const root=createRoot(document.getElementById('root'));
 const click=async label=>act(async()=>[...document.querySelectorAll('button')].find(b=>b.textContent===label||b.getAttribute('aria-label')===label).click());
 try{
  await act(async()=>root.render(React.createElement(mod.exports.default,{active:true})));
  assert.equal(document.querySelectorAll('.plan-card').length,15);
  await click('Review brief');assert.match(document.body.textContent,/Observed Google queries/);assert.match(document.body.textContent,/not confirmed query-to-page matches/);
  await click('Calendar');assert.equal(document.querySelectorAll('[role="gridcell"]').length,31);
  assert.equal(document.querySelectorAll('[role="gridcell"] button').length,0);
  await click('Next month');assert.equal(document.querySelectorAll('[role="gridcell"]').length,28);
  await click('Next month');assert.equal(document.querySelectorAll('[role="gridcell"]').length,31);
  assert.equal(document.querySelector('[aria-label="Next month"]').disabled,true);
  assert.ok(data.items.every(x=>x.scheduledDate===null));
 }finally{await act(async()=>root.unmount());Object.assign(globalThis,old);dom.window.close();}
});
