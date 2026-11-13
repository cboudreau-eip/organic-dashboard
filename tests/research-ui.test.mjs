import test from 'node:test';
import assert from 'node:assert/strict';
import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {JSDOM} from 'jsdom';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {transform,loadBindings} from 'next/dist/build/swc/index.js';
import * as contracts from '../lib/research/contracts.js';
import {rankOpportunities} from '../lib/research/rank.js';
const require=createRequire(import.meta.url),mods={};await loadBindings();
for(const name of ['ResearchSettings','ResearchDetail','ResearchOpportunities']){
 const filename=resolve('components/dashboard/'+name+'.jsx');
 const {code}=await transform(await readFile(filename,'utf8'),{filename,jsc:{parser:{syntax:'ecmascript',jsx:true},transform:{react:{runtime:'automatic'}}},module:{type:'commonjs'}});
 const mod={exports:{}};new Function('require','module','exports',code)(path=>path.endsWith('.css')?{}:path.includes('research/contracts')?contracts:mods[path.replace('./','')]||require(path),mod,mod.exports);mods[name]=mod.exports;
}
test('research UI runs collection, opens evidence and saves decisions without generating content',async()=>{
 const dom=new JSDOM('<div id="root"></div>',{url:'https://dashboard.example'});
 const old={window:globalThis.window,document:globalThis.document,fetch:globalThis.fetch,IS_REACT_ACT_ENVIRONMENT:globalThis.IS_REACT_ACT_ENVIRONMENT};
 const results=rankOpportunities({otterly:{prompts:[{prompt:'compare medigap plan g quotes',id:'p',mentions:0,domainMentions:0}]}},[],contracts.DEFAULTS,false);
 let run=null,reviews=[],saved=0;const calls=[];
 const view=()=>({settings:{settings:contracts.DEFAULTS,version:1},canEdit:true,run,reviews,runs:run?[run]:[]});
 Object.assign(globalThis,{window:dom.window,document:dom.window.document,IS_REACT_ACT_ENVIRONMENT:true,fetch:async(url,options)=>{
  if(!options?.method)return Response.json(view());const body=JSON.parse(options.body);calls.push(body.action);
  if(body.action==='start'){run={id:'11111111-1111-4111-8111-111111111111',settings:contracts.DEFAULTS,status:'running',stage:'rank',version:1,created_at:new Date().toISOString(),sources:{},inventory:{read:0,total:0,processed:0,errors:[]}};return Response.json({run});}
  if(body.action==='step'){run={...run,status:'complete',stage:'complete',version:2,results};return Response.json({run});}
  if(body.action==='review'){saved++;reviews=[{...body,run_id:body.runId,version:saved,updated_at:new Date().toISOString()}];return Response.json({review:reviews[0]});}
  throw Error('Unexpected action');
 }});
 const root=createRoot(document.getElementById('root'));
 const click=label=>act(async()=>[...document.querySelectorAll('button')].find(b=>b.textContent===label).click());
 try{
  await act(async()=>root.render(React.createElement(mods.ResearchOpportunities.default,{active:true})));
  await click('Start new research');assert.equal(document.querySelectorAll('.plan-card').length,1);
  await click('Review evidence');assert.match(document.body.textContent,/Unknown/);assert.match(document.body.textContent,/No matched page-level evidence/);
  const select=document.querySelector('.research-review select');
  await act(async()=>{select.value='Keep';select.dispatchEvent(new dom.window.Event('change',{bubbles:true}));});
  await click('Save review decision');assert.equal(reviews[0].decision,'Keep');assert.equal(saved,1);
  await click('Back to review queue');assert.match(document.querySelector('.plan-card').textContent,/Keep/);
  assert.deepEqual(calls,['start','step','review']);assert.equal(document.querySelector('[role=grid]'),null);
 }finally{await act(async()=>root.unmount());Object.assign(globalThis,old);dom.window.close();}
});
