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
import * as journey from '../lib/posthog/quote-journey.js';
import * as overview from '../lib/posthog/overview.js';
import {counts} from '../lib/posthog/conversions.js';
const require=createRequire(import.meta.url);
await loadBindings();
const filename=resolve('components/dashboard/OrganicConversions.jsx');
const {code}=await transform(await readFile(filename,'utf8'),{filename,jsc:{parser:{syntax:'ecmascript',jsx:true},transform:{react:{runtime:'automatic'}}},module:{type:'commonjs'}});
const mod={exports:{}};
new Function('require','module','exports',code)(name=>name.includes('posthog/quote-journey')?journey:name.includes('posthog/period')?period:name.includes('posthog/overview')?overview:name==='./CollapsibleSection'?({children,header})=>React.createElement('section',null,header,children):require(name),mod,mod.exports);
test('partial conversion UI retains current results and recovers on retry without false zeros',async()=>{
 const dom=new JSDOM('<div id="root"></div>',{url:'https://dashboard.example'});
 const old={window:globalThis.window,document:globalThis.document,fetch:globalThis.fetch,IS_REACT_ACT_ENVIRONMENT:globalThis.IS_REACT_ACT_ENVIRONMENT};
 Object.assign(globalThis,{window:dom.window,document:dom.window.document,IS_REACT_ACT_ENVIRONMENT:true});
 const total=counts([100,20,10,8,4,5,12]),base={current:total,previous:null,pages:null,status:'partial',unavailable:['previous','pages'],period:period.reportingPeriod(30),timezone:'America/New_York',fetchedAt:new Date().toISOString()};
 let calls=0;globalThis.fetch=async()=>Response.json(++calls===1?base:{...base,status:'complete',unavailable:[],previous:total,pages:[]});
 const root=createRoot(document.getElementById('root'));
 try{
  await act(async()=>root.render(React.createElement(mod.exports.default,{days:30,detailed:true})));
  let text=document.body.textContent;assert.match(text,/10/);assert.match(text,/8 of 20 quote-start sessions/);assert.match(text,/40.00%/);assert.match(text,/60.00%/);assert.match(text,/Comparison unavailable/);assert.match(text,/Landing-page breakdown unavailable/);assert.doesNotMatch(text,/NaN|No eligible organic sessions/);
  await act(async()=>[...document.querySelectorAll('button')].find(b=>b.textContent==='Retry unavailable data').click());
  text=document.body.textContent;assert.doesNotMatch(text,/Part of this report could not be loaded|Comparison unavailable/);assert.equal(calls,2);
  globalThis.fetch=async()=>Response.json({...base,current:null,previous:total,pages:[],unavailable:['current']});
  await act(async()=>root.render(React.createElement(mod.exports.default,{days:90,detailed:true})));
  text=document.body.textContent;assert.match(text,/selected-period funnel is unavailable/);assert.doesNotMatch(text,/NaN/);
 }finally{await act(async()=>root.unmount());dom.window.close();Object.assign(globalThis,old);}
});

test('background polling preserves saved cards, updates on completion and keeps them on request failure',async()=>{
 const dom=new JSDOM('<div id="root"></div>',{url:'https://dashboard.example'});
 const old={window:globalThis.window,document:globalThis.document,fetch:globalThis.fetch,setTimeout:globalThis.setTimeout,clearTimeout:globalThis.clearTimeout,IS_REACT_ACT_ENVIRONMENT:globalThis.IS_REACT_ACT_ENVIRONMENT};
 let nextPoll;
 Object.assign(globalThis,{window:dom.window,document:dom.window.document,IS_REACT_ACT_ENVIRONMENT:true,setTimeout:fn=>{nextPoll=fn;return 1;},clearTimeout:()=>{nextPoll=null;}});
 const total=counts([100,20,10,8,4,5,12]);
 const base={current:total,previous:total,pages:[],status:'complete',period:period.reportingPeriod(90),timezone:'America/New_York',fetchedAt:'2026-11-05T12:00:00Z',hasSavedReport:true,stale:true,refreshing:true};
 globalThis.fetch=async()=>Response.json(base);
 const root=createRoot(document.getElementById('root'));
 try{
  await act(async()=>root.render(React.createElement(mod.exports.default,{days:90})));
  assert.match(document.body.textContent,/Refreshing in the background/);assert.match(document.body.textContent,/Last successful report retrieval/);
  globalThis.fetch=async()=>{throw Error('Network unavailable');};
  await act(async()=>nextPoll());
  assert.match(document.body.textContent,/Network unavailable/);assert.match(document.body.textContent,/Contact submissions/);assert.match(document.body.textContent,/10/);
  globalThis.fetch=async()=>Response.json({...base,refreshing:false,stale:false});
  await act(async()=>[...document.querySelectorAll('button')].find(b=>b.textContent==='Retry conversions').click());
  assert.doesNotMatch(document.body.textContent,/Network unavailable|Refreshing in the background/);
  let finish;globalThis.fetch=()=>new Promise(resolve=>{finish=resolve;});
  await act(async()=>root.render(React.createElement(mod.exports.default,{days:30})));
  assert.doesNotMatch(document.body.textContent,/Contact submissions/);assert.match(document.body.textContent,/Loading organic/);
  await act(async()=>finish(Response.json({...base,period:period.reportingPeriod(30),refreshing:false})));
 }finally{await act(async()=>root.unmount());dom.window.close();Object.assign(globalThis,old);}
});
