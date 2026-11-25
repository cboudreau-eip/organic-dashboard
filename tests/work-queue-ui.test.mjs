import ScopeBadge from './scope-badge-loader.mjs';
import test from 'node:test';import assert from 'node:assert/strict';import React,{act} from 'react';import {createRoot} from 'react-dom/client';import {JSDOM} from 'jsdom';import {readFile} from 'node:fs/promises';import {createRequire} from 'node:module';import {resolve} from 'node:path';import {transform,loadBindings} from 'next/dist/build/swc/index.js';
const require=createRequire(import.meta.url);await loadBindings();const filename=resolve('components/dashboard/WorkQueue.jsx'),{code}=await transform(await readFile(filename,'utf8'),{filename,jsc:{parser:{syntax:'ecmascript',jsx:true},transform:{react:{runtime:'automatic'}}},module:{type:'commonjs'}}),mod={exports:{}};
new Function('require','module','exports',code)(p=>p==='./AssignmentScopeBadge'?ScopeBadge:p==='./WorkAssessment'?()=>null:p.endsWith('.css')?{}:p==='../../lib/work-queue/model'?require('../lib/work-queue/model.js'):require(p),mod,mod.exports);
test('pilot UI starts five tasks, changes workflow status, protects unsaved edits and exports saved Markdown',async()=>{
 const dom=new JSDOM('<div id="root"></div>',{url:'https://dashboard.example'}),old={window:globalThis.window,document:globalThis.document,fetch:globalThis.fetch,IS_REACT_ACT_ENVIRONMENT:globalThis.IS_REACT_ACT_ENVIRONMENT};let queue=null,downloaded='',calls=[],calendarLinks=[];
 Object.assign(globalThis,{window:dom.window,document:dom.window.document,IS_REACT_ACT_ENVIRONMENT:true,fetch:async(url,opts)=>{
 if(!opts?.method)return Response.json({queue,plan:{id:'plan',version:1},canEdit:true});const input=JSON.parse(opts.body);calls.push(input);
 if(input.action==='start')queue={id:'pilot',version:1,source_plan_id:'plan',week_start:'2027-01-01',entries:Array.from({length:5},(_,n)=>({assignment_id:'a'+n,planned_date:'2027-01-0'+(n+1),owner:'',status:'Tentative',brief:'Saved task instructions '+n,title_edited:true,snapshot:{title:'Task '+n,category:'High intent',action:'Review existing page',terms:['query '+n],evidence:{gsc:[]},notes:'My original notes'}}))};
 else queue={...queue,version:queue.version+1,entries:queue.entries.map(e=>e.assignment_id===input.assignmentId?{...e,owner:input.owner,status:input.status,brief:input.brief}:e)};
 return Response.json({queue});
 }});
 const originalClick=dom.window.HTMLAnchorElement.prototype.click;dom.window.HTMLAnchorElement.prototype.click=function(){downloaded=this.download;};
 const root=createRoot(document.getElementById('root')),button=t=>[...document.querySelectorAll('button')].find(b=>b.textContent===t),click=t=>act(async()=>button(t).click());
 try{
 await act(async()=>root.render(React.createElement(mod.exports.default,{active:true,onOpenCalendar:target=>calendarLinks.push(target)})));await click('Start 90-assignment queue');assert.equal(document.querySelectorAll('.work-tasks button').length,5);assert.equal(document.querySelector('.plan-notice'),null);await click('View in calendar');assert.deepEqual(calendarLinks,[{planId:'plan',assignmentId:'a0'}]);
 await act(async()=>{const select=document.querySelector('.work-editor select');select.value='In progress';select.dispatchEvent(new dom.window.Event('change',{bubbles:true}));});
 assert.match(document.body.textContent,/Unsaved changes/);assert.equal(button('Export all work Markdown').disabled,true);assert.equal(button('View in calendar').disabled,true);await click('View in calendar');assert.equal(calendarLinks.length,1);assert.ok([...document.querySelectorAll('.work-tasks button')].every(b=>b.disabled));
 await click('Save changes');assert.equal(calls[1].status,'In progress');assert.equal(calls[1].brief,'Saved task instructions 0');assert.match(document.body.textContent,/Task saved/);
 await click('Export Markdown');assert.equal(downloaded,'medicarefaq-task-a0.md');assert.equal(calls.length,2);
 await click('Export all work Markdown');assert.equal(downloaded,'medicarefaq-work-queue-2027-01-01.md');
 }finally{dom.window.HTMLAnchorElement.prototype.click=originalClick;await act(async()=>root.unmount());Object.assign(globalThis,old);dom.window.close();}
});

