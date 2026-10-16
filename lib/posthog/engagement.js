// Rebuild engagement from one SDK's events, never PostHog's mixed-stream session totals.
// A session may span midnight; scan one extra day on either side (SDK maximum: 24h).
const shift = (date, days) => new Date(Date.parse(date + 'T12:00:00Z') + days * 86400000).toISOString().slice(0, 10);
export const ENGAGEMENT_SCOPE = 'Measured engagement uses only GTM/CDN pageviews, page exits and autocaptured interactions on MedicareFAQ, grouped by PostHog session ID. Cohort: organic sessions with a CDN pageview in the selected period. Includes adjacent-day events to avoid cutting sessions at midnight. Duration is first pageview to last observed activity, only for sessions with a page exit at or after their final pageview. Bounce means exactly one pageview, no autocaptured interactions and duration under 10 seconds. Sessions without enough evidence to classify are excluded from the bounce denominator. These are custom measured-session metrics, not native PostHog session aggregates or estimates for unmeasured visits. Coverage can differ between current and prior periods.';

export function engagementQuery(start, end) {
  if (![start, end].every(d => /^\d{4}-\d{2}-\d{2}$/.test(d) && Number.isFinite(Date.parse(d))) || start > end) throw new Error('Invalid engagement period.');
  const time = d => `toDateTime('${d} 00:00:00','America/New_York')`;
  return { kind: 'HogQLQuery', query: `SELECT count() AS sessions,
    countIf(exit_covered) AS duration_sessions,
    sumIf(duration_seconds,exit_covered) AS duration_seconds_sum,
    countIf(classifiable) AS bounce_sessions,
    countIf(views=1 AND clicks=0 AND exit_covered AND duration_seconds<10) AS bounces
    FROM (SELECT *, leaves>0 AND last_leave>=last_view AS exit_covered,
      greatest(0,dateDiff('millisecond',first_view,last_activity)/1000) AS duration_seconds,
      views>1 OR clicks>0 OR duration_seconds>=10 OR exit_covered AS classifiable
      FROM (SELECT $session_id AS sid,
        countIf(event='$pageview') AS views,
        countIf(event='$pageview' AND timestamp>=${time(start)} AND timestamp<${time(shift(end, 1))}) AS period_views,
        countIf(event='$autocapture') AS clicks, countIf(event='$pageleave') AS leaves,
        minIf(timestamp,event='$pageview') AS first_view,
        maxIf(timestamp,event='$pageview') AS last_view,
        maxIf(timestamp,event='$pageleave') AS last_leave,
        max(timestamp) AS last_activity
        FROM events
        WHERE timestamp>=${time(shift(start, -1))} AND timestamp<${time(shift(end, 2))}
          AND timestamp<now()
          AND properties.$host IN ('www.medicarefaq.com','medicarefaq.com')
          AND properties.$sdk_dist_channel='cdn'
          AND session.$channel_type='Organic Search'
          AND session.$start_timestamp>=${time(shift(start, -1))}
          AND session.$start_timestamp<${time(shift(end, 1))}
          AND event IN ('$pageview','$pageleave','$autocapture')
          AND $session_id IS NOT NULL AND $session_id!=''
        GROUP BY sid HAVING period_views>0))` };
}

export function parseEngagement(response) {
  const row = response.results?.[0];
  if (response.error || response.results?.length !== 1 || !Array.isArray(row) || row.length !== 5) throw new Error('Engagement data is incomplete.');
  const [sessions, durationSessions, seconds, bounceSessions, bounces] = row;
  if (![sessions,durationSessions,bounceSessions,bounces].every(n => Number.isSafeInteger(n) && n>=0)
      || !Number.isFinite(seconds) || seconds<0 || durationSessions>sessions || bounceSessions>sessions
      || bounces>bounceSessions || bounces>durationSessions || durationSessions>bounceSessions
      || (!durationSessions && seconds!==0)) throw new Error('Engagement counts could not be validated.');
  return { sessions, durationSessions, bounceSessions, bounces,
    duration: durationSessions ? seconds/durationSessions : null,
    bounceRate: bounceSessions ? 100*bounces/bounceSessions : null };
}

export function withEngagement(metrics, current, previous) {
  return metrics.map(metric => {
    // Use the exact same cohort total as the measured-coverage cards.
    if (metric.key==='sessions') return { ...metric, value: current?.sessions ?? metric.value, previous: previous?.sessions ?? metric.previous };
    const field = metric.key==='session duration' ? 'duration' : metric.key==='bounce rate' ? 'bounceRate' : null;
    if (!field) return metric;
    const denominator = field==='duration' ? 'durationSessions' : 'bounceSessions';
    return { ...metric, value: current?.[field] ?? null, previous: previous?.[field] ?? null,
      unavailableReason: !current ? 'Engagement temporarily unavailable' : current[field]===null ? 'Insufficient measured sessions' : undefined,
      coverage: current ? { measured: current[denominator], total: current.sessions, previousMeasured: previous?.[denominator] ?? null, previousTotal: previous?.sessions ?? null } : undefined };
  });
}
