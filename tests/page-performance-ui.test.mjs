import test from 'node:test';
import assert from 'node:assert/strict';
import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {JSDOM} from 'jsdom';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {transform,loadBindings} from 'next/dist/build/swc/index.js';
import * as period from '../lib/posthog/period.js';
const require=createRequire(import.meta.url);await loadBindings();
const filename=resolve('components/dashboard/PagePerformance.jsx');
const {code}=await transform(await readFile(filename,'utf8'),{filename,jsc:{parser:{syntax:'ecmascript',jsx:true},transform:{react:{runtime:'automatic'}}},module:{type:'commonjs'}});
const mod={exports:{}};
new Function('require','module','exports',code)(name=>name==='./MetricHelp'?()=>null:name.endsWith('.css')?{}:name.includes('posthog/period')?period:require(name),mod,mod.exports);
test('page filtering, missing values, and failed requests are visible',async()=>{
 const dom=new JSDOM('<div id="root"></div>',{url:'https://example.com'});
 const old={window:globalThis.window,document:globalThis.document,fetch:globalThis.fetch,IS_REACT_ACT_ENVIRONMENT:globalThis.IS_REACT_ACT_ENVIRONMENT};
 Object.assign(globalThis,{window:dom.window,document:dom.window.document,IS_REACT_ACT_ENVIRONMENT:true});
 globalThis.fetch=async()=>Response.json({period:period.reportingPeriod(30),timezone:'America/New_York',fetchedAt:'2026-11-09T12:00:00Z',unavailable:[],rows:[{path:'/blog/a/',local:false,engagement:{sessions:20,scroll:null}},{path:'/medicare-supplement-plans/florida/',local:true,engagement:{sessions:10,scroll:50}}]});
 const root=createRoot(document.getElementById('root'));
 try{
  await act(async()=>root.render(React.createElement(mod.exports.default,{days:30})));
  assert.equal(document.querySelectorAll('article').length,2);assert.match(document.body.textContent,/Unavailable/);
  const select=document.querySelector('select');await act(async()=>{select.value='local';select.dispatchEvent(new dom.window.Event('change',{bubbles:true}));});
  assert.equal(document.querySelectorAll('article').length,1);assert.match(document.querySelector('article').textContent,/florida/);
  globalThis.fetch=async()=>{throw Error('Test network failure');};await act(async()=>root.render(React.createElement(mod.exports.default,{days:7})));
  assert.match(document.body.textContent,/Test network failure/);assert.equal(document.querySelectorAll('article').length,0);
 }finally{await act(async()=>root.unmount());dom.window.close();Object.assign(globalThis,old);}
});
