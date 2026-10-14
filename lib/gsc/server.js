import 'server-only';
import { createSign } from 'node:crypto';
import { SITE, TIMEZONE, shiftDate, reportingPeriod, metricRow } from './report.js';

const cache = new Map();
const pending = new Map();
let token;
async function accessToken() {
  if (token?.expires > Date.now()) return token.value;
  const credential = JSON.parse(process.env.GSC_SERVICE_ACCOUNT_JSON || '{}');
  if (credential.type !== 'service_account' || !credential.private_key || !credential.client_email) throw new Error('GSC configuration missing');
  const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const unsigned = `${encode({ alg: 'RS256', typ: 'JWT' })}.${encode({ iss: credential.client_email, scope: 'https://www.googleapis.com/auth/webmasters.readonly', aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 })}`;
  const signature = createSign('RSA-SHA256').update(unsigned).sign(credential.private_key, 'base64url');
  const response = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${unsigned}.${signature}` }), signal: AbortSignal.timeout(20000), redirect: 'error', cache: 'no-store' });
  if (!response.ok) throw new Error('GSC authentication failed');
  const data = await response.json();
  if (!data.access_token) throw new Error('GSC authentication failed');
  token = { value: data.access_token, expires: Date.now() + 50 * 60000 };
  return token.value;
}
async function query(startDate, endDate, dimensions = [], rowLimit = 100) {
  const response = await fetch(`https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(SITE)}/searchAnalytics/query`, {
    method: 'POST', headers: { Authorization: `Bearer ${await accessToken()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ startDate, endDate, dimensions, rowLimit, type: 'web', dataState: 'final', aggregationType: dimensions.includes('page') ? 'byPage' : 'byProperty' }),
    cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(25000),
  });
  if (!response.ok) { if (response.status === 401) token = null; throw new Error('GSC query failed'); }
  const result = await response.json();
  if (result.rows !== undefined && !Array.isArray(result.rows)) throw new Error('Invalid GSC response');
  return (result.rows || []).map(row => ({ ...metricRow(row), keys: row.keys || [] }));
}
async function load(days, today) {
  const available = await query(shiftDate(today, -14), today, ['date']);
  const end = available.map(row => row.keys[0]).filter(date => /^\d{4}-\d{2}-\d{2}$/.test(date)).sort().at(-1);
  if (!end) throw new Error('No recent finalized GSC data');
  const period = reportingPeriod(end, days);
  const [current, previous, daily, queries, pages] = await Promise.all([
    query(period.start, period.end), query(period.priorStart, period.priorEnd),
    query(period.priorStart, period.end, ['date']),
    query(period.start, period.end, ['query'], 20), query(period.start, period.end, ['page'], 20),
  ]);
  return { site: SITE, timezone: TIMEZONE, period, current: current[0] || metricRow(), previous: previous[0] || metricRow(), daily: daily.sort((a, b) => a.keys[0].localeCompare(b.keys[0])), queries, pages, fetchedAt: new Date().toISOString() };
}
export async function searchPerformance(days, refresh = false) {
  if (![7, 28, 30].includes(days)) throw new Error('Invalid reporting period');
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const key = `${today}:${days}`;
  if (!refresh && cache.get(key)?.expires > Date.now()) return cache.get(key).data;
  if (pending.has(key)) return pending.get(key);
  const task = load(days, today).then(data => { if (cache.size > 6) cache.clear(); cache.set(key, { data, expires: Date.now() + 15 * 60000 }); return data; }).finally(() => pending.delete(key));
  pending.set(key, task);
  return task;
}
