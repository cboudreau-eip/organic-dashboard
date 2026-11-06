import test from 'node:test';
import assert from 'node:assert/strict';
import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {JSDOM} from 'jsdom';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {transform,loadBindings} from 'next/dist/build/swc/index.js';
import {METRIC_HELP} from '../lib/metric-definitions.js';
const require=createRequire(import.meta.url);await loadBindings();
const filename=resolve('components/dashboard/MetricHelp.jsx');
const {code}=await transform(await readFile(filename,'utf8'),{filename,jsc:{parser:{syntax:'ecmascript',jsx:true},transform:{react:{runtime:'automatic'}}},module:{type:'commonjs'}});
const mod={exports:{}};new Function('require','module','exports',code)(name=>name.endsWith('.css')?{}:require(name),mod,mod.exports);
test('help opens by keyboard or tap, has associated text, and dismisses with Escape or outside tap',async()=>{
 const dom=new JSDOM('<div id="root"></div><button id="outside">Outside</button>');
 const old={window:globalThis.window,document:globalThis.document,IS_REACT_ACT_ENVIRONMENT:globalThis.IS_REACT_ACT_ENVIRONMENT};
 Object.assign(globalThis,{window:dom.window,document:dom.window.document,IS_REACT_ACT_ENVIRONMENT:true});
 const root=createRoot(document.getElementById('root'));
 try{
  await act(async()=>root.render(React.createElement(mod.exports.default,{label:'Completion rate',definition:METRIC_HELP.completionRate})));
  const button=document.querySelector('[aria-label="About Completion rate"]');
  await act(async()=>button.focus());
  let tip=document.querySelector('[role="tooltip"]');assert.ok(tip);assert.equal(button.getAttribute('aria-describedby'),tip.id);assert.match(tip.textContent,/Completed quote journeys ÷ quote starts/);
  assert.equal(tip.parentElement,document.body);
  await act(async()=>document.dispatchEvent(new dom.window.KeyboardEvent('keydown',{key:'Escape',bubbles:true})));
  assert.equal(document.querySelector('[role="tooltip"]'),null);assert.equal(document.activeElement,button);
  await act(async()=>button.click());assert.ok(document.querySelector('[role="tooltip"]'));
  await act(async()=>document.getElementById('outside').dispatchEvent(new dom.window.Event('pointerdown',{bubbles:true})));
  assert.equal(document.querySelector('[role="tooltip"]'),null);
  await act(async()=>button.dispatchEvent(new dom.window.MouseEvent('mouseover',{bubbles:true})));assert.ok(document.querySelector('[role="tooltip"]'));
 }finally{await act(async()=>root.unmount());dom.window.close();Object.assign(globalThis,old);}
});
test('definitions retain distinctions and every definition has source, calculation and caveat',()=>{
 for(const value of Object.values(METRIC_HELP))for(const field of ['meaning','calculation','source','limit'])assert.ok(value[field]?.length>10);
 assert.match(METRIC_HELP['single-page session rate'].limit,/not bounce rate/);
 assert.match(METRIC_HELP.policies.limit,/lead-created dates/);
 assert.match(METRIC_HELP.contactSessions.limit,/preceding ZIP step is not required/);
 assert.match(METRIC_HELP.revenue.limit,/not revenue/);
});
