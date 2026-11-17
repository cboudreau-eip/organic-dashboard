import {generateCalendar} from '../lib/research/demo-calendar.js';
import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {PGlite} from '@electric-sql/pglite';
test('repair and undo atomically preserve slots, manual edits, dates, history and later changes',async()=>{
 const db=new PGlite();try{
 await db.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);insert into auth.users values ('11111111-1111-4111-8111-111111111111');create function auth.uid() returns uuid language sql stable as $$select '11111111-1111-4111-8111-111111111111'::uuid$$;create function public.growth_access() returns text language sql stable as $$select current_setting('test.access',true)$$;grant usage on schema auth,public to authenticated;create table research_runs(id uuid primary key,status text);insert into research_runs values ('22222222-2222-4222-8222-222222222222','complete');grant select on research_runs to authenticated;`);
 for(const n of ['20261114122708_proposed_content_plans','20261114124401_tentative_demo_calendar','20261117122622_repair_calendar_history','20261117134821_linked_calendar_undo','20261117143540_calendar_evidence_history_capacity'])await db.exec(await readFile('supabase/migrations/'+n+'.sql','utf8'));
 await db.exec("set role authenticated;set test.access='analyst'");
 const items=Array.from({length:90},(_,n)=>({id:'slot'+n,title:'Before '+n,action:'Original task',category:'Evergreen'}));const calendar=generateCalendar(items);calendar.locked=['slot1'];const p=(await db.query("insert into proposed_content_plans(research_run_id,payload,edits,calendar) values ('22222222-2222-4222-8222-222222222222',$1,$2,$3) returning *",[JSON.stringify({items}),JSON.stringify({slot0:{title:'Manual'}}),JSON.stringify(calendar)])).rows[0];
 const changes=[1,2].map(n=>({id:'slot'+n,item:{...items[n],title:'After '+n,targetDecision:{kind:'Existing-page update',checks:[{url:'https://www.medicarefaq.com/example',status:'read'}]}},reason:'Verified evidence'}));
 const call=(plan,cs=changes,undo=null)=>db.query('select * from public.repair_calendar_plan($1,$2,$3,$4)',[plan.id,plan.version,JSON.stringify(cs),undo]);
 await assert.rejects(call({...p,version:0}),/Plan changed/);await assert.rejects(call(p,[{...changes[0],id:'slot0',item:{...items[0],title:'bad'}}]),/Manually edited/);
 const repaired=(await call(p)).rows[0];assert.notEqual(repaired.id,p.id);assert.deepEqual(repaired.edits,p.edits);assert.deepEqual(repaired.calendar,p.calendar);assert.equal(repaired.payload.repairHistory[0].changes[0].before.title,'Before 1');assert.deepEqual((await db.query('select payload from proposed_content_plans where id=$1',[p.id])).rows[0].payload,{items});
 const edited=(await db.query('update proposed_content_plans set edits=$2 where id=$1 returning *',[repaired.id,JSON.stringify({...p.edits,slot1:{action:'My later work'}})])).rows[0];
 const undone=(await call(edited,[],repaired.payload.repairHistory[0].id)).rows[0];assert.equal(undone.payload.items[1].title,'After 1');assert.equal(undone.payload.items[2].title,'Before 2');assert.equal(undone.payload.items[2].targetDecision,undefined);assert.equal(repaired.payload.repairHistory[0].changes[0].after.targetDecision.kind,'Existing-page update');assert.deepEqual(undone.edits,edited.edits);assert.deepEqual(undone.calendar,edited.calendar);assert.equal(undone.payload.repairHistory[0].restored,1);assert.deepEqual(undone.payload.repairHistory[0].protected,['slot1']);
 await assert.rejects(call(undone,[],repaired.payload.repairHistory[0].id),/already undone/);
 const linkedChanges=[1,2,3].map(n=>({id:'slot'+n,item:{...items[n],title:'Linked '+n},reason:'Evidence',evidence:n<3?{undoGroup:'pair'}:{}}));
 const linked=(await call(p,linkedChanges)).rows[0];
 const cleanUndo=(await call(linked,[],linked.payload.repairHistory[0].id)).rows[0];
 assert.equal(cleanUndo.payload.repairHistory[0].restored,3);
 const protectedLinked=(await db.query('update proposed_content_plans set edits=$2 where id=$1 returning *',[linked.id,JSON.stringify({...p.edits,slot1:{title:'Later edit'}})])).rows[0];
 const groupedUndo=(await call(protectedLinked,[],linked.payload.repairHistory[0].id)).rows[0];
 assert.equal(groupedUndo.payload.items[1].title,'Linked 1');assert.equal(groupedUndo.payload.items[2].title,'Linked 2');assert.equal(groupedUndo.payload.items[3].title,'Before 3');assert.deepEqual(groupedUndo.payload.repairHistory[0].protected,['slot1','slot2']);
 const retained=(await db.query("insert into proposed_content_plans(research_run_id,payload) values ('22222222-2222-4222-8222-222222222222',$1) returning id",[JSON.stringify({items,evidence:'x'.repeat(1600000)})])).rows[0];assert.ok(retained.id);
 await assert.rejects(db.query("insert into proposed_content_plans(research_run_id,payload) values ('22222222-2222-4222-8222-222222222222',$1)",[JSON.stringify({items,evidence:'x'.repeat(3000000)})]),/check constraint/);
 await assert.rejects(db.query("insert into proposed_content_plans(research_run_id,payload) values ('22222222-2222-4222-8222-222222222222',$1)",[JSON.stringify({items:[...items,{id:'extra'}]})]),/check constraint/);
 await db.exec("set test.access='viewer'");await assert.rejects(call(p),/Editor access/);await db.exec('reset role;set role anon');await assert.rejects(call(p),/permission denied/);
 }finally{await db.close();}
});
