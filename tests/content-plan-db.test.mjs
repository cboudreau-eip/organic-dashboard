import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
test('planning storage enforces approval, versions and team permissions',async()=>{
 const db=new PGlite();try{
 await db.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);
 insert into auth.users values ('11111111-1111-4111-8111-111111111111');
 create function auth.uid() returns uuid language sql stable as $$select '11111111-1111-4111-8111-111111111111'::uuid$$;
 create function public.growth_access() returns text language sql stable as $$select current_setting('test.access',true)$$;
 grant usage on schema auth,public to authenticated;`);
 await db.exec(await readFile('supabase/migrations/20261112211531_content_plan_items.sql','utf8'));
 await db.exec("set role authenticated;set test.access='analyst'");
 await db.exec("insert into content_plan_items(id) values ('plan-g')");
 await assert.rejects(db.exec("update content_plan_items set scheduled_date='2027-01-01'"));
 await db.exec("update content_plan_items set approved=true,status='Approved',scheduled_date='2027-01-01',brief='Review costs' where id='plan-g' and version=1");
 assert.equal((await db.query("select version from content_plan_items")).rows[0].version,2);
 assert.equal((await db.query("update content_plan_items set brief='Stale edit' where version=1 returning id")).rows.length,0);
 await assert.rejects(db.exec("update content_plan_items set scheduled_date='2027-04-01'"));
 await db.exec("set test.access='viewer'");
 assert.equal((await db.query('select * from content_plan_items')).rows.length,1);
 assert.equal((await db.query("update content_plan_items set brief='Blocked' returning id")).rows.length,0);
 await assert.rejects(db.exec("insert into content_plan_items(id) values ('blocked')"));
 await db.exec("set test.access='outsider'");assert.equal((await db.query('select * from content_plan_items')).rows.length,0);
 await db.exec('reset role;set role anon');await assert.rejects(db.query('select * from content_plan_items'));
 }finally{await db.close();}
});
