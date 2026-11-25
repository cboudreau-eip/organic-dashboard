import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {PGlite} from '@electric-sql/pglite';
import {generateCalendar} from '../lib/research/demo-calendar.js';
test('pilot creation and work edits preserve calendar and snapshots, enforce roles and optimistic versions',async()=>{
 const db=new PGlite();try{
 await db.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);insert into auth.users values ('11111111-1111-4111-8111-111111111111');create function auth.uid() returns uuid language sql stable as $$select '11111111-1111-4111-8111-111111111111'::uuid$$;create function public.growth_access() returns text language sql stable as $$select current_setting('test.access',true)$$;grant usage on schema auth,public to authenticated;create table research_runs(id uuid primary key,status text);insert into research_runs values ('22222222-2222-4222-8222-222222222222','complete');grant select on research_runs to authenticated;`);
 for(const n of ['20261114122708_proposed_content_plans','20261114124401_tentative_demo_calendar','20261117145645_content_work_pilot'])await db.exec(await readFile('supabase/migrations/'+n+'.sql','utf8'));
 await db.exec("set role authenticated;set test.access='analyst'");
 const items=Array.from({length:90},(_,n)=>({id:'slot'+n,title:'Task '+n,category:'Evergreen',action:'Existing instructions',terms:['query '+n],verification:'Check facts',measure:'GSC'})),calendar=generateCalendar(items);
 const p=(await db.query("insert into proposed_content_plans(research_run_id,payload,edits,calendar) values ('22222222-2222-4222-8222-222222222222',$1,$2,$3) returning *",[JSON.stringify({items}),JSON.stringify({slot4:{title:'My manual title',notes:'Keep my notes'}}),JSON.stringify(calendar)])).rows[0];
 const start=v=>db.query('select * from start_content_work_pilot($1,$2)',[p.id,v]);
 await assert.rejects(start(0),/changed/);const q=(await start(1)).rows[0];assert.equal(q.entries.length,5);assert.equal(q.entries[4].snapshot.title,'My manual title');assert.equal(q.entries[4].snapshot.notes,'Keep my notes');assert.equal(q.entries[4].title_edited,true);assert.equal(q.week_start.toISOString?.().slice(0,10)||q.week_start,'2027-01-01');assert.ok(q.entries.every(e=>e.status==='Tentative'&&e.owner===''));
 const save=(v,brief='Updated work instructions')=>db.query('select * from save_content_work_task($1,$2,$3,$4,$5,$6)',[q.id,v,'slot4','Editor','In progress',brief]);
 const saved=(await save(q.version)).rows[0];assert.equal(saved.version,2);assert.equal(saved.entries[4].owner,'Editor');assert.deepEqual(saved.entries[4].snapshot,q.entries[4].snapshot);assert.deepEqual(saved.entries.map(e=>e.planned_date),q.entries.map(e=>e.planned_date));
 assert.deepEqual((await start(1)).rows[0],saved);await assert.rejects(save(1),/changed/);await assert.rejects(save(2,' '),/Invalid work fields/);
 const bad=structuredClone(saved.entries);bad[0].planned_date='2027-02-01';await assert.rejects(db.query('update content_work_pilots set entries=$2 where id=$1',[q.id,JSON.stringify(bad)]),/immutable/);
 await db.exec('reset role');await db.exec(await readFile('supabase/migrations/20261117153000_full_content_work_queue.sql','utf8'));await db.exec(await readFile('supabase/migrations/20261117153500_lock_work_queue_expansion.sql','utf8'));await db.exec("set role authenticated;set test.access='analyst'");
 const expanded=(await start(1)).rows[0];assert.equal(expanded.entries.length,90);assert.deepEqual(expanded.entries.slice(0,5),saved.entries);assert.equal(expanded.entries[89].planned_date,'2027-03-31');assert.deepEqual((await start(1)).rows[0],expanded);
 await assert.rejects(db.query('update content_work_pilots set entries=$2 where id=$1',[q.id,JSON.stringify(expanded.entries.slice(0,5))]),/Cannot remove/);
 const unchanged=(await db.query('select * from proposed_content_plans where id=$1',[p.id])).rows[0];assert.deepEqual(unchanged,p);
 await db.exec('reset role');await db.exec(await readFile('supabase/migrations/20261125100000_additive_content_calendar.sql','utf8'));await db.exec("set role authenticated;set test.access='analyst'");
 const additions=[{id:'new-a',title:'New long-tail',type:'New-page proposal',category:'Long-tail',targetUrl:'',action:'Create a new page',terms:['compare coverage'],verification:'Check',measure:'GSC',expansionEvidence:{checkedAt:'2026-11-25'}}];
 const appended=(await db.query('select * from append_content_assignments($1,$2,$3)',[p.id,1,JSON.stringify(additions)])).rows[0];
 assert.equal(appended.payload.items.length,91);assert.deepEqual(appended.payload.items.slice(0,90),p.payload.items);assert.deepEqual(appended.edits,p.edits);
 for(const [id,date] of Object.entries(p.calendar.dates))assert.equal(appended.calendar.dates[id],date);
 const afterQueue=(await db.query('select * from content_work_pilots where id=$1',[q.id])).rows[0];assert.equal(afterQueue.entries.length,91);
 for(const entry of expanded.entries)assert.deepEqual(afterQueue.entries.find(e=>e.assignment_id===entry.assignment_id),entry);
 await assert.rejects(db.query('select * from append_content_assignments($1,$2,$3)',[p.id,1,JSON.stringify(additions)]),/changed/);
 await assert.rejects(db.query('select * from append_content_assignments($1,$2,$3)',[p.id,appended.version,JSON.stringify(additions)]),/Invalid/);
 const altered=structuredClone(appended.payload);altered.items[0].title='Do not overwrite';altered.items.push({...additions[0],id:'new-b'});
 await assert.rejects(db.query('update proposed_content_plans set payload=$2 where id=$1',[p.id,JSON.stringify(altered)]),/Append only|Every assignment/);
 await db.exec("set test.access='viewer'");assert.equal((await db.query('select count(*) from content_work_pilots')).rows[0].count,1);await assert.rejects(save(2),/Editor access/);
 await db.exec('reset role;set role anon');await assert.rejects(start(1),/permission denied/);
 }finally{await db.close();}
});
