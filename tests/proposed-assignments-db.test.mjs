import {generateCalendar} from '../lib/research/demo-calendar.js';
import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {PGlite} from '@electric-sql/pglite';
test('proposal evidence is immutable, edits versioned, and readers cannot write',async()=>{
 const db=new PGlite();try{
 await db.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);insert into auth.users values ('11111111-1111-4111-8111-111111111111');create function auth.uid() returns uuid language sql stable as $$select '11111111-1111-4111-8111-111111111111'::uuid$$;create function public.growth_access() returns text language sql stable as $$select current_setting('test.access',true)$$;grant usage on schema auth,public to authenticated;create table research_runs(id uuid primary key,status text);insert into research_runs values ('22222222-2222-4222-8222-222222222222','complete');grant select on research_runs to authenticated;`);
 await db.exec(await readFile('supabase/migrations/20261114122708_proposed_content_plans.sql','utf8'));
 await db.exec(await readFile('supabase/migrations/20261114124401_tentative_demo_calendar.sql','utf8'));
 await db.exec("set role authenticated;set test.access='analyst'");
 await db.query("insert into proposed_content_plans(research_run_id,payload) values ('22222222-2222-4222-8222-222222222222',$1)",[JSON.stringify({items:Array.from({length:90},(_,i)=>({id:i?'item'+i:'one',category:'Evergreen',title:'Original',evidence:{count:5}}))})]);
 await db.exec(`update proposed_content_plans set edits='{"one":{"title":"Revised"}}' where version=1`);assert.equal((await db.query('select version from proposed_content_plans')).rows[0].version,2);
 await assert.rejects(db.exec(`update proposed_content_plans set payload='{"items":[]}'`));await assert.rejects(db.exec(`update proposed_content_plans set edits='{"one":{"evidence":{}}}'`));await assert.rejects(db.exec(`update proposed_content_plans set edits='{"one":{"targetUrl":"https://evil.example"}}'`));
 assert.equal((await db.exec(`update proposed_content_plans set edits='{}' where version=1 returning id`))[0].rows.length,0);
 const stored=(await db.query('select payload from proposed_content_plans')).rows[0];const calendar=generateCalendar(stored.payload.items);await db.query('update proposed_content_plans set calendar=$1',[JSON.stringify(calendar)]);assert.equal((await db.query('select edits from proposed_content_plans')).rows[0].edits.one.title,'Revised');await assert.rejects(db.query('update proposed_content_plans set calendar=$1',[JSON.stringify({...calendar,status:'Published'})]));await assert.rejects(db.query('update proposed_content_plans set calendar=$1',[JSON.stringify({...calendar,dates:{...calendar.dates,one:'2027-04-01'}})]));
 await db.exec("set test.access='viewer'");assert.equal((await db.query('select * from proposed_content_plans')).rows.length,1);assert.equal((await db.exec("update proposed_content_plans set edits='{}' returning id"))[0].rows.length,0);
 await db.exec("set test.access='outsider'");assert.equal((await db.query('select * from proposed_content_plans')).rows.length,0);await db.exec('reset role;set role anon');await assert.rejects(db.query('select * from proposed_content_plans'));
 }finally{await db.close();}
});
