import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { importGscPages } from '../lib/growth-hunter/contracts.js';

test('PostgreSQL migration enforces access, atomic validation, immutable evidence and persistence', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'growth-db-test-'));
  let db = new PGlite(directory);
  const analyst = '11111111-1111-4111-8111-111111111111';
  const viewer = '22222222-2222-4222-8222-222222222222';
  const outsider = '33333333-3333-4333-8333-333333333333';
  const asUser = async id => { await db.exec('reset role'); await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]); await db.exec('set role authenticated'); };
  const payload = importGscPages({ csv: 'Top pages,Clicks,Impressions,CTR,Position\nhttps://www.medicarefaq.com/example/,10,100,10%,5\nhttps://www.medicarefaq.com/other/,1,3,33.33%,9', start: '2026-09-01', end: '2026-09-28' }, new Date('2026-10-16T20:00:00Z'));
  const save = async data => (await db.query('select public.growth_import_snapshot($1::jsonb) as saved', [JSON.stringify(data)])).rows[0].saved;
  try {
    // Model Supabase identity roles, not its Auth network service. Production still needs a staging test.
    await db.exec(`create role anon; create role authenticated; create schema auth;
      create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      grant usage on schema public,auth to authenticated,anon;
      insert into auth.users values ('${analyst}'),('${viewer}'),('${outsider}');`);
    await db.exec(await readFile(new URL('../supabase/migrations/20261019145752_growth_foundation.sql', import.meta.url), 'utf8'));
    await db.exec(await readFile(new URL('../supabase/migrations/20261019145804_growth_declines.sql', import.meta.url), 'utf8'));
    await db.exec(await readFile(new URL('../supabase/migrations/20261019191424_growth_live_gsc.sql', import.meta.url), 'utf8'));
    await db.query("insert into public.growth_members (user_id,role) values ($1,'analyst'),($2,'viewer')", [analyst, viewer]);
    await asUser(analyst);
    await assert.rejects(save(payload), e => e.code === '42501');
    await db.exec('reset role; update public.growth_settings set enabled=true');
    await asUser(analyst);
    const first = await save(payload);
    assert.equal(first.inserted, true);
    const repeat = await save({ ...payload, rows: [...payload.rows].reverse() });
    assert.equal(repeat.id, first.id); assert.equal(repeat.inserted, false);
    // Live pair capture is atomic, idempotent and separated from manual source scope.
    await db.exec('begin');
    const apiPrior={...payload,start:'2026-08-04',end:'2026-08-31',coverage:'gsc_api_final_pages_no_parameters_not_exhaustive'};
    const apiCurrent={...payload,coverage:apiPrior.coverage};
    const analyze=async(a,b)=>(await db.query('select public.growth_analyze_gsc($1::jsonb,$2::jsonb) as saved',[JSON.stringify(a),JSON.stringify(b)])).rows[0].saved;
    await db.exec('savepoint before_bad');
    await assert.rejects(analyze(apiPrior,{...apiCurrent,rows:[{...apiCurrent.rows[0],ctr:.99}]}));
    await db.exec('rollback to before_bad');
    assert.equal((await db.query('select count(*)::int as n from public.growth_snapshots')).rows[0].n,1,'failed second import leaves no first snapshot');
    const live=await analyze(apiPrior,apiCurrent);assert.equal(live.reused,false);
    assert.equal((await analyze(apiPrior,apiCurrent)).run.id,live.run.id);
    assert.equal((await analyze(apiPrior,apiCurrent)).reused,true);
    assert.match(live.run.result.scopeConfirmation,/GSC API/);
    await db.exec('savepoint before_mixed');
    await assert.rejects(analyze(apiPrior,payload));await db.exec('rollback to before_mixed');
    await asUser(viewer);await db.exec('savepoint before_viewer');
    await assert.rejects(analyze(apiPrior,apiCurrent),e=>e.code==='42501');await db.exec('rollback to before_viewer');
    await db.exec('rollback');await asUser(analyst);
    for (const bad of [
      { ...payload, private_note: 'unexpected' },
      { ...payload, source: null },
      { ...payload, rows: [payload.rows[0], payload.rows[0]] },
      { ...payload, rows: [payload.rows[0], { ...payload.rows[1], ctr: 0.99 }] },
      { ...payload, rows: [{ ...payload.rows[0], clicks: null }] },
      { ...payload, rows: [{ ...payload.rows[0], url: 'https://attacker.test/' }] },
      { ...payload, rows: [{ ...payload.rows[0], url: 'https://www.medicarefaq.com/?secret=1' }] },
    ]) await assert.rejects(save(bad));
    assert.equal((await db.query('select count(*)::int as n from public.growth_snapshots')).rows[0].n, 1);
    await assert.rejects(db.exec('delete from public.growth_snapshots'), e => e.code === '42501');
    await assert.rejects(db.exec("update public.growth_members set role='admin'"), e => e.code === '42501');
    await assert.rejects(db.exec('update public.growth_snapshots set row_count=1'), e => e.code === '42501');
    await assert.rejects(db.exec('insert into public.growth_snapshots select * from public.growth_snapshots'), e => e.code === '42501');
    await asUser(viewer);
    assert.equal((await db.query('select id from public.growth_snapshots')).rows[0].id, first.id);
    await assert.rejects(save(payload), e => e.code === '42501');
    await asUser(outsider);
    assert.equal((await db.query('select id from public.growth_snapshots')).rows.length, 0);
    await assert.rejects(save(payload), e => e.code === '42501');
    await db.exec('reset role; set role anon');
    await assert.rejects(db.exec('select public.growth_access()'), e => e.code === '42501');
    await assert.rejects(save(payload), e => e.code === '42501');
    await db.exec('reset role');
    assert.equal((await db.query('select count(*)::int as n from public.growth_audit')).rows[0].n, 1);
    await db.close(); db = new PGlite(directory);
    await asUser(viewer);
    assert.equal((await db.query('select id from public.growth_snapshots')).rows[0].id, first.id, 'same saved evidence after database restart');
    await db.exec('reset role; update public.growth_settings set enabled=false');
    await asUser(viewer);
    assert.equal((await db.query('select id from public.growth_snapshots')).rows.length, 0, 'database rollout flag also denies direct reads');
    await db.exec('reset role; update public.growth_settings set enabled=true');
    await db.query('update public.growth_members set active=false where user_id=$1',[analyst]);
    await asUser(analyst);
    await assert.rejects(save(payload), e => e.code === '42501');
  } finally {
    await db.close();
    // Only remove the unique directory allocated by this test under the OS temp root.
    if (resolve(directory).startsWith(resolve(tmpdir()) + sep) && directory.includes('growth-db-test-')) await rm(directory, { recursive: true, force: true });
  }
});
