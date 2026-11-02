import test from 'node:test';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {readFile} from 'node:fs/promises';
import {REPORT_ID,WORKSPACE_ID,reportPeriod,ownUrl,normalizeReport,normalizeStats,validateReport} from '../lib/otterly/report.js';
import {otterlyClient} from '../lib/otterly/client.js';
const meta={id:REPORT_ID,workspaceId:WORKSPACE_ID,brand:'MedicareFAQ',brandDomain:'medicarefaq.com',createdDate:'2026-06-19'};
const stats={id:REPORT_ID,status:'finished',brand:{brand:'MedicareFAQ',brandDomain:'medicarefaq.com'},isRecalculating:false,totalPrompts:41,summary:{totalMentions:12,brandCoverage:10,domainCoverage:20,averagePosition:null},competitorBrandsAnalysis:{brandMentions:[{brand:'MedicareFAQ',isMainBrand:true,mentions:9,brandCoverage:7,averagePosition:null}],brandCoverageHistory:[]}};
test('Otterly uses completed New York days across DST and year boundaries',()=>{
 assert.deepEqual(reportPeriod(new Date('2026-11-02T03:00:00Z')),{start:'2026-10-02',end:'2026-10-31'});
 assert.deepEqual(reportPeriod(new Date('2027-01-01T16:00:00Z')),{start:'2026-12-02',end:'2026-12-31'});
});
test('Otterly rejects other sites and scope drift, and preserves unavailable values',()=>{
 for(const url of ['https://medicarefaq.com.evil.com/a','https://medicarefaq.com@evil.com','https://staging.medicarefaq.com/a','javascript:alert(1)'])assert.equal(ownUrl(url),null);
 assert.ok(ownUrl('https://www.medicarefaq.com/a'));
 assert.throws(()=>validateReport({...meta,brandDomainVariations:['other.com']}));
 assert.throws(()=>normalizeStats({...stats,isRecalculating:true}));
 const r=normalizeReport({meta,stats,period:{start:'2026-10-03',end:'2026-11-01'},citations:[{url:'https://www.medicarefaq.com/a',citations:0},{url:'https://other.com',citations:999}],prompts:[],engines:[]});
 assert.equal(r.pages.length,1);assert.equal(r.pages[0].citations,0);assert.equal(r.summary.position,null);assert.equal(r.summary.mentions,9);assert.equal(r.summary.coverage,7);
});
test('Otterly follows pagination, filters domain server-side, and isolates unsupported engines',async()=>{
 const calls=[];
 const fetcher=async(url,options)=>{
  calls.push(String(url));assert.equal(options.headers.Authorization,'Bearer private-key');assert.equal(options.redirect,'error');
  let value;
  if(url.pathname.endsWith(REPORT_ID))value=meta;
  else if(url.pathname.endsWith('/stats')){if(url.searchParams.get('engines')==='claude')return new Response('',{status:400});value=stats;}
  else {const offset=Number(url.searchParams.get('offset'));value={items:url.pathname.endsWith('/citations')?[{url:'https://medicarefaq.com/'+offset,title:'Page',citations:2}]:[],paging:{offset,limit:100,hasMore:url.pathname.endsWith('/citations')&&offset===0}};}
  return Response.json(value);
 };
 const r=await otterlyClient('private-key',fetcher).sync(new Date('2026-11-02T15:00Z'));
 assert.equal(r.pages.length,2);assert.ok(calls.some(c=>c.includes('domains=medicarefaq.com')&&c.includes('offset=100')));
 assert.equal(r.engines.find(e=>e.id==='claude').available,false);assert.equal(r.engines.find(e=>e.id==='claude').mentions,null);
});
test('Otterly fails closed on bad pagination and does not forward provider secrets in errors',async()=>{
 const f=async u=>Response.json(u.pathname.endsWith(REPORT_ID)?meta:u.pathname.endsWith('/stats')?stats:{items:[],paging:{offset:0,limit:100,hasMore:true}});
 await assert.rejects(otterlyClient('private-key',f).sync(),/Incomplete Otterly/);
 await assert.rejects(otterlyClient('private-key',async()=>new Response('private-key',{status:401})).sync(),e=>!e.message.includes('private-key'));
});
test('Otterly storage restricts writers, keeps reports immutable, and serializes daily syncs',async()=>{
 const db=new PGlite();
 try{
  await db.exec("create role anon;create role authenticated;create role service_role bypassrls;grant usage on schema public to anon,authenticated,service_role;create function public.growth_access() returns text language sql as $$select current_setting('test.role',true)$$;");
  await db.exec(await readFile(new URL('../supabase/migrations/20261102161744_otterly_daily_snapshots.sql',import.meta.url),'utf8'));
  await db.exec('set role service_role');
  assert.equal((await db.query("select public.otterly_claim_sync('2026-11-01') as claimed")).rows[0].claimed,true);
  assert.equal((await db.query("select public.otterly_claim_sync('2026-11-01') as claimed")).rows[0].claimed,false);
  const payload=normalizeReport({meta,stats,citations:[],prompts:[],engines:[],period:{start:'2026-10-03',end:'2026-11-01'}});
  await db.query("insert into public.otterly_snapshots(period_end,payload) values('2026-11-01',$1)",[JSON.stringify(payload)]);
  await db.exec("reset role;set role authenticated;select set_config('test.role','viewer',false)");
  assert.equal((await db.query('select * from public.otterly_snapshots')).rows.length,1);
  await assert.rejects(db.query("select public.otterly_claim_sync('2026-11-01')"));
  await assert.rejects(db.query('delete from public.otterly_snapshots'));
  await db.exec("select set_config('test.role','outsider',false)");
  assert.equal((await db.query('select * from public.otterly_snapshots')).rows.length,0);
  await db.exec('reset role;set role anon');await assert.rejects(db.query('select * from public.otterly_snapshots'));
 }finally{await db.close();}
});
