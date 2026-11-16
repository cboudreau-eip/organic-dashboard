import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {PGlite} from '@electric-sql/pglite';
test('only server role writes resolution evidence; viewers can read and outsiders cannot',async()=>{
 const db=new PGlite();try{
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create table public.proposed_content_plans(id uuid primary key);insert into public.proposed_content_plans values('11111111-1111-4111-8111-111111111111');create function public.growth_access() returns text language sql stable as $$select current_setting('test.role',true)$$;`);
 await db.exec(await readFile('supabase/migrations/20261116211034_proposal_target_resolutions.sql','utf8'));
 await db.exec(`set role service_role;insert into public.proposal_target_resolutions values('11111111-1111-4111-8111-111111111111','item','123456789012345678901234','{}');reset role;set role authenticated;set test.role='viewer';`);
 assert.equal((await db.query('select * from public.proposal_target_resolutions')).rows.length,1);
 await assert.rejects(db.exec("update public.proposal_target_resolutions set result='{}'"));await db.exec("set test.role='analyst'");await assert.rejects(db.exec("update public.proposal_target_resolutions set result='{}'"));
 await db.exec("set test.role='outsider'");assert.equal((await db.query('select * from public.proposal_target_resolutions')).rows.length,0);await db.exec('reset role;set role anon');await assert.rejects(db.query('select * from public.proposal_target_resolutions'));
 }finally{await db.close();}
});
