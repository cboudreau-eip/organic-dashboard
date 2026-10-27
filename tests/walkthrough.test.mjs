import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {transform,loadBindings} from 'next/dist/build/swc/index.js';
import * as helpers from '../components/dashboard/walkthrough.js';
const require=createRequire(import.meta.url);
test('visible controls include closed summaries but exclude hidden content',()=>{
 const dom=new JSDOM('<div hidden><button data-nav="acquisition">Hidden</button></div><button data-nav="acquisition">Visible</button><details><summary>Lead impact</summary><button id="save">Save</button></details>');
 const doc=dom.window.document;
 assert.equal(helpers.visibleTarget('[data-nav]',doc).textContent,'Visible');
 assert.ok(helpers.visibleTarget('summary',doc));assert.equal(helpers.visibleTarget('#save',doc),null);
 dom.window.close();
});
test('waiting, skip, restart, escape, replay and unmount never write data',async()=>{
 const dom=new JSDOM('<div id="root"></div><button data-nav="acquisition">Acquisition</button><div id="gsc-live-host" hidden></div>');
 const previous={window:globalThis.window,document:globalThis.document,act:globalThis.IS_REACT_ACT_ENVIRONMENT,fetch:globalThis.fetch};
 globalThis.window=dom.window;globalThis.document=dom.window.document;globalThis.IS_REACT_ACT_ENVIRONMENT=true;
 let writes=0,tick;globalThis.fetch=()=>{writes++;throw Error('Tour must not save');};
 const intervals=new Set();dom.window.setInterval=fn=>{tick=fn;intervals.add(fn);return fn;};dom.window.clearInterval=fn=>intervals.delete(fn);
 let root;
 try{
  const source=await readFile(new URL('../components/dashboard/Walkthrough.jsx',import.meta.url),'utf8');
  await loadBindings();
  const {code}=await transform(source,{filename:'Walkthrough.jsx',jsc:{parser:{syntax:'ecmascript',jsx:true},transform:{react:{runtime:'automatic'}}},module:{type:'commonjs'}});
  const module={exports:{}};
  new Function('require','module','exports',code)(name=>name==='./walkthrough'?helpers:name.endsWith('.css')?{}:require(name),module,module.exports);
  root=createRoot(document.getElementById('root'));
  await act(async()=>root.render(React.createElement(module.exports.default,{allowed:true})));
  const button=name=>[...document.querySelectorAll('button')].find(b=>b.textContent===name);
  const click=async name=>{assert.ok(button(name),name);await act(async()=>button(name).click());};
  await click('Help & walkthroughs');await click('Start walkthrough');
  assert.equal(button('Next').disabled,true);
  assert.ok(document.querySelector('[data-nav]').classList.contains('walkthrough-highlight'));
  document.getElementById('gsc-live-host').hidden=false;
  await act(async()=>tick());assert.equal(button('Next').disabled,false);
  await click('Next');assert.equal(button('Next').disabled,true);
  await click('Skip step');assert.match(document.querySelector('#walkthrough-panel h2').textContent,/Load/);
  await click('Back');await click('Restart');assert.match(document.querySelector('.walkthrough-top').textContent,/STEP 1/);
  await act(async()=>document.dispatchEvent(new dom.window.KeyboardEvent('keydown',{key:'Escape',bubbles:true})));
  assert.equal(document.querySelector('#walkthrough-panel'),null);assert.equal(document.querySelector('.walkthrough-highlight'),null);
  assert.equal(document.body.classList.contains('walkthrough-active'),false);assert.equal(intervals.size,0);
  assert.equal(document.activeElement,button('Help & walkthroughs'));
  await click('Help & walkthroughs');await click('Start walkthrough');
  await act(async()=>root.unmount());root=null;
  assert.equal(intervals.size,0);assert.equal(document.querySelector('.walkthrough-highlight'),null);assert.equal(writes,0);
 }finally{
  if(root)await act(async()=>root.unmount());
  globalThis.window=previous.window;globalThis.document=previous.document;globalThis.fetch=previous.fetch;globalThis.IS_REACT_ACT_ENVIRONMENT=previous.act;dom.window.close();
 }
});
