import test from 'node:test';import assert from 'node:assert/strict';import React,{act} from 'react';import {createRoot} from 'react-dom/client';import {JSDOM} from 'jsdom';import {readFile} from 'node:fs/promises';import {createRequire} from 'node:module';import {resolve} from 'node:path';import {transform,loadBindings} from 'next/dist/build/swc/index.js';
const require=createRequire(import.meta.url);await loadBindings();const filename=resolve('components/dashboard/WorkQueue.jsx'),{code}=await transform(await readFile(filename,'utf8'),{filename,jsc:{parser:{syntax:'ecmascript',jsx:true},transform:{react:{runtime:'automatic'}}},module:{type:'commonjs'}}),mod={exports:{}};
new Function('require','module','exports',code)(p=>p.endsWith('.css')?{}:p==='../../lib/work-queue/model'?require('../lib/work-queue/model.js'):require(p),mod,mod.exports);
test('pilot UI starts five tasks, changes workflow status, protects unsaved edits and exports saved Markdown',async()=>{
 const dom=new JSDOM('<div id="root"></div>',{url:'https://dashboard.example'}),old={window:globalThis.window,document:globalThis.document,fetch:globalThis.fetch,IS_REACT_ACT_ENVIRONMENT:globalThis.IS_REACT_ACT_ENVIRONMENT};let queue=null,downloaded='',calls=[];
 Object.assign(globalThis,{window:dom.window,document:dom.window.document,IS_REACT_ACT_ENVIRONMENT:true,fetch:async(url,opts)=>{
 if(!opts?.method)return Response.json({queue,plan:{id:'plan',version:1},canEdit:true});const input=JSON.parse(opts.body);calls.push(input);
 if(input.action==='start')queue={id:'pilot',version:1,source_plan_id:'plan',week_start:'2027-01-01',entries:Array.from({length:5},(_,n)=>({assignment_id:'a'+n,planned_date:'2027-01-0'+(n+1),owner:'',status:'Tentative',brief:'Saved task instructions '+n,title_edited:true,snapshot:{title:'Task '+n,category:'High intent',action:'Review existing page',terms:['query '+n],evidence:{gsc:[]},notes:'My original notes'}}))};
 else queue={...queue,version:queue.version+1,entries:queue.entries.map(e=>e.assignment_id===input.assignmentId?{...e,owner:input.owner,status:input.status,brief:input.brief}:e)};
 return Response.json({queue});
 }});
 const originalClick=dom.window.HTMLAnchorElement.prototype.click;dom.window.HTMLAnchorElement.prototype.click=function(){downloaded=this.download;};
 const root=createRoot(document.getElementById('root')),button=t=>[...document.querySelectorAll('button')].find(b=>b.textContent===t),click=t=>act(async()=>button(t).click());
 try{
 await act(async()=>root.render(React.createElement(mod.exports.default,{active:true})));await click('Start 90-assignment queue');assert.equal(document.querySelectorAll('.work-tasks button').length,5);assert.match(document.body.textContent,/Planned dates remain tentative/);
 await act(async()=>{const select=document.querySelector('.work-editor select');select.value='In progress';select.dispatchEvent(new dom.window.Event('change',{bubbles:true}));});
 assert.match(document.body.textContent,/Unsaved changes/);assert.equal(button('Export all work Markdown').disabled,true);assert.ok([...document.querySelectorAll('.work-tasks button')].every(b=>b.disabled));
 await click('Save task');assert.equal(calls[1].status,'In progress');assert.equal(calls[1].brief,'Saved task instructions 0');assert.match(document.body.textContent,/Task saved/);
 await click('Export task Markdown');assert.equal(downloaded,'medicarefaq-task-a0.md');assert.equal(calls.length,2);
 await click('Export all work Markdown');assert.equal(downloaded,'medicarefaq-work-queue-2027-01-01.md');
 }finally{dom.window.HTMLAnchorElement.prototype.click=originalClick;await act(async()=>root.unmount());Object.assign(globalThis,old);dom.window.close();}
});