test('calendar link selects the exact task and week without writes, and rejects a different plan',async()=>{
 const dom=new JSDOM('<div id="root"></div>'),old={window:globalThis.window,document:globalThis.document,fetch:globalThis.fetch,IS_REACT_ACT_ENVIRONMENT:globalThis.IS_REACT_ACT_ENVIRONMENT};
 const entries=['2027-01-01','2027-02-18'].map((date,i)=>({assignment_id:'a'+i,planned_date:date,owner:i?'Chris':'',status:'Tentative',brief:'Brief '+i,title_edited:true,snapshot:{title:'Task '+i,category:'High intent',terms:[]}}));let writes=0;
 Object.assign(globalThis,{window:dom.window,document:dom.window.document,IS_REACT_ACT_ENVIRONMENT:true,fetch:async(url,opts)=>{if(opts?.method)writes++;return Response.json({queue:{id:'q',version:1,source_plan_id:'plan',entries},canEdit:true});}});
 const root=createRoot(document.getElementById('root'));
 try{await act(async()=>root.render(React.createElement(mod.exports.default,{active:true,openTask:{planId:'plan',assignmentId:'a1'}})));assert.equal(document.querySelector('.work-editor input'),null);assert.equal(document.querySelector('.work-editor textarea').value,'Brief 1');assert.equal(document.querySelector('.work-week-nav select').value,'2027-02-12');assert.equal(document.activeElement,document.querySelector('.work-direct-task'));assert.equal(writes,0);
 await act(async()=>root.render(React.createElement(mod.exports.default,{active:true,openTask:{planId:'other',assignmentId:'a1'}})));assert.equal(document.querySelector('.work-editor'),null);assert.match(document.querySelector('[role=alert]').textContent,/not in the saved work queue/);assert.equal(writes,0);
 await act(async()=>[...document.querySelectorAll('button')].find(b=>b.textContent==='Browse the saved queue').click());
 await act(async()=>{const filter=document.querySelector('.work-filter-grid label:nth-child(1) select');filter.value='Completed';filter.dispatchEvent(new dom.window.Event('change',{bubbles:true}));});assert.match(document.body.textContent,/No tasks match/);
 await act(async()=>[...document.querySelectorAll('button')].find(b=>b.textContent==='Show all work').click());assert.equal(document.querySelectorAll('.work-tasks button').length,2);assert.equal(writes,0);
 }finally{await act(async()=>root.unmount());Object.assign(globalThis,old);dom.window.close();}
});

