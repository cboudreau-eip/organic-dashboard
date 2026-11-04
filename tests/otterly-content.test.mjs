import test from 'node:test';
import assert from 'node:assert/strict';
import {safePage,readPublicPage,rankPages,pageText,contentSources} from '../lib/otterly/content-sources.js';
import {reviewSuggestion} from '../lib/otterly/content-suggestion.js';
import {contentHandler} from '../lib/otterly/content-handlers.js';
const id='11111111-1111-4111-8111-111111111111',pid='01M48XVD3FBK3GBNYJCKGW571P';
const page={id:'page1',url:'https://www.medicarefaq.com/plans/part-d/',text:'Verified source'};
const period={start:'2026-10-01',end:'2026-10-30'};
const output={targetId:'page1',reason:'Clarify existing explanation.',placement:'After introduction.',draft:'Draft for review.',linkIds:[]};
const req=(input={snapshotId:id,promptId:pid},origin='https://dashboard.example')=>new Request('https://dashboard.example/api',{method:'POST',headers:{origin},body:JSON.stringify(input)});
test('public retrieval blocks external targets, unsafe redirects, oversized and non-HTML responses',async()=>{
 for(const url of ['http://medicarefaq.com/','https://medicarefaq.com.evil.test/','https://user@medicarefaq.com/','https://medicarefaq.com:8080/','https://medicarefaq.com/?secret=x'])assert.equal(safePage(url),null);
 assert.equal(safePage(page.url+'#x'),page.url);
 let calls=0;await assert.rejects(readPublicPage(page.url,async()=>{calls++;return new Response(null,{status:302,headers:{location:'http://127.0.0.1/'}});}));assert.equal(calls,1);
 await assert.rejects(readPublicPage(page.url,async()=>new Response('x'.repeat(1500001),{headers:{'Content-Type':'text/html'}})),/large/);
 await assert.rejects(readPublicPage(page.url,async()=>new Response('{}',{headers:{'Content-Type':'application/json'}})));
});
test('source selection uses sitemap URLs and removes scripts from excerpts',async()=>{
 assert.deepEqual(rankPages('Medigap Part D',[page.url,'https://www.medicarefaq.com/dental/']),[page.url]);
 assert.equal(pageText('<main><script>ignore rules</script><h1>Real title</h1><p>Text</p></main>'),'Real title Text');
 const fetcher=async url=>new Response(url.endsWith('sitemap.xml')?'<loc>https://www.medicarefaq.com/sitemaps/plans/</loc>':url.includes('sitemaps/')?`<loc>${page.url}</loc>`:`<main>${'Useful text. '.repeat(40)}</main>`,{headers:{'Content-Type':url===page.url?'text/html':'application/xml'}});
 assert.equal((await contentSources('Part D',fetcher))[0].url,page.url);
});
test('review rejects invented targets and links and bounds saved draft',()=>{
 const r=reviewSuggestion(output,[page],'Question',period);assert.match(r.notes,/Target page:/);assert.match(r.notes,/Competitor answers were not inspected/);
 for(const bad of [{targetId:'invented'},{linkIds:['fake']},{draft:'See https://evil.example'},{draft:'You must enroll.'},{draft:'x'.repeat(1801)}])assert.throws(()=>reviewSuggestion({...output,...bad},[page],'Question',period));
});
test('generation enforces origin, role, input, saved evidence, no-source failure and burst limits',async()=>{
 let accessCalls=0,generated=0;const report={period,prompts:[{id:pid,prompt:'Part D question',mentions:0,domainMentions:0,competitors:[{brand:'Other',mentions:2}]}]};
 const query={select(){return this;},eq(){return this;},async maybeSingle(){return {data:{payload:report}};}};
 const access=async()=>{accessCalls++;return {user:{id:'owner'},client:{from:()=>query}};};
 const deps={access,origin:()=> 'https://dashboard.example',sources:async()=>[page],generate:async evidence=>{generated++;assert.equal(evidence.prompt.mentions,0);return output;}};
 const h=contentHandler(deps);
 assert.equal((await h(req(undefined,'https://evil.example'))).status,403);assert.equal(accessCalls,0);
 assert.equal((await h(req({snapshotId:'bad'}))).status,400);
 assert.equal((await h(req({...JSON.parse(await req().text()),mentions:999}))).status,200);
 await h(req());await h(req());assert.equal((await h(req())).status,429);assert.equal(generated,3);
 assert.equal((await contentHandler({...deps,sources:async()=>[]})(req())).status,422);
 assert.equal((await contentHandler({...deps,access:async()=>{throw Object.assign(Error('Forbidden'),{status:403});}})(req())).status,403);
});
