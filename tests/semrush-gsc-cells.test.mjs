import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {transform,loadBindings} from 'next/dist/build/swc/index.js';
const require=createRequire(import.meta.url);
await loadBindings();
const filename=resolve('components/dashboard/PageSearchCells.jsx');
const source=await readFile(filename,'utf8');
const {code}=await transform(source,{filename,jsc:{parser:{syntax:'ecmascript',jsx:true},transform:{react:{runtime:'automatic'}}},module:{type:'commonjs'}});
const mod={exports:{}};
new Function('require','module','exports',code)(name=>require(name.startsWith('.')?resolve('components/dashboard',name+'.js'):name),mod,mod.exports);
const Cells=mod.exports.default;
const render=(group,status='ready')=>renderToStaticMarkup(React.createElement('table',null,React.createElement('tbody',null,React.createElement('tr',null,React.createElement(Cells,{group,status})))));
test('joined page cells show real zero and missing comparison distinctly',()=>{
 const html=render({gsc:{current:{clicks:0,impressions:0,ctr:0},previous:null,clicksChange:null}});
 assert.match(html,/<strong>0<\/strong>/);
 assert.match(html,/Prior: Not reported/);
 assert.match(html,/Not comparable/);
 assert.match(html,/0.00%/);
});
test('loading and error states withhold stale figures',()=>{
 const group={gsc:{current:{clicks:12345,impressions:99999,ctr:.12}}};
 const loading=render(group,'loading'),error=render(group,'error');
 assert.match(loading,/Loading GSC/);assert.match(error,/GSC unavailable/);
 for(const html of [loading,error]){assert.doesNotMatch(html,/12,345|99,999|12.00%/);assert.match(html,/colSpan="4"/);}
});
test('missing matched URL displays a review action without fabricated metrics',()=>{
 const html=render({gsc:null});
 assert.match(html,/Current GSC row not reported/);assert.match(html,/Missing rows do not establish zero traffic/);
 assert.doesNotMatch(html,/0.00%/);
});
