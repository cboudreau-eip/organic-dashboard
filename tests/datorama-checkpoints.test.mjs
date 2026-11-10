import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
import {checkpointRows,checkpointHistory,createCheckpointHandler} from '../lib/datorama/checkpoints.js';
const keys=['allLeads','filteredLeads','soldLeads','eipLeads','grossMS','grossMA','approvedMS','approvedMA','opportunities'];
function fixture(){
 const rows=Array.from({length:31},(_,i)=>({date:`2026-08-${String(i+1).padStart(2,'0')}`,values:Object.fromEntries(keys.map(k=>[k,1]))}));
 return {version:2,scopeId:'medicarefaq-production',period:{start:'2026-08-01',end:'2026-08-31'},leadDataThrough:'2026-08-31',exportedAt:'2026-09-02T12:00:00Z',rows,metrics:keys.map(key=>({key,label:key})),totals:Object.fromEntries(keys.map(k=>[k,31]))};
}
test('checkpoint identity deduplicates identical exports and preserves corrections and newer exports',()=>{
 const d=fixture(),a=checkpointRows(d)[0];assert.equal(a.report.metrics.opportunities.total,31);
 assert.equal(checkpointRows(structuredClone(d))[0].id,a.id);
 d.rows[0].values.opportunities=3;d.totals.opportunities+=2;
 const correction=checkpointRows(d)[0];assert.notEqual(correction.id,a.id);
 assert.equal(checkpointHistory([correction,a])[0].metrics.opportunities.delta,null);
 d.exportedAt='2026-10-02T12:00:00Z';const next=checkpointRows(d)[0];
 assert.equal(checkpointHistory([next,a])[0].metrics.opportunities.delta,2);
 assert.equal(a.report.metrics.opportunities.total,31);
 d.scopeId='other';assert.throws(()=>checkpointRows(d));
});
test('missing data and partial or different cohort ranges never yield false changes',()=>{
 const d=fixture(),old=checkpointRows(d)[0];d.exportedAt='2026-10-02T12:00:00Z';
 d.rows[0].values.opportunities=null;d.totals.opportunities--;
 const next=checkpointRows(d)[0];assert.equal(next.report.metrics.opportunities.missingDays,1);
 assert.equal(checkpointHistory([next,old])[0].metrics.opportunities.delta,null);
 next.report.partial=true;assert.equal(checkpointHistory([next,old])[0].metrics.eipLeads.delta,null);
 next.report.partial=false;next.report.start='2026-08-02';assert.equal(checkpointHistory([next,old])[0].metrics.eipLeads.delta,null);
 d.version=1;d.metrics.pop();for(const r of d.rows)delete r.values.opportunities;
 assert.equal(checkpointRows(d)[0].report.metrics.opportunities.total,null);
});
test('history API authorizes before saving, validates dates, retains old history after save failures',async()=>{
 let writes=0;const req=m=>new Request('https://test/api?month='+m);
 const handler=createCheckpointHandler({authorize:()=>false,save:()=>writes++,read:()=>[]});
 assert.equal((await handler(req('2026-08'))).status,401);assert.equal(writes,0);
 const allowed=createCheckpointHandler({authorize:()=>true,save:()=>{throw Error('private secret');},read:()=>checkpointRows(fixture())});
 assert.equal((await allowed(req('2026-13'))).status,400);
 const r=await allowed(req('2026-08')),body=await r.json();assert.equal(r.status,200);assert.ok(body.saveError);assert.equal(body.checkpoints.length,1);assert.ok(!JSON.stringify(body).includes('private secret'));
 assert.equal(r.headers.get('cache-control'),'private, no-store');
});
test('database deduplicates writes and denies browser reads and history updates',async()=>{
 const db=new PGlite();try{
  await db.exec('create role anon; create role authenticated; create role service_role bypassrls;');
  await db.exec(readFileSync('supabase/migrations/20261110172037_datorama_cohort_checkpoints.sql','utf8'));
  const r=checkpointRows(fixture())[0];
  await db.exec('set role service_role');
  const sql='insert into public.datorama_cohort_checkpoints (id,source_hash,scope_id,cohort_month,source_exported_at,lead_data_through,report) values ($1,$2,$3,$4,$5,$6,$7) on conflict(id) do nothing';
  const params=[r.id,r.source_hash,r.scope_id,r.cohort_month,r.source_exported_at,r.lead_data_through,JSON.stringify(r.report)];
  await db.query(sql,params);await db.query(sql,params);
  assert.equal((await db.query('select count(*)::int as n from public.datorama_cohort_checkpoints')).rows[0].n,1);
  await assert.rejects(db.exec("update public.datorama_cohort_checkpoints set report='{}'"));
  for(const role of ['anon','authenticated']){await db.exec('reset role; set role '+role);await assert.rejects(db.exec('select * from public.datorama_cohort_checkpoints'));}
 }finally{await db.close();}
});
