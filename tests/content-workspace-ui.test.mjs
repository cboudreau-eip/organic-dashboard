import test from 'node:test';
import assert from 'node:assert/strict';
import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {JSDOM} from 'jsdom';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {transform,loadBindings} from 'next/dist/build/swc/index.js';
const require=createRequire(import.meta.url);await loadBindings();
const filename=resolve('components/dashboard/ContentWorkspace.jsx');
const {code}=await transform(await readFile(filename,'utf8'),{filename,jsc:{parser:{syntax:'ecmascript',jsx:true},transform:{react:{runtime:'automatic'}}},module:{type:'commonjs'}});
const mod={exports:{}};
new Function('require','module','exports',code)(name=>name.endsWith('.css')?{}:name.startsWith('./')?({onDirtyChange})=>React.createElement('section',{'data-view':name},name,...(onDirtyChange?[React.createElement('button',{key:'edit',onClick:()=>onDirtyChange(true)},'Edit work'),React.createElement('button',{key:'save',onClick:()=>onDirtyChange(false)},'Save work')]:[])):require(name),mod,mod.exports);
test('calendar defaults, research groups its views, and unsaved work blocks navigation',async()=>{
 const dom=new JSDOM('<div id="root"></div>'),old={window:globalThis.window,document:globalThis.document,IS_REACT_ACT_ENVIRONMENT:globalThis.IS_REACT_ACT_ENVIRONMENT};
 Object.assign(globalThis,{window:dom.window,document:dom.window.document,IS_REACT_ACT_ENVIRONMENT:true});
 const root=createRoot(document.getElementById('root'));const button=name=>[...document.querySelectorAll('button')].find(b=>(b.getAttribute('aria-label')||b.textContent)===name);const click=name=>act(async()=>button(name).click());
 try{
  await act(async()=>root.render(React.createElement(mod.exports.default,{active:true})));
  assert.ok(document.querySelector('[data-view="./ProposedAssignments"]'));assert.equal(button('Assignment review'),undefined);
  await click('Research');assert.ok(document.querySelector('[data-view="./ResearchOpportunities"]'));
  await click('Assignment review');assert.ok(document.querySelector('[data-view="./ContentAssignments"]'));assert.equal(button('Research').getAttribute('aria-pressed'),'true');
  await click('Calendar');assert.equal(document.querySelector('[aria-label="Research views"]'),null);
  await click('Research');assert.ok(document.querySelector('[data-view="./ContentAssignments"]'));
  await click('Open original draft');assert.ok(document.querySelector('[data-view="./ContentPlan"]'));
  await click('Work queue');await click('Edit work');assert.equal(button('Calendar').disabled,true);assert.equal(button('Research').disabled,true);
  await click('Research');assert.ok(document.querySelector('[data-view="./WorkQueue"]'));
  await click('Save work');await click('Calendar');assert.ok(document.querySelector('[data-view="./ProposedAssignments"]'));
 }finally{await act(async()=>root.unmount());Object.assign(globalThis,old);dom.window.close();}
});
