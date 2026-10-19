import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
const analyst='11111111-1111-4111-8111-111111111111',viewer='22222222-2222-4222-8222-222222222222',outsider='33333333-3333-4333-8333-333333333333';
test('keyword evidence is immutable, tied to saved finding dates and protected by membership',async()=>{
 const db=new PGlite();
 const asUser=async(id)=>{await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);await db.exec('set role authenticated');};
 try {
  await db.exec('create role anon; create role authenticated; create schema auth; create table auth.users(id uuid primary key);');
  await db.exec("create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$; grant usage on schema public,auth to authenticated,anon;");
  for(const id of [analyst,viewer,outsider])await db.query('insert into auth.users values ($1)',[id]);
  for(const file of ['20261019145752_growth_foundation.sql','20261019145804_growth_declines.sql','20261019191424_growth_live_gsc.sql','20261019203559_growth_keyword_research.sql'])await db.exec(await readFile(new URL('../supabase/migrations/'+file,import.meta.url),'utf8'));
  await db.query("insert into public.growth_members(user_id,role) values ($1,'analyst'),($2,'viewer')",[analyst,viewer]);await db.exec('update public.growth_settings set enabled=true');await asUser(analyst);
  const page='https://www.medicarefaq.com/example/';
  const snapshot=(start,end,clicks)=>({schemaVersion:1,source:'gsc',property:'https://www.medicarefaq.com/',timezone:'America/Los_Angeles',coverage:'gsc_api_final_pages_no_parameters_not_exhaustive',start,end,rows:[{url:page,clicks,impressions:100,ctr:clicks/100,position:5}]});
  const prior=snapshot('2026-09-01','2026-09-07',40),current=snapshot('2026-09-08','2026-09-14',20);
  const live=(await db.query('select public.growth_analyze_gsc($1::jsonb,$2::jsonb) as result',[JSON.stringify(prior),JSON.stringify(current)])).rows[0].result;
  const queryRow={query:'example query',clicks:10,impressions:100,ctr:.1,position:5};
  const payload={version:'query-v1',source:'gsc',property:prior.property,timezone:prior.timezone,page,prior:{start:prior.start,end:prior.end,rows:[queryRow]},current:{start:current.start,end:current.end,rows:[]},fetchedAt:'2026-10-19T20:00:00.000Z'};
  const save=async(value,run=live.run.id)=>(await db.query('select public.growth_save_query_research($1,$2::jsonb) as saved',[run,JSON.stringify(value)])).rows[0].saved;
  for(const bad of [null,{...payload,extra:true},{...payload,page:'https://evil.test/'},{...payload,fetchedAt:null},{...payload,prior:{...payload.prior,start:'2026-09-02'}},{...payload,current:{...payload.current,rows:[{...queryRow,ctr:null}]}},{...payload,current:{...payload.current,rows:[{...queryRow,clicks:101}]}},{...payload,current:{...payload.current,rows:[queryRow,queryRow]}}])await assert.rejects(save(bad));
  assert.equal((await db.query('select count(*)::int as n from public.growth_query_research')).rows[0].n,0);
  const first=await save(payload);assert.equal(first.reused,false);
  const repeated=await save({...payload,current:{...payload.current,rows:[queryRow]}});assert.equal(repeated.reused,true);assert.equal(repeated.research.id,first.research.id);assert.equal(repeated.research.payload.current.rows.length,0,'later requests cannot overwrite frozen evidence');
  for(const sql of ['delete from public.growth_query_research','update public.growth_query_research set page=page','insert into public.growth_query_research select * from public.growth_query_research'])await assert.rejects(db.exec(sql),e=>e.code==='42501');
  await asUser(viewer);assert.equal((await db.query('select id from public.growth_query_research')).rows.length,1);await assert.rejects(save(payload),e=>e.code==='42501');
  await asUser(outsider);assert.equal((await db.query('select id from public.growth_query_research')).rows.length,0);await assert.rejects(save(payload),e=>e.code==='42501');
  await db.exec('reset role; set role anon');await assert.rejects(save(payload),e=>e.code==='42501');await assert.rejects(db.exec('select * from public.growth_query_research'),e=>e.code==='42501');
  await db.exec('reset role; update public.growth_settings set enabled=false');await asUser(analyst);assert.equal((await db.query('select id from public.growth_query_research')).rows.length,0);await assert.rejects(save(payload),e=>e.code==='42501');
 }finally{await db.close();}
});
