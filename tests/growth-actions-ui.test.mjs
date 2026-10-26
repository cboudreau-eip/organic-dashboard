import test from 'node:test';
import assert from 'node:assert/strict';
import React,{act,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {JSDOM} from 'jsdom';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {transform,loadBindings} from 'next/dist/build/swc/index.js';
const require=createRequire(import.meta.url);
await loadBindings();
async function component(name){
 const filename=resolve('components/dashboard/'+name+'.jsx');
 const {code}=await transform(await readFile(filename,'utf8'),{filename,jsc:{parser:{syntax:'ecmascript',jsx:true},transform:{react:{runtime:'automatic'}}},module:{type:'commonjs'}});
 const mod={exports:{}};
 new Function('require','module','exports',code)(name=>require(name.startsWith('.')?resolve('components/dashboard',name+'.js'):name),mod,mod.exports);
 return mod.exports.default;
}
const Save=await component('SaveOpportunity'),List=await component('ActionList');
test('saving an opportunity refreshes the server-backed list and survives remount',async()=>{
 const dom=new JSDOM('<div id="root"></div>',{url:'https://dashboard.example'});
 const old={window:globalThis.window,document:globalThis.document,fetch:globalThis.fetch,IS_REACT_ACT_ENVIRONMENT:globalThis.IS_REACT_ACT_ENVIRONMENT};
 Object.assign(globalThis,{window:dom.window,document:dom.window.document,IS_REACT_ACT_ENVIRONMENT:true});
 let stored=null,saves=0;
 globalThis.fetch=async(url,options={})=>{
  if(options.method==='POST'){saves++;const input=JSON.parse(options.body);stored={...input,id:'11111111-1111-4111-8111-111111111111',status:'planned',version:1,published_on:null,created_at:'2026-10-26T12:00:00Z',updated_at:'2026-10-26T12:00:00Z',history:[]};return {ok:true,json:async()=>({action:stored})};}
  if(String(url).includes('?id='))return {ok:true,json:async()=>({action:stored,results:[],role:'analyst'})};
  return {ok:true,json:async()=>({actions:stored?[stored]:[],total:stored?1:0,role:'analyst'})};
 };
 function Harness(){const [refresh,setRefresh]=useState(0);return React.createElement(React.Fragment,null,React.createElement(Save,{page:'https://www.medicarefaq.com/plans/',title:'Improve Plan G',onSaved:()=>setRefresh(n=>n+1)}),React.createElement(List,{refresh}));}
 let root=createRoot(document.getElementById('root'));
 try{
  await act(async()=>root.render(React.createElement(Harness)));
  assert.match(document.body.textContent,/No saved actions/);
  await act(async()=>[...document.querySelectorAll('button')].find(b=>b.textContent==='Save opportunity').dispatchEvent(new dom.window.MouseEvent('click',{bubbles:true})));
  assert.equal(saves,1);assert.match(document.body.textContent,/1 saved actions/);
  await act(async()=>root.unmount());root=createRoot(document.getElementById('root'));
  await act(async()=>root.render(React.createElement(List)));
  assert.match(document.body.textContent,/Improve Plan G/);
  await act(async()=>[...document.querySelectorAll('button')].find(b=>b.textContent==='Open action').dispatchEvent(new dom.window.MouseEvent('click',{bubbles:true})));
  assert.equal(document.querySelector('input').value,'Improve Plan G');
  assert.match(document.body.textContent,/Work history/);
 }finally{await act(async()=>root.unmount());dom.window.close();Object.assign(globalThis,old);}
});
