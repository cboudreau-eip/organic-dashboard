import test from 'node:test';
import assert from 'node:assert/strict';
import React,{act} from 'react';
import {JSDOM} from 'jsdom';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {transform,loadBindings} from 'next/dist/build/swc/index.js';
import {generateProposals} from '../lib/research/proposals.js';
import {generateCalendar} from '../lib/research/demo-calendar.js';
import {DEFAULTS} from '../lib/research/contracts.js';
const require=createRequire(import.meta.url),modules={};await loadBindings();
for(const name of ['DemoCalendar','WorkQueue','ProposedAssignments','ContentWorkspace']){
 const filename=resolve('components/dashboard/'+name+'.jsx'),{code}=await transform(await readFile(filename,'utf8'),{filename,jsc:{parser:{syntax:'ecmascript',jsx:true},transform:{react:{runtime:'automatic'}}},module:{type:'commonjs'}}),m={exports:{}};
 new Function('require','module','exports',code)(p=>p.endsWith('.css')?{}:p.startsWith('./')?(modules[p.slice(2)]||(()=>null)):p.endsWith('/proposal-export')?{exportProposalXlsx:()=>{throw Error('Unexpected export');}}:p.startsWith('../../lib/')?require('../lib/'+p.slice(10)+'.js'):require(p),m,m.exports);modules[name]=m.exports.default;
}
test('full calendar/work round trip preserves plan, dates and filters; failed saves retain drafts',async()=>{
 const dom=new JSDOM('<div id="root"></div>',{url:'https://test.example'}),old={window:globalThis.window,document:globalThis.document,fetch:globalThis.fetch,IS_REACT_ACT_ENVIRONMENT:globalThis.IS_REACT_ACT_ENVIRONMENT};
 const payload=generateProposals({},DEFAULTS),plan={id:'saved-plan',version:4,created_at:'2026-11-17',payload,calendar:generateCalendar(payload.items)},before=JSON.stringify(plan),target=Object.keys(plan.calendar.dates).find(id=>plan.calendar.dates[id]==='2027-03-15'),item=payload.items.find(i=>i.id===target);
 let queue={id:'queue',version:1,source_plan_id:plan.id,entries:payload.items.map(i=>({assignment_id:i.id,planned_date:plan.calendar.dates[i.id],owner:'Chris',status:'Tentative',brief:'Existing instructions '+i.id,snapshot:i,title_edited:true}))},writes=[],failSave=false;
 Object.assign(globalThis,{window:dom.window,document:dom.window.document,IS_REACT_ACT_ENVIRONMENT:true,fetch:async(url,opts)=>{
  if(opts?.method==='POST'){assert.equal(url,'/api/content-work');const input=JSON.parse(opts.body);writes.push(input);if(failSave)return Response.json({error:'Test save failed'},{status:500});queue={...queue,version:queue.version+1,entries:queue.entries.map(e=>e.assignment_id===input.assignmentId?{...e,owner:input.owner,status:input.status,brief:input.brief}:e)};return Response.json({queue});}
  if(url.startsWith('/api/research/proposals'))return Response.json({plan,history:[plan],runs:[],canEdit:true});
  assert.equal(url,'/api/content-work');return Response.json({queue,canEdit:true});
 }});
 const {createRoot}=await import('react-dom/client');
 const root=createRoot(document.getElementById('root')),button=name=>[...document.querySelectorAll('button')].find(b=>(b.getAttribute('aria-label')||b.textContent)===name),click=name=>act(async()=>button(name).click()),select=async(selector,value)=>act(async()=>{const el=document.querySelector(selector);el.value=value;el.dispatchEvent(new dom.window.Event('change',{bubbles:true}));});
 try{
  await act(async()=>root.render(React.createElement(modules.ContentWorkspace,{active:true})));
  await click('Next calendar month');await click('Next calendar month');await select('.calendar-display-controls select',item.category);
  await act(async()=>[...document.querySelectorAll('.demo-day button')].find(b=>b.getAttribute('aria-label').startsWith('2027-03-15:')).click());await click('Open in work queue');
  assert.equal(document.querySelector('.work-editor h3').textContent,item.title);assert.equal(document.querySelector('.work-week-nav select').value,'2027-03-12');
  await select('.work-filter-grid label:nth-child(2) select','Tentative');await select('.work-filter-grid label:nth-child(3) select',item.category);
  await act(async()=>{for(const [selector,value] of [['.work-editor input','Content team'],['.work-editor textarea','Updated implementation instructions']]){const el=document.querySelector(selector),proto=el.tagName==='INPUT'?dom.window.HTMLInputElement.prototype:dom.window.HTMLTextAreaElement.prototype;Object.getOwnPropertyDescriptor(proto,'value').set.call(el,value);el.dispatchEvent(new dom.window.Event('input',{bubbles:true}));}});
  await select('.work-editor select','In progress');assert.equal(button('Calendar').disabled,true);assert.equal(button('View in calendar').disabled,true);const unload=new dom.window.Event('beforeunload',{cancelable:true});window.dispatchEvent(unload);assert.equal(unload.defaultPrevented,true);
  await act(async()=>root.render(React.createElement(modules.ContentWorkspace,{active:false})));await act(async()=>root.render(React.createElement(modules.ContentWorkspace,{active:true})));assert.equal(document.querySelector('.work-editor textarea').value,'Updated implementation instructions');
  failSave=true;await click('Save task');assert.match(document.querySelector('[role=alert]').textContent,/Test save failed/);assert.equal(document.querySelector('.work-editor select').value,'In progress');assert.equal(button('Calendar').disabled,true);
  failSave=false;await click('Save task');assert.equal(document.querySelector('.work-editor h3').textContent,item.title,'saving outside a filter must not silently select another task');assert.equal(document.querySelector('.work-editor select').value,'In progress');assert.equal(document.querySelector('.work-filter-grid label:nth-child(2) select').value,'Tentative');
  await click('View in calendar');assert.match(document.querySelector('.plan-month h4').textContent,/March/);assert.equal(document.querySelector('.calendar-date-editor h4').textContent,item.title);assert.match(document.querySelector('.calendar-date-editor .calendar-work-badge').textContent,/In progress/);assert.equal(document.querySelector('.calendar-display-controls select').value,item.category);
  await click('Work queue');assert.equal(document.querySelector('.work-editor h3').textContent,item.title);assert.equal(document.querySelector('.work-filter-grid label:nth-child(2) select').value,'Tentative');
  await select('.work-editor select','Review');await click('Discard unsaved changes');assert.equal(document.querySelector('.work-editor select').value,'In progress');assert.equal(button('Calendar').disabled,false);
  assert.equal(writes.length,2);assert.equal(writes[1].assignmentId,target);assert.equal(writes[1].brief,'Updated implementation instructions');assert.equal(writes[1].owner,'Content team');assert.equal(JSON.stringify(plan),before);assert.deepEqual(queue.entries.map(e=>e.planned_date),payload.items.map(i=>plan.calendar.dates[i.id]));
 }finally{await act(async()=>root.unmount());Object.assign(globalThis,old);dom.window.close();}
});