test('task navigation follows filters, restores list position and protects unsaved work',async()=>{
 const dom=new JSDOM('<div id="root"></div>',{url:'https://dashboard.example'}),old={window:globalThis.window,document:globalThis.document,fetch:globalThis.fetch,IS_REACT_ACT_ENVIRONMENT:globalThis.IS_REACT_ACT_ENVIRONMENT};
 const entries=Array.from({length:4},(_,i)=>({assignment_id:'a'+i,planned_date:'2027-01-0'+(i+1),owner:'',status:'Tentative',brief:'Saved brief '+i,title_edited:true,snapshot:{title:'Task '+i,category:i===1?'Evergreen':'High intent',terms:[]}})),original=JSON.stringify(entries);let writes=0,restored=null;
 Object.assign(globalThis,{window:dom.window,document:dom.window.document,IS_REACT_ACT_ENVIRONMENT:true,fetch:async(url,opts)=>{if(opts?.method)writes++;return Response.json({queue:{id:'q',version:1,source_plan_id:'plan',entries},canEdit:true});}});Object.defineProperty(window,'scrollY',{value:420});window.scrollTo=options=>{restored=options.top;};
 const root=createRoot(document.getElementById('root')),button=t=>[...document.querySelectorAll('button')].find(b=>b.textContent===t),click=t=>act(async()=>button(t).click()),select=async(selector,value)=>act(async()=>{const el=document.querySelector(selector);el.value=value;el.dispatchEvent(new dom.window.Event('change',{bubbles:true}));});
 try{
 await act(async()=>root.render(React.createElement(mod.exports.default,{active:true})));
 assert.equal(document.querySelector('.work-pilot').dataset.taskView,'list');
 await select('.work-filter-grid label:nth-child(2) select','High intent');assert.equal(document.querySelectorAll('.work-tasks button').length,3);
 const list=document.querySelector('.work-tasks');list.scrollTop=125;
 await act(async()=>list.querySelector('[data-task-id="a0"]').click());assert.equal(document.querySelector('.work-pilot').dataset.taskView,'detail');assert.equal(button('Previous task').disabled,true);assert.match(document.querySelector('.work-step-controls').textContent,/Task 1 of 3/);
 await click('Next task');assert.equal(document.querySelector('.work-editor h3').textContent,'Task 2');assert.equal(document.querySelector('.work-tasks [aria-pressed=true]').dataset.taskId,'a2');
 await select('.work-editor select','In progress');for(const name of ['Previous task','Next task','Back to tasks']){assert.equal(button(name).disabled,true);await click(name);}assert.equal(document.querySelector('.work-editor h3').textContent,'Task 2');
 await click('Discard unsaved changes');await click('Next task');assert.equal(document.querySelector('.work-editor h3').textContent,'Task 3');assert.equal(button('Next task').disabled,true);
 await click('Previous task');assert.equal(document.querySelector('.work-editor textarea').value,'Saved brief 2');await click('Back to tasks');assert.equal(document.querySelector('.work-pilot').dataset.taskView,'list');assert.equal(restored,420);assert.equal(list.scrollTop,125);assert.equal(document.activeElement.dataset.taskId,'a0');assert.equal(document.querySelector('.work-filter-grid label:nth-child(2) select').value,'High intent');
 await act(async()=>list.querySelector('[data-task-id="a2"]').click());assert.equal(document.querySelector('.work-editor textarea').value,'Saved brief 2');assert.equal(writes,0);assert.equal(JSON.stringify(entries),original);
 }finally{await act(async()=>root.unmount());Object.assign(globalThis,old);dom.window.close();}
});
test('next-task shortcut favors in-progress work, respects filters and never writes data',async()=>{
 const dom=new JSDOM('<div id="root"></div>',{url:'https://dashboard.example'}),old={window:globalThis.window,document:globalThis.document,fetch:globalThis.fetch,IS_REACT_ACT_ENVIRONMENT:globalThis.IS_REACT_ACT_ENVIRONMENT};let writes=0;
 const entries=['Published','Tentative','In progress'].map((status,i)=>({assignment_id:'a'+i,planned_date:'2027-01-0'+(i+1),status,brief:'Saved instructions',snapshot:{title:'Task '+i,category:'High intent',action:'Update the comparison',terms:[]}}));
 Object.assign(globalThis,{window:dom.window,document:dom.window.document,IS_REACT_ACT_ENVIRONMENT:true,fetch:async(u,o)=>{if(o?.method)writes++;return Response.json({queue:{id:'q',version:1,entries},canEdit:true});}});
 const root=createRoot(document.getElementById('root'));
 try{await act(async()=>root.render(React.createElement(mod.exports.default,{active:true})));
 assert.match(document.querySelector('.work-next').textContent,/CONTINUE WORKING/);
 await act(async()=>document.querySelector('.work-next button').click());assert.equal(document.querySelector('.work-editor textarea').value,'Saved instructions');assert.equal(document.querySelector('.work-tasks [aria-pressed=true]').dataset.taskId,'a2');
 assert.match(document.querySelector('.work-action-summary').textContent,/Update the comparison/);
 await act(async()=>{const el=document.querySelector('.work-filter-grid select');el.value='To do';el.dispatchEvent(new dom.window.Event('change',{bubbles:true}));});assert.match(document.querySelector('.work-next').textContent,/NEXT TO DO/);
 await act(async()=>document.querySelector('.work-next button').click());assert.equal(document.querySelector('.work-tasks [aria-pressed=true]').dataset.taskId,'a1');assert.equal(writes,0);
 }finally{await act(async()=>root.unmount());Object.assign(globalThis,old);dom.window.close();}
});
