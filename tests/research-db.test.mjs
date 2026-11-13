import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
test('research permissions, immutable completed evidence and valid versioned decisions',async()=>{
 const db=new PGlite();try{
 await db.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);
 insert into auth.users values ('11111111-1111-4111-8111-111111111111');
 create function auth.uid() returns uuid language sql stable as $$select '11111111-1111-4111-8111-111111111111'::uuid$$;
 create function public.growth_access() returns text language sql stable as $$select current_setting('test.access',true)$$;
 grant usage on schema auth,public to authenticated;`);
 await db.exec(await readFile('supabase/migrations/20261113145339_research_opportunities.sql','utf8'));
 await db.exec("set role authenticated;set test.access='analyst'");
 const id='22222222-2222-4222-8222-222222222222',key='abcdefabcdefabcdefabcdef';
 await db.query("insert into research_runs(id,settings,payload) values ($1,'{}','{}')",[id]);
 await assert.rejects(db.exec("update research_runs set settings='{\"changed\":true}'"));
 await assert.rejects(db.query("insert into research_reviews(key,run_id,decision) values ($1,$2,'Keep')",[key,id]));
 await db.query("update research_runs set stage='complete',status='complete',payload=$1 where version=1",[JSON.stringify({results:{items:[{key}]}})]);
 assert.equal((await db.query('select version from research_runs')).rows[0].version,2);
 await assert.rejects(db.exec("update research_runs set payload='{}'"));
 await db.query("insert into research_reviews(key,run_id,decision) values ($1,$2,'Keep')",[key,id]);
 await db.exec("update research_reviews set decision='Defer' where version=1");
 assert.equal((await db.exec("update research_reviews set decision='Reject' where version=1 returning key"))[0].rows.length,0);
 await db.exec("set test.access='viewer'");
 assert.equal((await db.query('select * from research_runs')).rows.length,1);
 assert.equal((await db.query("update research_reviews set decision='Reject' returning key")).rows.length,0);
 await assert.rejects(db.exec("insert into research_settings(settings) values ('{}')"));
 await db.exec("set test.access='outsider'");assert.equal((await db.query('select * from research_runs')).rows.length,0);
 await db.exec('reset role;set role anon');await assert.rejects(db.query('select * from research_runs'));
 }finally{await db.close();}
});
