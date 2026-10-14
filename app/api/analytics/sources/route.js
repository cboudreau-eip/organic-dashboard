import { serverAuth } from '../../../../lib/auth/server';
import { isTeamUser } from '../../../../lib/auth/config';
import { organicOverview } from '../../../../lib/posthog/server';
import { searchPerformance } from '../../../../lib/gsc/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;
const reply = (body, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } });
export async function GET(request) {
  const client = await serverAuth();
  if (!client) return reply({ error: 'Sign in to check sources.' }, 401);
  const { data, error } = await client.auth.getUser();
  if (error || !isTeamUser(data.user)) return reply({ error: 'Sign in to check sources.' }, 401);
  const params = new URL(request.url).searchParams;
  const source = params.get('source') || 'all';
  if (!['all', 'posthog', 'gsc'].includes(source)) return reply({ error: 'Unknown source.' }, 400);
  const refresh = params.get('refresh') === '1';
  const ids = source === 'all' ? ['posthog', 'gsc'] : [source];
  const sources = await Promise.all(ids.map(async id => {
    const configured = Boolean(id === 'posthog' ? process.env.POSTHOG_PERSONAL_API_KEY?.trim() : process.env.GSC_SERVICE_ACCOUNT_JSON?.trim());
    if (!configured) return { id, status: 'Not configured', checkedAt: new Date().toISOString() };
    try {
      const report = id === 'posthog' ? await organicOverview(7, false, refresh) : await searchPerformance(7, refresh);
      return { id, status: 'Connected', checkedAt: new Date().toISOString(), fetchedAt: report.fetchedAt, period: report.period, timezone: report.timezone };
    } catch {
      return { id, status: 'Unavailable', checkedAt: new Date().toISOString(), error: 'Could not retrieve a report. Retry or ask an administrator to check access.' };
    }
  }));
  return reply({ sources });
}
