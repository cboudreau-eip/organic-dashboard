import test from 'node:test';
import assert from 'node:assert/strict';
import {DEFAULTS,settingsInput} from '../lib/research/contracts.js';
import {advance,initialPayload,publicRun} from '../lib/research/engine.js';
import {topicKey,rankOpportunities,intentFor} from '../lib/research/rank.js';
import {inventoryEntry,sitemapEntries} from '../lib/research/inventory.js';
const url='https://www.medicarefaq.com/medigap/plan-g/';
const html='<main><h1>Compare Medigap Plan G costs</h1><h2>Get a Plan G quote</h2><p>'+('Compare Plan G premiums and eligibility. '.repeat(15))+'</p></main>';
const page=inventoryEntry(url,{url,html});
const source={gsc:{status:'available',rows:[{keys:['compare medigap plan g costs',url],impressions:120,clicks:5,position:12,ctr:5/120}]},semrush:{status:'available',rows:[{keyword:'compare medigap plan g costs',landing:url,volume:100,difficulty:40,intents:'c'}]},posthog:{rows:[{path:'/medigap/plan-g/',conversions:{sessions:40,quoteStarts:3}}]},otterly:{prompts:[{id:'p',prompt:'Get a Medigap quote without underwriting',mentions:0,domainMentions:0}]}};
test('research accepts planning inputs and rejects invalid dates and unsupported scope',()=>{
 assert.deepEqual(settingsInput(DEFAULTS),DEFAULTS);
 assert.throws(()=>settingsInput({...DEFAULTS,start:'2027-02-30'}));
 assert.throws(()=>settingsInput({...DEFAULTS,products:[]}));
 assert.throws(()=>settingsInput({...DEFAULTS,unknown:true}));
});
test('ranking uses observed evidence, retains long-tail gaps and preserves unknowns',()=>{
 for(const term of ['plan g vs plan n','aetna medigap reviews','medigap premiums','medigap costs','switching medigap policies'])assert.equal(intentFor(term).value,4,term);
 assert.equal(intentFor('medigap enrollment').value,5);
 const r=rankOpportunities(source,[page],DEFAULTS,true);
 const existing=r.items.find(x=>x.title.startsWith('compare')),fresh=r.items.find(x=>x.title.startsWith('Get'));
 assert.equal(existing.type,'Update existing page');assert.equal(existing.evidence.posthog.quoteStarts,3);
 assert.equal(existing.components.competition.value,3);
 assert.equal(fresh.intent,'Transactional');assert.equal(fresh.components.demand.value,null);
 assert.ok(fresh.scoreMax>fresh.score);assert.equal(fresh.evidence.otterly[0].mentions,0);
 assert.notEqual(topicKey('quote without underwriting'),topicKey('quote with underwriting'));
 const excluded=rankOpportunities(source,[page],{...DEFAULTS,excluded:['costs']},true);
 assert.equal(excluded.items.length,1);
 const missing=rankOpportunities(source,[{...page,status:'unavailable'}],DEFAULTS,false);
 assert.equal(missing.items.find(x=>x.title.startsWith('compare')).type,'Investigate page');
 assert.equal(missing.items[0].confidence,'Low');
});
test('inventory restricts host and retains page meaning instead of just URL words',()=>{
 assert.deepEqual(sitemapEntries('<loc>https://evil.example/x</loc><loc>'+url+'</loc>'),[url]);
 assert.equal(page.status,'read');assert.match(page.headings[0],/Compare/);
 assert.equal(page.url,'https://www.medicarefaq.com/medigap/plan-g');
});
test('candidate cap retains commercial tracked terms and low-volume monitored long tails',()=>{
 const evidence={gsc:{rows:Array.from({length:1100},(_,i)=>({keys:['medicare enrollment '+i,url],impressions:1000,clicks:4}))},semrush:{rows:[{keyword:'medigap company reviews',intents:'c',difficulty:25,volume:0}]},otterly:{prompts:[{prompt:'compare part d plans for a rare prescription',mentions:0,domainMentions:0}]}};
 const result=rankOpportunities(evidence,[],DEFAULTS,false);
 assert.equal(result.items.length,1000);assert.equal(result.counts.capped,true);
 assert.ok(result.items.some(x=>x.title==='medigap company reviews'));
 assert.ok(result.items.some(x=>x.title==='compare part d plans for a rare prescription'));
});
test('resumable research handles partial failures and never returns page text or raw query corpus to browser',async()=>{
 let gscCalls=0;const adapters={gsc:async previous=>{gscCalls++;return {...source.gsc,rows:[...(previous?.rows||[]),...source.gsc.rows],more:gscCalls===1};},posthog:async()=>{throw Error('private detail');},semrush:async()=>source.semrush,otterly:async()=>source.otterly,read:async requested=>({url:requested,html:requested.endsWith('sitemap.xml')?'<urlset><url><loc>'+url+'</loc></url></urlset>':html})};
 let run={settings:DEFAULTS,payload:initialPayload(),stage:'gsc',status:'running'};
 for(let i=0;i<15&&run.status!=='complete';i++)run={...run,...await advance(run,adapters)};
 assert.equal(run.status,'complete');assert.equal(gscCalls,2);assert.equal(run.payload.evidence.posthog.status,'unavailable');
 assert.ok(run.payload.results.items.length);const view=publicRun(run);
 assert.equal(view.sources.gsc.rows,undefined);assert.equal(view.inventory.pages,undefined);
 assert.ok(!JSON.stringify(view).includes('private detail'));
 assert.ok(!JSON.stringify(view).includes('textTruncated'));
});
