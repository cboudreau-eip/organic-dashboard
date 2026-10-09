import 'server-only';
import { overviewPeriod, overviewQuery, parseOverview, TIMEZONE } from './overview';
import { detailQueries, parseTrend, parseLandingPages } from './details';

// Bounded per-process cache and in-flight deduplication. Every caller is authenticated by the route.
const cache = new Map();
export async function organicOverview(days, details = false) {
  const key = process.env.POSTHOG_PERSONAL_API_KEY?.trim();
  const host = (process.env.POSTHOG_HOST || 'https://us.posthog.com').replace(/\/$/, '');
  const project = process.env.POSTHOG_PROJECT_ID || '452683';
  if (!key) throw new Error('PostHog is not configured on this deployment. Ask an administrator to add the PostHog environment variables.');
  if (host !== 'https://us.posthog.com' || project !== '452683') throw new Error('PostHog configuration does not match the MedicareFAQ project.');
  const period = overviewPeriod(days);
  const id = `${details ? 'details' : 'overview'}:${days}:${period.end}`;
  const existing = cache.get(id);
  if (existing && existing.expires > Date.now()) return existing.promise;
  for (const [id, entry] of cache) if (entry.expires <= Date.now()) cache.delete(id);
  const promise = (async () => {
    async function queryPostHog(query) {
    let response;
    try {
      response = await fetch(`${host}/api/projects/${project}/query/`, {
        method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, name: 'Organic Dashboard — MedicareFAQ organic traffic' }),
        cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(25000),
      });
    } catch { throw new Error('PostHog could not be reached. Please try again shortly.'); }
    if (!response.ok) throw new Error(response.status === 401 || response.status === 403
      ? 'PostHog access was denied. Ask an administrator to check the API key and query permission.'
      : 'PostHog is temporarily unavailable. Please try again shortly.');
    let data;
    try { data = await response.json(); } catch { throw new Error('PostHog returned an unreadable response.'); }
    return data;
    }
    if (details) {
      const [current, previous, pages] = await Promise.all(detailQueries(period).map(queryPostHog));
      return { period, timezone: current.timezone || TIMEZONE, current: parseTrend(current, period.start, period.end),
        previous: parseTrend(previous, period.priorStart, period.priorEnd), pages: parseLandingPages(pages), fetchedAt: new Date().toISOString() };
    }
    const data = await queryPostHog(overviewQuery(period));
    return { period, timezone: data.timezone || TIMEZONE, metrics: parseOverview(data), fetchedAt: new Date().toISOString(), sourceUpdatedAt: data.last_refresh || null };
  })();
  cache.set(id, { promise, expires: Date.now() + 300000 });
  try { return await promise; } catch (error) { cache.delete(id); throw error; }
}
