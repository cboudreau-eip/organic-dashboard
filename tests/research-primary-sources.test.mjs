import test from 'node:test';
import assert from 'node:assert/strict';
import {primaryUrl,readPrimary,verifyPrimarySources} from '../lib/research/primary-sources.js';
test('primary reader rejects untrusted URLs, redirects and non-HTML documents',async()=>{
 for(const u of ['http://cms.gov','https://cms.gov.evil.example','https://cms.gov@localhost','https://127.0.0.1','https://cms.gov:444'])assert.equal(primaryUrl(u),null);
 await assert.rejects(readPrimary('https://cms.gov',async()=>new Response(null,{status:302,headers:{location:'https://localhost/internal'}})));
 await assert.rejects(readPrimary('https://cms.gov',async()=>new Response('pdf',{headers:{'content-type':'application/pdf'}})));
});
test('successful redirected documents replace snippets; failures retain explicit limitations',async()=>{
 const sources=[{id:'s1',url:'https://cms.gov/old',text:'snippet'},{id:'s2',url:'https://www.naic.org/file',text:'snippet'}];let calls=0;
 const r=await verifyPrimarySources({sources},{read:async url=>{calls++;if(url.includes('naic'))throw Error();return {url:'https://cms.gov/new',text:'Read document',retrievedAt:'2026-11-13'};}});
 assert.equal(calls,2);assert.equal(r.sources[0].text,'Read document');assert.equal(r.sources[0].documentStatus,'read');assert.equal(r.sources[1].documentStatus,'unavailable');
});
test('direct reads are bounded and retain server-returned text',async()=>{
 const r=await readPrimary('https://cms.gov/info',async()=>new Response('<main>'+('Useful Medicare evidence. '.repeat(20))+'</main>',{headers:{'content-type':'text/html'}}));assert.match(r.text,/Useful Medicare evidence/);assert.equal(r.method,'Direct primary-source page read');
 const sources=Array.from({length:8},(_,i)=>({url:'https://cms.gov/'+i,text:'snippet'}));let calls=0;await verifyPrimarySources({sources},{read:async url=>{calls++;return {url,text:'read'};}});assert.equal(calls,3);
});
