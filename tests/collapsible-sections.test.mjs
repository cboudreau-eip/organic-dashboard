import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import React,{act,useState} from 'react';
import {createRoot} from 'react-dom/client';
import CollapsibleSection from '../components/dashboard/CollapsibleSection.js';
test('section toggles independently and preserves edited child state while hidden',async()=>{
 const dom=new JSDOM('<div id="root"></div>',{url:'https://example.test'});
 globalThis.window=dom.window;globalThis.document=dom.window.document;globalThis.IS_REACT_ACT_ENVIRONMENT=true;
 const h=React.createElement;
 function Child(){const [count,setCount]=useState(0);return h('button',{onClick:()=>setCount(n=>n+1)},'Count '+count);}
 const root=createRoot(document.getElementById('root'));
 try{
  await act(async()=>root.render(h('div',null,h(CollapsibleSection,{title:'First'},h(Child)),h(CollapsibleSection,{title:'Second'},'Second content'))));
  const buttons=[...document.querySelectorAll('.dashboard-section-toggle')];
  assert.equal(buttons.length,2);assert.notEqual(buttons[0].getAttribute('aria-controls'),buttons[1].getAttribute('aria-controls'));
  const panel=document.getElementById(buttons[0].getAttribute('aria-controls'));
  await act(async()=>panel.querySelector('button').click());
  await act(async()=>buttons[0].click());
  assert.equal(panel.hidden,true);assert.equal(buttons[0].getAttribute('aria-expanded'),'false');
  assert.equal(buttons[0].textContent,'Expand▾');assert.equal(buttons[1].getAttribute('aria-expanded'),'true');
  await act(async()=>buttons[0].click());
  assert.equal(panel.hidden,false);assert.equal(panel.querySelector('button').textContent,'Count 1');
 }finally{await act(async()=>root.unmount());dom.window.close();delete globalThis.window;delete globalThis.document;delete globalThis.IS_REACT_ACT_ENVIRONMENT;}
});
