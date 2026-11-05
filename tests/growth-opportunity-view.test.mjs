import test from 'node:test';
import assert from 'node:assert/strict';
import React,{act,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {JSDOM} from 'jsdom';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {transform,loadBindings} from 'next/dist/build/swc/index.js';
import * as helpers from '../lib/growth-hunter/opportunity-view.js';
const require=createRequire(import.meta.url);
const prior={clicks:200,impressions:2000,ctr:.1,position:3};
const first={url:'https://www.medicarefaq.com/faqs/first-page/',prior,current:{clicks:100,impressions:1800,ctr:.055,position:5},lostClicks:100,declinePercent:50};
const second={url:'https://www.medicarefaq.com/faqs/second-page/',prior,current:{clicks:150,impressions:2000,ctr:.075,position:3},lostClicks:50,declinePercent:25};
test('queue filters and sorts without altering saved findings and preserves missing contact evidence',()=>{
 const rows=[second,first];assert.equal(helpers.visibleOpportunities(rows)[0],first);assert.equal(rows[0],second);
 assert.deepEqual(helpers.visibleOpportunities(rows,{signal:'ctr'}),[second]);assert.deepEqual(helpers.visibleOpportunities(rows,{query:'first page'}),[first]);
 assert.equal(helpers.contactLabel(), 'Not checked');assert.equal(helpers.contactLabel({current:null,previous:null}),'Unavailable');
 assert.equal(helpers.contactLabel({current:{contactSessions:0},previous:{contactSessions:2}}),'2 fewer contacts');
 assert.equal(helpers.contactLabel({current:{contactSessions:0},previous:{contactSessions:0}}),'Contacts unchanged');
});
await loadBindings();
const filename=resolve('components/growth-hunter/OpportunityReview.jsx');
const {code}=await transform(await readFile(filename,'utf8'),{filename,jsc:{parser:{syntax:'ecmascript',jsx:true},transform:{react:{runtime:'automatic'}}},module:{type:'commonjs'}});
function Draft(){const [value,setValue]=useState('Original plan');return React.createElement('input',{'aria-label':'Test draft',value,onChange:e=>setValue(e.target.value)});}
const mod={exports:{}};
new Function('require','module','exports',code)(name=>name.includes('opportunity-view')?helpers:name==='./DeclinePlan'?Draft:name==='./ContentSuggestion'?()=>React.createElement('div',null,'Content suggestion'):name==='./KeywordResearch'?()=>React.createElement('div',null,'Keyword evidence'):require(name),mod,mod.exports);
test('only one review is visible and returning to the list preserves edited work',async()=>{
 const dom=new JSDOM('<div id="root"></div>',{url:'https://dashboard.example'});
 const old={window:globalThis.window,document:globalThis.document,IS_REACT_ACT_ENVIRONMENT:globalThis.IS_REACT_ACT_ENVIRONMENT};
 Object.assign(globalThis,{window:dom.window,document:dom.window.document,IS_REACT_ACT_ENVIRONMENT:true});
 const root=createRoot(document.getElementById('root'));
 const run={id:'test-run',created_at:'2026-11-04T12:00:00Z',detector_version:'v1',result:{findings:[first,second],candidateCount:2,displayLimit:20,matchedPages:10,priorOnlyPages:0,currentOnlyPages:0,currentPeriod:{start:'2026-10-01',end:'2026-10-28'},priorPeriod:{start:'2026-09-03',end:'2026-09-30'},thresholds:{},limitations:[]}};
 const click=async name=>act(async()=>[...document.querySelectorAll('button')].find(b=>b.getAttribute('aria-label')===name||b.textContent===name).dispatchEvent(new dom.window.MouseEvent('click',{bubbles:true})));
 try{
  await act(async()=>root.render(React.createElement(mod.exports.default,{run,canRun:true})));
  assert.equal(document.querySelectorAll('.growth-review').length,0);
  await click('Review opportunity: First page');
  const input=document.querySelector('input[aria-label="Test draft"]');
  // Invoke React's input event through its installed props to avoid JSDOM focus/polyfill differences.
  const props=input[Object.keys(input).find(k=>k.startsWith('__reactProps'))];await act(async()=>props.onChange({target:{value:'Keep my edited plan'}}));
  await click('← Back to opportunities');assert.equal(document.querySelector('.growth-queue-controls').closest('[hidden]'),null);
  await click('Review opportunity: Second page');
  assert.equal([...document.querySelectorAll('.growth-review')].filter(el=>!el.closest('[hidden]')).length,1);
  await act(async()=>[...document.querySelectorAll('.growth-review')].find(el=>!el.closest('[hidden]')).querySelector('button').click());
  await click('Review opportunity: First page');assert.equal(document.querySelector('input[aria-label="Test draft"]').value,'Keep my edited plan');
 }finally{await act(async()=>root.unmount());dom.window.close();Object.assign(globalThis,old);}
});
