import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
test('validation storage enforces team roles, immutable results, valid assignments and version conflicts',async()=>{
 const db=new PGlite();try{
 await db.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);insert into auth.users values ('11111111-1111-4111-8111-111111111111');create function auth.uid() returns uuid language sql stable as $$select '11111111-1111-4111-8111-111111111111'::uuid$$;create function public.growth_access() returns text language sql stable as $$select current_setting('test.access',true)$$;grant usage on schema auth,public to authenticated;`);
 for(const file of ['20261113145339_research_opportunities.sql','20261113151509_research_evidence_chunks.sql','20261113174628_research_validation_assignments.sql'])await db.exec(await readFile('supabase/migrations/'+file,'utf8'));
 await db.exec("set role authenticated;set test.access='analyst'");
 const source='22222222-2222-4222-8222-222222222222',id='33333333-3333-4333-8333-333333333333',key='a'.repeat(24);
 await db.query("insert into research_runs(id,settings,payload) values ($1,'{}','{}')",[source]);
 await assert.rejects(db.query("insert into research_validations(research_run_id,rules_version,payload) values ($1,'v1','{}')",[source]));
 await db.query("update research_runs set status='complete',stage='complete' where id=$1",[source]);
 await db.query("insert into research_validations(id,research_run_id,rules_version,payload) values ($1,$2,'v1','{}')",[id,source]);
 await assert.rejects(db.query("insert into research_validations(research_run_id,rules_version,payload) values ($1,'v1','{}')",[source]));
 const payload=JSON.stringify({assignments:[{key,result:{readiness:'Needs research'}}]});
 await db.query("update research_validations set payload=$1,status='complete' where id=$2 and version=1",[payload,id]);
 assert.equal((await db.query('select version from research_validations')).rows[0].version,2);
 await assert.rejects(db.query("update research_validations set payload='{}' where id=$1",[id]));
 await assert.rejects(db.query("insert into research_assignment_reviews(validation_id,assignment_key,decision) values ($1,$2,'Keep')",[id,key]));
 await db.query("insert into research_assignment_reviews(validation_id,assignment_key,decision) values ($1,$2,'Defer')",[id,key]);
 await db.exec("update research_assignment_reviews set reason='Review source' where version=1");assert.equal((await db.exec("update research_assignment_reviews set reason='stale edit' where version=1 returning *"))[0].rows.length,0);
 await db.exec("set test.access='viewer'");assert.equal((await db.query('select * from research_validations')).rows.length,1);assert.equal((await db.exec("update research_assignment_reviews set decision='Reject' returning *"))[0].rows.length,0);
 await assert.rejects(db.query("insert into research_validations(research_run_id,rules_version,payload) values ($1,'v2','{}')",[source]));
 await db.exec("set test.access='outsider'");assert.equal((await db.query('select * from research_validations')).rows.length,0);
 await db.exec('reset role;set role anon');await assert.rejects(db.query('select * from research_validations'));
 }finally{await db.close();}
});
