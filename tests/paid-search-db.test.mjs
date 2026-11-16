import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {PGlite} from '@electric-sql/pglite';
test('paid research is team-readable, analyst-importable and immutable; anonymous and outsiders are denied',async()=>{
 const db=new PGlite();try{await db.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql as $$select nullif(current_setting('test.uid',true),'')::uuid$$;create function public.growth_access() returns text language sql as $$select current_setting('test.role',true)$$;grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;insert into auth.users values('11111111-1111-4111-8111-111111111111');`);await db.exec(await readFile('supabase/migrations/20261116164424_paid_search_research.sql','utf8'));
 await db.exec(`set role authenticated;set test.uid='11111111-1111-4111-8111-111111111111';set test.role='analyst';insert into paid_search_research(fingerprint,payload) values(repeat('a',64),'{"rows":[{}]}'::jsonb);`.replace("'{'||'\"rows\":[{}]}'::text::jsonb","'{\"rows\":[{}]}'::jsonb"));
 assert.equal((await db.query('select * from paid_search_research')).rows.length,1);
 await assert.rejects(()=>db.exec("update paid_search_research set payload='{}'"));await assert.rejects(()=>db.exec('delete from paid_search_research'));
 await db.exec("set test.role='viewer'");assert.equal((await db.query('select * from paid_search_research')).rows.length,1);await assert.rejects(()=>db.exec(`insert into paid_search_research(fingerprint,payload) values(repeat('b',64),'{"rows":[{}]}')`));
 await db.exec("set test.role='outsider'");assert.equal((await db.query('select * from paid_search_research')).rows.length,0);await db.exec('reset role;set role anon');await assert.rejects(()=>db.query('select * from paid_search_research'));
 }finally{await db.close();}
});
