import test from 'node:test';
import assert from 'node:assert/strict';
import {pageKey,pageIndex,joinPages,pageFinding} from '../lib/semrush/gsc-pages.js';
const url='https://www.medicarefaq.com/medicare/';
const row={key:url,current:{clicks:100,impressions:2000,ctr:.05,position:5},previous:{clicks:120},clicksChange:-20,clicksPercent:-100/6};
test('matches fragments but preserves potentially distinct canonical candidates',()=>{
 assert.equal(pageKey(url+'#section'),url);
 for(const other of [url.replace('www.',''),url.replace('https:','http:'),url.slice(0,-1),url+'?state=FL',url.replace('/medicare/','/Medicare/')])assert.notEqual(pageKey(other),pageKey(url));
 for(const bad of ['',null,'/medicare/','javascript:alert(1)','https://www.medicarefaq.com.evil.com/','https://user@www.medicarefaq.com/'])assert.equal(pageKey(bad),null);
});
test('joins whole page metrics without multiplying them by keyword count',()=>{
 const [joined]=joinPages([{url,count:5,pageTwo:2}],[row]);
 assert.equal(joined.gsc.current.clicks,100);assert.equal(joined.count,5);
 assert.equal(pageFinding(joined).type,'decline');
});
test('unreported and prior-only rows never invent zeros or losses',()=>{
 const groups=joinPages([{url,pageTwo:4}],[]);
 assert.equal(groups[0].gsc,null);assert.equal(pageFinding(groups[0]).type,'unmatched');
 const prior=joinPages([{url}],[{key:url,current:null,previous:{clicks:40},clicksChange:null}])[0];
 assert.equal(pageFinding(prior).type,'unmatched');
 const current=joinPages([{url}],[{...row,previous:null,clicksChange:null}])[0];
 assert.equal(pageFinding(current).type,'monitor');
});
test('ambiguous URLs with fragments are withheld, not summed',()=>{
 const index=pageIndex([row,{...row,key:url+'#x'}]);
 assert.equal(index.get(url),null);
 const joined=joinPages([{url}],[row,{...row,key:url+'#x'}])[0];
 assert.equal(joined.ambiguous,true);assert.equal(joined.gsc,null);
 assert.equal(pageFinding(joined).label,'URL match needs review');
});
test('rank and CTR screening rules have explicit boundaries and precedence',()=>{
 const group={pageTwo:1,gsc:{...row,clicksChange:0}};
 assert.equal(pageFinding(group).type,'near');
 const ctr={pageTwo:0,gsc:{current:{impressions:1000,ctr:.009,position:10}}};
 assert.equal(pageFinding(ctr).type,'ctr');
 for(const change of [{impressions:999},{ctr:.01},{position:10.1},{ctr:null},{position:null}]){
  assert.equal(pageFinding({...ctr,gsc:{current:{...ctr.gsc.current,...change}}}).type,'monitor');
 }
 assert.equal(pageFinding({...ctr,gsc:{...ctr.gsc,clicksChange:-1}}).type,'decline');
});
