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
import * as resolution from '../lib/research/resolution.js';
import * as assignmentDisplay from '../lib/research/assignment-display.js';
import {failedValidation} from '../lib/research/validation.js';
const require=createRequire(import.meta.url),mods={};await loadBindings();
for(const name of ['AssignmentVerification','AssignmentResolution','AssignmentDetail','ContentAssignments']){const filename=resolve('components/dashboard/'+name+'.jsx');const {code}=await transform(await readFile(filename,'utf8'),{filename,jsc:{parser:{syntax:'ecmascript',jsx:true},transform:{react:{runtime:'automatic'}}},module:{type:'commonjs'}});const mod={exports:{}};new Function('require','module','exports',code)(path=>path.endsWith('.css')?{}:path.includes('research/contracts')?contracts:path.includes('assignment-display')?assignmentDisplay:path.includes('research/resolution')?resolution:mods[path.replace('./','')]||require(path),mod,mod.exports);mods[name]=mod.exports;}
test('assignment UI runs validation, exposes evidence and persists review without content generation',async()=>{
 const dom=new JSDOM('<div id="root"></div>',{url:'https://dashboard.example'}),old={window:globalThis.window,document:globalThis.document,fetch:globalThis.fetch,IS_REACT_ACT_ENVIRONMENT:globalThis.IS_REACT_ACT_ENVIRONMENT};
 const id='11111111-1111-4111-8111-111111111111',a={key:'a'.repeat(24),title:'Plan G comparison',topics:[{key:'b',title:'Compare Plan G',terms:[],evidence:{gsc:[],semrush:[],otterly:[]}}],state:'pending'};let run=null,reviews=[];const calls=[];
 const view=()=>({sourceId:id,runs:[{id,created_at:new Date().toISOString()}],run,reviews,canEdit:true,configured:true});
 Object.assign(globalThis,{window:dom.window,document:dom.window.document,IS_REACT_ACT_ENVIRONMENT:true,fetch:async(url,opts)=>{if(!opts?.method)return Response.json(view());const input=JSON.parse(opts.body);calls.push(input.action);if(input.action==='start'){run={id,status:'running',version:1,created_at:new Date().toISOString(),payload:{assignments:[a],sourceDates:{},selectedCount:1}};return Response.json({run});}if(input.action==='step'){a.state='done';a.result=failedValidation('Search could not complete',a);run={...run,status:'complete',version:3};return Response.json({run});}if(input.action==='review'){reviews=[{...input,assignment_key:input.key,version:1,updated_at:new Date().toISOString()}];return Response.json({review:reviews[0]});}throw Error('Unexpected mutation');}});
 const root=createRoot(document.getElementById('root'));const click=label=>act(async()=>[...document.querySelectorAll('button')].find(b=>b.textContent===label).click());
 try{await act(async()=>root.render(React.createElement(mods.ContentAssignments.default,{active:true})));await click('Validate top 20');assert.match(document.body.textContent,/Validation saved/);assert.equal(document.querySelectorAll('.assignment-card').length,1);assert.equal([...document.querySelectorAll('option')].find(o=>o.textContent==='Keep'&&o.disabled)?.disabled,true);await click('Save assignment review');assert.match(document.body.textContent,/Assignment review saved/);assert.equal(reviews[0].decision,'Needs review');assert.deepEqual(calls,['start','step','review']);assert.equal(document.querySelector('[role=grid]'),null);}finally{await act(async()=>root.unmount());Object.assign(globalThis,old);dom.window.close();}
});

test('resolution control saves a new snapshot, displays precise blockers and filters without generating content',async()=>{
 const dom=new JSDOM('<div id="root"></div>',{url:'https://dashboard.example'}),old={window:globalThis.window,document:globalThis.document,fetch:globalThis.fetch,IS_REACT_ACT_ENVIRONMENT:globalThis.IS_REACT_ACT_ENVIRONMENT};
 const id='11111111-1111-4111-8111-111111111111',a={key:'a'.repeat(24),title:'Plan G comparison',topics:[{key:'one',title:'Compare Plan G',terms:[],evidence:{gsc:[],semrush:[],otterly:[]}}],state:'done',result:{...failedValidation('An earlier check failed',{}),resolution:null}};
 let run={id,status:'complete',rules_version:'validation-v2',version:1,created_at:new Date().toISOString(),payload:{assignments:[a],sourceDates:{},selectedCount:1}},calls=[];
 const view=()=>({sourceId:id,runs:[{id,created_at:new Date().toISOString()}],run,reviews:[],canEdit:true,configured:true,currentRules:'validation-v2'});
 Object.assign(globalThis,{window:dom.window,document:dom.window.document,IS_REACT_ACT_ENVIRONMENT:true,fetch:async(url,opts)=>{if(!opts?.method)return Response.json(view());const input=JSON.parse(opts.body);calls.push(input.action);if(input.action==='resolve'){assert.equal(input.id,id);assert.equal(input.version,1);run={...run,id:'new',status:'running',payload:{...run.payload,resolution:{version:'resolution-v2',selected:1}}};return Response.json({run});}if(input.action==='step'){a.result={...a.result,retryable:false,resolution:{version:'resolution-v2',blockers:[{code:'authority',question:'Which dated carrier document supports the proposed comparison?'}],optionalChecks:[],matchedPages:[]}};run={...run,status:'complete'};return Response.json({run});}throw Error('Unexpected action');}});
 const root=createRoot(document.getElementById('root'));
 try{await act(async()=>root.render(React.createElement(mods.ContentAssignments.default,{active:true})));await act(async()=>[...document.querySelectorAll('button')].find(b=>b.textContent==='Resolve research blockers').click());assert.deepEqual(calls,['resolve','step']);assert.match(document.body.textContent,/Which dated carrier document/);assert.equal([...document.querySelectorAll('button')].find(b=>b.textContent==='Resolve research blockers').disabled,true);
 const filter=[...document.querySelectorAll('label')].find(l=>l.textContent.startsWith('Research blocker')).querySelector('select');await act(async()=>{filter.value='technical';filter.dispatchEvent(new dom.window.Event('change',{bubbles:true}));});assert.equal(document.querySelectorAll('.assignment-card').length,0);assert.equal(document.querySelector('[role=grid]'),null);
 }finally{await act(async()=>root.unmount());Object.assign(globalThis,old);dom.window.close();}
});
