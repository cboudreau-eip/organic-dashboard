import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
test('action storage persists revisions and restricts viewers, outsiders, anonymous users and stale results',async()=>{
 const db=new PGlite();
 try{
 await db.exec(`
 create role anon;create role authenticated;
 create schema auth;
 create table auth.users(id uuid primary key);
 insert into auth.users values ('11111111-1111-4111-8111-111111111111');
 create function auth.uid() returns uuid language sql stable as $$select '11111111-1111-4111-8111-111111111111'::uuid$$;
 create function public.growth_access() returns text language sql stable as $$select current_setting('test.access',true)$$;
 create table public.semrush_snapshots(id uuid primary key);
 grant usage on schema auth,public to authenticated;
 `);
 await db.exec(await readFile('supabase/action-tracking.sql','utf8'));
 await db.exec("set role authenticated;set test.access='analyst';");
 const a=(await db.query("insert into public.growth_actions(page,title,notes) values ('https://www.medicarefaq.com/plans/','Improve page','Initial plan') returning *")).rows[0];
 assert.equal(a.version,1);assert.equal(a.history.length,1);
 await db.query("update public.growth_actions set status='published',published_on='2026-01-01',notes='Changed title' where id=$1",[a.id]);
 const b=(await db.query('select * from public.growth_actions where id=$1',[a.id])).rows[0];
 assert.equal(b.version,2);assert.equal(b.history.length,2);assert.equal(b.history[0].notes,'Initial plan');
 await assert.rejects(db.query("update public.growth_actions set page='https://www.medicarefaq.com/other/' where id=$1",[a.id]));
 await assert.rejects(db.query("insert into public.growth_action_results(action_id,action_version,published_on,window_days,payload) values ($1,1,'2026-01-01',7,'{}')",[a.id]));
 await db.query("insert into public.growth_action_results(action_id,action_version,published_on,window_days,payload) values ($1,2,'2026-01-01',7,'{}')",[a.id]);
 await assert.rejects(db.query("insert into public.growth_actions(page,title) values ('https://www.medicarefaq.com/plans/','Duplicate')"));
 await db.exec("set test.access='viewer'");
 assert.equal((await db.query('select * from public.growth_actions')).rows.length,1);
 await assert.rejects(db.query("insert into public.growth_actions(page,title) values ('https://www.medicarefaq.com/new/','Blocked')"));
 assert.equal((await db.query("update public.growth_actions set notes='Blocked' returning id")).rows.length,0);
 await assert.rejects(db.query('delete from public.growth_actions'));
 await db.exec("set test.access='outsider'");
 assert.equal((await db.query('select * from public.growth_actions')).rows.length,0);
 assert.equal((await db.query('select * from public.growth_action_results')).rows.length,0);
 await db.exec('reset role;set role anon');
 await assert.rejects(db.query('select * from public.growth_actions'));
 }finally{await db.close();}
});
