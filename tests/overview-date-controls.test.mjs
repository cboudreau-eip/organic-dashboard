import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {JSDOM} from 'jsdom';
import React,{act,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {transform} from 'next/dist/build/swc/index.js';

const require=createRequire(import.meta.url);
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
async function component(relative,overrides={}) {
 const filename=resolve(root,relative);
 const source=await readFile(filename,'utf8');
 const {code}=await transform(source,{filename,jsc:{parser:{syntax:'ecmascript',jsx:true},transform:{react:{runtime:'automatic'}}},module:{type:'commonjs'}});
 const module={exports:{}};
 const localRequire=name=>{
   if(Object.hasOwn(overrides,name)) return {__esModule:true,default:overrides[name]};
   if(name.startsWith('.')) return require(resolve(dirname(filename),name)+(name.endsWith('.js')?'':'.js'));
   return require(name);
 };
 new Function('require','module','exports',code)(localRequire,module,module.exports);
 return module.exports.default;
}
test('Overview retains exactly one date form across repeated period changes',async()=>{
 const dom=new JSDOM('<div id="root"></div>',{url:'https://dashboard.example/'});
 const saved={window:globalThis.window,document:globalThis.document,fetch:globalThis.fetch,act:globalThis.IS_REACT_ACT_ENVIRONMENT};
 globalThis.window=dom.window;globalThis.document=dom.window.document;
 globalThis.IS_REACT_ACT_ENVIRONMENT=true;
 globalThis.fetch=()=>new Promise(()=>{});
 const errors=[],originalError=console.error;
 console.error=(...args)=>errors.push(args.map(String).join(' '));
 let mounted;
 try {
   const Controls=await component('components/dashboard/OrganicDateControls.jsx');
   const Overview=await component('components/dashboard/OrganicOverview.jsx',{
     './OrganicDateControls':Controls,
     './OrganicConversions':()=>React.createElement('div',{'data-testid':'conversions'}),
     './OrganicDetails':()=>React.createElement('div',{'data-testid':'traffic-details'})
   });
   function Harness(){const [days,setDays]=useState(7);return React.createElement(Overview,{days,setDays});}
   mounted=createRoot(document.getElementById('root'));
   await act(async()=>mounted.render(React.createElement(Harness)));
   async function select(index,value){
     await act(async()=>{
       const control=document.querySelectorAll('.gsc-date-fields select')[index];
       control.value=value;control.dispatchEvent(new dom.window.Event('change',{bubbles:true}));
     });
   }
   async function apply(){
     await act(async()=>document.querySelector('form.gsc-date-controls').dispatchEvent(new dom.window.Event('submit',{bubbles:true,cancelable:true})));
     assert.equal(document.querySelectorAll('form.gsc-date-controls').length,1);
     assert.equal(document.querySelectorAll('[data-testid="traffic-details"]').length,1);
     assert.equal(document.querySelectorAll('[data-testid="conversions"]').length,1);
   }
   assert.equal(document.querySelectorAll('form.gsc-date-controls').length,1);
   await select(0,'custom');await apply();
   await select(0,'rolling');await select(1,'90');await apply();
   await select(0,'month');await apply();
   await select(0,'rolling');await select(1,'7');await apply();
   await apply();
   assert.equal(errors.filter(message=>/same key|unique.*key|duplicate.*key/i.test(message)).length,0,errors.join('\n'));
 } finally {
   if(mounted)await act(async()=>mounted.unmount());
   console.error=originalError;globalThis.window=saved.window;globalThis.document=saved.document;globalThis.fetch=saved.fetch;globalThis.IS_REACT_ACT_ENVIRONMENT=saved.act;
   dom.window.close();
 }
});
