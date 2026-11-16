import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {PGlite} from '@electric-sql/pglite';import {generateCalendar} from '../lib/research/demo-calendar.js';
test('revision forks atomically, preserves edits and dates, rejects stale versions and viewer writes',async()=>{
 const db=new PGlite();try{
 await db.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);insert into auth.users values ('11111111-1111-4111-8111-111111111111');create function auth.uid() returns uuid language sql stable as $$select '11111111-1111-4111-8111-111111111111'::uuid$$;create function public.growth_access() returns text language sql stable as $$select current_setting('test.access',true)$$;grant usage on schema auth,public to authenticated;create table research_runs(id uuid primary key,status text);insert into research_runs values ('22222222-2222-4222-8222-222222222222','complete');grant select on research_runs to authenticated;`);
 for(const name of ['20261114122708_proposed_content_plans','20261114124401_tentative_demo_calendar','20261116191347_revise_paid_proposals'])await db.exec(await readFile('supabase/migrations/'+name+'.sql','utf8'));
 await db.exec("set role authenticated;set test.access='analyst'");
 const payload={items:Array.from({length:90},(_,i)=>({id:'slot'+i,title:'Original '+i,category:'Evergreen'}))},calendar=generateCalendar(payload.items);calendar.locked=['slot0'];
 const original=(await db.query("insert into proposed_content_plans(research_run_id,payload,edits,calendar) values ('22222222-2222-4222-8222-222222222222',$1,$2,$3) returning *",[JSON.stringify(payload),JSON.stringify({slot0:{title:'My edit'}}),JSON.stringify(calendar)])).rows[0];
 const revised=structuredClone(payload);revised.items[1].title='New paid-supported topic';
 const call=(version,p=revised)=>db.query('select * from public.revise_paid_proposal_plan($1,$2,$3)',[original.id,version,JSON.stringify(p)]);
 await assert.rejects(call(0),/Plan changed/);
 const unsafe=structuredClone(revised);unsafe.items[0].title='Overwritten';await assert.rejects(call(1,unsafe),/Manually edited/);
 const changedIds=structuredClone(revised);changedIds.items[1].id='new';await assert.rejects(call(1,changedIds),/original assignment slots/);
 const saved=(await call(1)).rows[0];assert.notEqual(saved.id,original.id);assert.deepEqual(saved.edits,original.edits);assert.deepEqual(saved.calendar,calendar);assert.equal(saved.payload.items[1].title,revised.items[1].title);
 assert.deepEqual((await db.query('select payload from proposed_content_plans where id=$1',[original.id])).rows[0].payload,payload);
 await db.exec("set test.access='viewer'");await assert.rejects(call(1),/Editor access/);
 await db.exec('reset role;set role anon');await assert.rejects(call(1),/permission denied/);
 }finally{await db.close();}
});
