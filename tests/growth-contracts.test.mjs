import test from 'node:test';
import assert from 'node:assert/strict';
import { importGscPages, parseCsv, validateWindow } from '../lib/growth-hunter/contracts.js';
import { authorizeGrowth, growthEnabled } from '../lib/growth-hunter/access.js';
import { createGrowthHandlers } from '../lib/growth-hunter/handlers.js';

const csv = 'Top pages,Clicks,Impressions,CTR,Position\r\nhttps://www.medicarefaq.com/example/,10,100,10%,5.5\r\n';
const input = { csv, start: '2026-09-01', end: '2026-09-28' };
const now = new Date('2026-10-16T20:00:00Z');
const user = { id: 'fixture-user', email: 'fixture@example.test', email_confirmed_at: '2026-01-01', is_anonymous: false };
function client(role = 'analyst') {
  return { auth: { getUser: async () => ({ data: { user } }) }, rpc: async name => name === 'growth_access' ? { data: role } : { data: { id: 'fixture-id', inserted: true, rowCount: 1 } } };
}
test('GSC import handles CSV quotes, rounds CTR from counts and preserves page grain', () => {
  assert.deepEqual(parseCsv('\uFEFFa,b\r\n"a,b","say ""yes"""'), [['a','b'],['a,b','say "yes"']]);
  const data = importGscPages(input, now);
  assert.equal(data.rows[0].ctr, 0.1);
  assert.equal(data.coverage, 'manual_pages_export_not_exhaustive');
  assert.equal(data.timezone, 'America/Los_Angeles');
  assert.equal(data.rows[0].url, 'https://www.medicarefaq.com/example/');
  assert.throws(() => parseCsv('a,b\n"bad"x,1'), /quoting/);
});
test('GSC import rejects malformed, personal, duplicated or inconsistent data atomically', () => {
  const bad = [
    csv.replace('Position', 'Email'), csv.replace('10,100,10%', '101,100,101%'),
    csv.replace('10%,', '20%,'), csv.replace('10%,', '0.1,'), csv.replace('5.5', 'NaN'),
    csv.replace('/example/', '/example/?email=someone@example.test'),
    csv.replace('www.medicarefaq.com', 'attacker.test'),
    csv.replace('www.medicarefaq.com', 'user:pass@www.medicarefaq.com'),
    csv.replace('10,100', '-1,100'), csv.replace('10,100', '1.5,100'),
    csv + 'https://www.medicarefaq.com/example/,10,100,10%,5.5\n',
    csv + 'https://www.medicarefaq.com/other/,10,100,99%,5.5\n',
  ];
  for (const value of bad) assert.throws(() => importGscPages({ ...input, csv: value }, now));
  assert.throws(() => validateWindow('2026-02-30','2026-03-01',now));
  assert.throws(() => validateWindow('2026-10-01','2026-10-16',now));
  assert.throws(() => validateWindow('2024-01-01','2026-01-01',now));
});
test('feature gate and access deny missing, unverified and unauthorized identities', async () => {
  assert.equal(growthEnabled({ GROWTH_HUNTER_ENABLED: '1' }), false);
  assert.equal(growthEnabled({ GROWTH_HUNTER_ENABLED: 'true' }), true);
  await assert.rejects(authorizeGrowth(null, false), e => e.status === 404);
  await assert.rejects(authorizeGrowth(null, true), e => e.status === 401);
  await assert.rejects(authorizeGrowth(client(null), true), e => e.status === 403);
  await assert.rejects(authorizeGrowth(client('viewer'), true, 'import'), e => e.status === 403);
  const anonymous = client(); anonymous.auth.getUser = async () => ({ data: { user: { ...user, is_anonymous: true } } });
  await assert.rejects(authorizeGrowth(anonymous, true), e => e.status === 401);
  const broken = client(); broken.rpc = async () => ({ error: { message: 'private provider detail' } });
  await assert.rejects(authorizeGrowth(broken, true), e => e.status === 503 && !e.message.includes('private provider'));
});
test('HTTP import preview writes nothing; commit revalidates and denies forged fields and cross-origin requests', async () => {
  let writes = 0;
  const c = client(); const rpc = c.rpc; c.rpc = async (name, args) => { if (name !== 'growth_access') { writes++; assert.equal(args.input.rows.length, 1); } return rpc(name); };
  const handlers = createGrowthHandlers({ getClient: async () => c, enabled: () => true, origin: () => 'https://dashboard.example.test', now: () => now });
  const request = (body, origin = 'https://dashboard.example.test') => new Request('https://dashboard.example.test/api/growth-hunter/snapshots', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: origin }, body: JSON.stringify(body) });
  assert.equal((await handlers.POST(request({ ...input, mode: 'preview' }))).status, 200);
  assert.equal(writes, 0);
  assert.equal((await handlers.POST(request({ ...input, mode: 'commit', created_by: 'attacker' }))).status, 400);
  assert.equal((await handlers.POST(request({ ...input, mode: 'commit' }, 'https://attacker.test'))).status, 403);
  assert.equal((await handlers.POST(request({ ...input, csv: csv.replace('10%,', '99%,'), mode: 'commit' }))).status, 400);
  assert.equal(writes, 0);
  assert.equal((await handlers.POST(request({ ...input, mode: 'commit' }))).status, 201);
  assert.equal(writes, 1);
  const disabled = createGrowthHandlers({ getClient: () => { throw Error('must not run'); }, enabled: () => false });
  const response = await disabled.GET(new Request('https://dashboard.example.test/api/growth-hunter/snapshots'));
  assert.equal(response.status, 404); assert.equal(response.headers.get('cache-control'), 'private, no-store');
  const large = request({ ...input, csv: 'x'.repeat(2_001_025), mode: 'commit' });
  assert.equal((await handlers.POST(large)).status, 413);
});
