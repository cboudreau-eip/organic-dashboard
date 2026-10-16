import { runPostHogQuery } from './query';
import 'server-only';
import { pageQuery } from './pages';
import { overviewPeriod, overviewQuery, parseOverview, TIMEZONE, TRAFFIC_SCOPE } from './overview';
import { detailQueries, parseTrend, parseLandingPages } from './details';
import { conversionQueries, parseConversions } from './conversions';
import { engagementQuery, parseEngagement, withEngagement, ENGAGEMENT_SCOPE } from './engagement';

// Bounded per-process cache and in-flight deduplication. Every caller is authenticated by the route.
const cache = new Map();
export async function organicOverview(days, details = false, refresh = false) {
  const key = process.env.POSTHOG_PERSONAL_API_KEY?.trim();
  const host = (process.env.POSTHOG_HOST || 'https://us.posthog.com').replace(/\/$/, '');
  const project = process.env.POSTHOG_PROJECT_ID || '452683';
  if (!key) throw new Error('PostHog is not configured on this deployment. Ask an administrator to add the PostHog environment variables.');
  if (host !== 'https://us.posthog.com' || project !== '452683') throw new Error('PostHog configuration does not match the MedicareFAQ project.');
  const period = overviewPeriod(days);
  const page = typeof details === 'object' && details?.page;
  const conversionPage = details?.conversionPage;
  const id = `${conversionPage ? `conversion-page:${conversionPage}` : page ? `page:${page}` : details === 'conversions' ? 'conversions' : details ? 'details' : 'overview'}:${days}:${period.end}`;
  const existing = cache.get(id);
  if (!refresh && existing && existing.expires > Date.now()) return existing.promise;
  for (const [id, entry] of cache) if (entry.expires <= Date.now()) cache.delete(id);
  const promise = (async () => {
    const queryPostHog = query => runPostHogQuery({ host, project, key, query });
    if (page) {
      const data = await queryPostHog(pageQuery(period, page));
      return { period, timezone: data.timezone || TIMEZONE, definitions: TRAFFIC_SCOPE, page, metrics: parseOverview(data).filter(metric => ['visitors', 'views'].includes(metric.key)), fetchedAt: new Date().toISOString() };
    }
    if (details === 'conversions' || conversionPage) {
      const responses = await Promise.all(conversionQueries(period, conversionPage).map(queryPostHog));
      return { period, timezone: TIMEZONE, ...(conversionPage ? {page:conversionPage} : {}), ...parseConversions(...responses), fetchedAt: new Date().toISOString() };
    }
    if (details) {
      const [current, previous, pages] = await Promise.all(detailQueries(period).map(queryPostHog));
      return { period, timezone: current.timezone || TIMEZONE, definitions: TRAFFIC_SCOPE, current: parseTrend(current, period.start, period.end),
        previous: parseTrend(previous, period.priorStart, period.priorEnd), pages: parseLandingPages(pages), fetchedAt: new Date().toISOString() };
    }
    const [traffic, current, previous] = await Promise.allSettled([
      queryPostHog(overviewQuery(period)),
      queryPostHog(engagementQuery(period.start, period.end)).then(parseEngagement),
      queryPostHog(engagementQuery(period.priorStart, period.priorEnd)).then(parseEngagement),
    ]);
    if (traffic.status !== 'fulfilled') throw traffic.reason;
    const data = traffic.value;
    let metrics = parseOverview(data);
    const engagementAvailable = current.status==='fulfilled' && previous.status==='fulfilled';
    metrics = withEngagement(metrics, current.status==='fulfilled' ? current.value : null, previous.status==='fulfilled' ? previous.value : null);
    return { period, timezone: data.timezone || TIMEZONE, definitions: TRAFFIC_SCOPE + ' ' + ENGAGEMENT_SCOPE, engagementStatus: engagementAvailable ? 'complete' : 'partial', metrics, fetchedAt: new Date().toISOString(), sourceUpdatedAt: data.last_refresh || null };
  })();
  if (cache.size >= 100) cache.delete(cache.keys().next().value);
  cache.set(id, { promise, expires: Date.now() + 300000 });
  try { const report = await promise; if (report.engagementStatus==='partial') cache.delete(id); return report; } catch (error) { cache.delete(id); throw error; }
}
