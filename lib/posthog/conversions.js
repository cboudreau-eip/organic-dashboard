// Custom session cohort: cross-domain contact steps cannot use the overview's event-host filter.
const nextDay = date => new Date(Date.parse(date) + 86400000).toISOString().slice(0, 10);
function sessionRows(start, end) {
  if (![start, end].every(d => /^\d{4}-\d{2}-\d{2}$/.test(d))) throw new Error('Invalid reporting dates.');
  const from = `toDateTime('${start} 00:00:00', 'America/New_York')`;
  const to = `toDateTime('${nextDay(end)} 00:00:00', 'America/New_York')`;
  return `SELECT $session_id AS sid, any(session.$entry_pathname) AS landing,
    countIf(event = '$pageview' AND properties.$host IN ('www.medicarefaq.com','medicarefaq.com')) AS views,
    minIf(timestamp, event = '$pageview' AND properties.$host IN ('www.medicarefaq.com','medicarefaq.com')) AS first_view,
    countIf(event = 'form_submitted' AND properties.funnel_step = 'step_1_zip') AS zip_events,
    minIf(timestamp, event = 'form_submitted' AND properties.funnel_step = 'step_1_zip') AS first_zip,
    countIf(event = 'form_submitted' AND properties.funnel_step = 'step_3_contact' AND properties.$host = 'demographics.medicarecompared.com') AS contact_events,
    maxIf(timestamp, event = 'form_submitted' AND properties.funnel_step = 'step_3_contact' AND properties.$host = 'demographics.medicarecompared.com') AS last_contact,
    countIf(event = 'phone_number_clicked') AS phone_events
    FROM events
    WHERE timestamp >= ${from} AND timestamp < ${to}
      AND session.$start_timestamp >= ${from} AND session.$start_timestamp < ${to}
      AND session.$channel_type = 'Organic Search'
      AND session.$entry_hostname IN ('www.medicarefaq.com','medicarefaq.com')
      AND properties.$host IN ('www.medicarefaq.com','medicarefaq.com','rates.medicarefaq.com','demographics.medicarecompared.com')
      AND event IN ('$pageview','form_submitted','phone_number_clicked')
      AND $session_id IS NOT NULL AND $session_id != ''
    GROUP BY sid HAVING views > 0`;
}
const metrics = `count() AS sessions,
  countIf(zip_events > 0 AND first_zip >= first_view) AS quote_starts,
  countIf(contact_events > 0 AND last_contact >= first_view) AS contact_sessions,
  countIf(zip_events > 0 AND contact_events > 0 AND first_zip >= first_view AND last_contact >= first_zip) AS completed_funnel,
  countIf(phone_events > 0) AS phone_sessions,
  sum(phone_events) AS phone_clicks, sum(contact_events) AS total_contact_events`;
export function conversionQueries(period) {
  const current = sessionRows(period.start, period.end);
  return [
    { kind: 'HogQLQuery', query: `SELECT ${metrics} FROM (${current})` },
    { kind: 'HogQLQuery', query: `SELECT ${metrics} FROM (${sessionRows(period.priorStart, period.priorEnd)})` },
    { kind: 'HogQLQuery', query: `SELECT landing, ${metrics} FROM (${current}) GROUP BY landing ORDER BY contact_sessions DESC, sessions DESC, landing ASC LIMIT 10` },
  ];
}
export const CONVERSION_KEYS = ['sessions','quoteStarts','contactSessions','completedFunnel','phoneSessions','phoneClicks','contactEvents'];
function counts(row) {
  if (!Array.isArray(row) || row.length !== CONVERSION_KEYS.length || !row.every(n => Number.isSafeInteger(n) && n >= 0)) throw new Error('Conversion data is incomplete. Please try again.');
  const r = Object.fromEntries(CONVERSION_KEYS.map((key,i) => [key,row[i]]));
  if (r.contactSessions > r.sessions || r.quoteStarts > r.sessions || r.phoneSessions > r.sessions || r.completedFunnel > Math.min(r.contactSessions,r.quoteStarts) || r.contactEvents < r.contactSessions || r.phoneClicks < r.phoneSessions) throw new Error('Conversion counts could not be validated.');
  return { ...r, rate: r.sessions ? r.contactSessions / r.sessions * 100 : null };
}
export function parseConversions(current, previous, pages) {
  if ([current,previous,pages].some(r => r.error || !Array.isArray(r.results))) throw new Error('Conversion data is unavailable. Please try again.');
  return { current: counts(current.results[0]), previous: counts(previous.results[0]), pages: pages.results.map(row => {
    if (row[0] !== null && typeof row[0] !== 'string') throw new Error('Invalid landing page.');
    return { page: row[0] || '(Unknown landing page)', ...counts(row.slice(1)) };
  }) };
}

