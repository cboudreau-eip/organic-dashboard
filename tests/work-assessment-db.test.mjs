import test from 'node:test';import assert from 'node:assert/strict';import {PGlite} from '@electric-sql/pglite';import {readFile} from 'node:fs/promises';
test('assessment storage is separate, role restricted and prevents duplicate active jobs',async()=>{
 const db=new PGlite();try{
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);insert into auth.users values ('11111111-1111-4111-8111-111111111111');create function public.growth_access() returns text language sql stable as $$select current_setting('test.access',true)$$;create table content_work_pilots(id uuid primary key);insert into content_work_pilots values ('11111111-1111-4111-8111-111111111111');grant usage on schema public to authenticated,service_role;grant select on content_work_pilots to authenticated;`);
 await db.exec(await readFile('supabase/migrations/20261123162754_work_page_assessments.sql','utf8'));
 const insert=`insert into content_work_assessments(queue_id,assignment_id,fingerprint,status,created_by) values ('11111111-1111-4111-8111-111111111111','a',repeat('f',64),'running','11111111-1111-4111-8111-111111111111')`;
 await db.exec('set role service_role');await db.exec(insert);await assert.rejects(db.exec(insert),/unique/);await db.exec("update content_work_assessments set status='complete',payload='{}'");await db.exec(insert);
 await db.exec("reset role;set role authenticated;set test.access='viewer'");assert.equal((await db.query('select count(*) from content_work_assessments')).rows[0].count,2);await assert.rejects(db.exec(insert),/permission denied/);await assert.rejects(db.exec("update content_work_assessments set status='failed'"),/permission denied/);
 await db.exec("set test.access='outsider'");assert.equal((await db.query('select count(*) from content_work_assessments')).rows[0].count,0);await db.exec('reset role;set role anon');await assert.rejects(db.query('select * from content_work_assessments'),/permission denied/);
 }finally{await db.close();}
});
