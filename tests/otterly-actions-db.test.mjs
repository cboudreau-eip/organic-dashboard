import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
test('Otterly actions derive immutable baselines, reject forged evidence and avoid active duplicates',async()=>{
 const db=new PGlite();const snapshot='22222222-2222-4222-8222-222222222222',prompt='01M48XVD3FBK3GBNYJCKGW571P';
 try{
  await db.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);
  insert into auth.users values ('11111111-1111-4111-8111-111111111111');
  create function auth.uid() returns uuid language sql stable as $$select '11111111-1111-4111-8111-111111111111'::uuid$$;
  create function public.growth_access() returns text language sql stable as $$select current_setting('test.access',true)$$;
  create table public.semrush_snapshots(id uuid primary key);create table public.otterly_snapshots(id uuid primary key,payload jsonb);
  grant usage on schema auth,public to authenticated;grant select on public.otterly_snapshots to authenticated;`);
  await db.exec(await readFile('supabase/action-tracking.sql','utf8'));
  await db.exec(await readFile('supabase/migrations/20261102202615_otterly_tracked_actions.sql','utf8'));
  const p={id:prompt,prompt:'Question?',mentions:0,domainMentions:2,competitors:[{brand:'Other',mentions:3}]};
  const report={reportId:'report',domain:'medicarefaq.com',country:'us',period:{start:'2026-10-03',end:'2026-11-01'},fetchedAt:'2026-11-02T12:00:00Z',prompts:[p],promptPlatforms:[{id:'perplexity',label:'Perplexity',prompts:[p]},{id:'claude',label:'Claude',prompts:null}]};
  await db.query('insert into public.otterly_snapshots values ($1,$2)',[snapshot,JSON.stringify(report)]);
  await db.exec("set role authenticated;set test.access='analyst'");
  const insert=()=>db.query("insert into public.growth_actions(title,source_otterly_snapshot,source_otterly_prompt) values ('Fake title',$1,$2) returning *",[snapshot,prompt]);
  const action=(await insert()).rows[0];
  assert.equal(action.page,null);assert.equal(action.title,'Investigate AI visibility: Question?');
  assert.equal(action.history[0].title,action.title);assert.equal(action.otterly_baseline.prompt.domainMentions,2);
  assert.equal(action.otterly_baseline.platforms[1].prompt,null);
  await assert.rejects(insert());
  await assert.rejects(db.query("insert into public.growth_actions(title,source_otterly_snapshot,source_otterly_prompt,otterly_baseline) values ('Forged',$1,$2,'{}')",[snapshot,prompt]));
  await assert.rejects(db.query("insert into public.growth_actions(title,source_otterly_snapshot,source_otterly_prompt) values ('Wrong',$1,'not-in-report')",[snapshot]));
  await db.query("update public.growth_actions set notes='Review the cited page',status='in_progress' where id=$1",[action.id]);
  await db.exec('reset role');await db.query("update public.otterly_snapshots set payload='{}' where id=$1",[snapshot]);
  await db.exec("set role authenticated;set test.access='analyst'");
  const changed=(await db.query('select * from public.growth_actions where id=$1',[action.id])).rows[0];
  assert.deepEqual(changed.otterly_baseline,action.otterly_baseline);assert.equal(changed.version,2);
  await db.exec("set test.access='viewer'");await assert.rejects(insert());
  await db.exec("set test.access='outsider'");assert.equal((await db.query('select * from public.growth_actions')).rows.length,0);
 }finally{await db.close();}
});
