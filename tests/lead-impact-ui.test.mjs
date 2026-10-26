import test from 'node:test';
import assert from 'node:assert/strict';
import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {JSDOM} from 'jsdom';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {transform,loadBindings} from 'next/dist/build/swc/index.js';
const require=createRequire(import.meta.url);
await loadBindings();
const filename=resolve('components/dashboard/LeadImpact.jsx');
const {code}=await transform(await readFile(filename,'utf8'),{filename,jsc:{parser:{syntax:'ecmascript',jsx:true},transform:{react:{runtime:'automatic'}}},module:{type:'commonjs'}});
const mod={exports:{}};
new Function('require','module','exports',code)(name=>name==='./SaveOpportunity'?{__esModule:true,default:()=>null}:require(name.startsWith('.')?resolve('components/dashboard',name+'.js'):name),mod,mod.exports);
const LeadImpact=mod.exports.default;
test('date changes hide stale contacts, cancel old requests, and recover from errors',async()=>{
 const dom=new JSDOM('<div id="root"></div>',{url:'https://dashboard.example'});
 const saved={window:globalThis.window,document:globalThis.document,fetch:globalThis.fetch,IS_REACT_ACT_ENVIRONMENT:globalThis.IS_REACT_ACT_ENVIRONMENT};
 Object.assign(globalThis,{window:dom.window,document:dom.window.document,IS_REACT_ACT_ENVIRONMENT:true});
 const pending=[];
 globalThis.fetch=(url,options)=>new Promise(resolve=>pending.push({url,options,resolve}));
 const root=createRoot(document.getElementById('root'));
 const groups=[{url:'https://www.medicarefaq.com/plans/',pageTwo:1,gsc:{clicksChange:-10}}];
 const period={start:'2026-10-19',end:'2026-10-25',priorStart:'2026-10-12',priorEnd:'2026-10-18'};
 const render=p=>React.createElement(LeadImpact,{groups,result:{period:p},Pagination:()=>null});
 const data={current:{rows:[{host:'www.medicarefaq.com',path:'/plans/',sessions:100,contactSessions:7,rate:7,phoneSessions:0}],truncated:false,limit:2500},previous:{rows:[],truncated:false},fetchedAt:'2026-10-26T12:00:00Z'};
 try{
  await act(async()=>root.render(render(period)));
  assert.equal(pending.length,0);
  await act(async()=>{const d=document.querySelector('details');d.open=true;d.dispatchEvent(new dom.window.Event('toggle'));});
  assert.equal(pending.length,1);
  await act(async()=>pending[0].resolve({ok:true,json:async()=>data}));
  assert.match(document.body.textContent,/7.00%/);
  const next={...period,start:'2026-10-20'};
  await act(async()=>root.render(render(next)));
  assert.equal(pending[0].options.signal.aborted,true);
  assert.doesNotMatch(document.body.textContent,/7.00%/);
  assert.match(document.body.textContent,/Loading landing-page contacts/);
  await act(async()=>pending[1].resolve({ok:false,json:async()=>({error:'Temporary outage'})}));
  assert.match(document.body.textContent,/Temporary outage/);
  await act(async()=>document.querySelector('button').dispatchEvent(new dom.window.MouseEvent('click',{bubbles:true})));
  assert.equal(pending.length,3);
  await act(async()=>pending[2].resolve({ok:true,json:async()=>data}));
  assert.match(document.body.textContent,/7.00%/);
 }finally{
  await act(async()=>root.unmount());dom.window.close();Object.assign(globalThis,saved);
 }
});
