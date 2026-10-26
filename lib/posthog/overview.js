import {reportingPeriod} from './period.js';
export const TIMEZONE = 'America/New_York';
export const TRAFFIC_SCOPE = 'GTM/CDN PostHog stream only ($sdk_dist_channel = cdn). Website/npm events are excluded from traffic reporting. Engagement is calculated separately from CDN events with explicit measured-session coverage.';
export const METRICS = [
  ['visitors', 'Visitors', 'count'], ['views', 'Page views', 'count'],
  ['sessions', 'Sessions', 'count'], ['session duration', 'Session duration', 'duration'],
  ['single-page session rate', 'Single-page session rate', 'percent'],
];
const shift = (date, days) => new Date(Date.parse(date + 'T12:00:00Z') + days * 86400000).toISOString().slice(0, 10);
export function overviewPeriod(days = 7, now = new Date()) {
  if (days && typeof days === 'object') return reportingPeriod(days, now);
  if (![7, 28, 30].includes(days)) throw new Error('Choose 7, 28, or 30 days.');
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
  return { start: shift(today, -days), end: shift(today, -1), priorStart: shift(today, -2 * days), priorEnd: shift(today, -days - 1) };
}
export function overviewQuery(period) {
  return {
    kind: 'WebOverviewQuery',
    dateRange: { date_from: period.start, date_to: period.granularity==='hour'?new Date(Date.parse(period.end)-1).toISOString():period.end },
    compareFilter: { compare: true },
    properties: [
      { key: '$channel_type', type: 'session', operator: 'exact', value: ['Organic Search'] },
      { key: '$host', type: 'event', operator: 'exact', value: ['www.medicarefaq.com', 'medicarefaq.com'] },
      { key: '$sdk_dist_channel', type: 'event', operator: 'exact', value: ['cdn'] },
    ],
  };
}
export function parseOverview(response) {
  if (response.error || !Array.isArray(response.results)) throw new Error('PostHog returned an incomplete overview.');
  return METRICS.map(([key, label, format]) => {
    // Native session aggregates can include both SDKs even with an event filter.
    // Never present those values as corrected single-stream metrics.
    if (['session duration', 'single-page session rate'].includes(key)) return { key, label, format, value: null, previous: null, unavailableReason: 'Awaiting single-stream validation' };
    const row = response.results.find(item => item.key === key);
    if (!row || !['value', 'previous'].every(field => row[field] === null || (typeof row[field] === 'number' && Number.isFinite(row[field]) && row[field] >= 0))) throw new Error('PostHog returned an incomplete overview.');
    return { key, label, format, value: row.value, previous: row.previous };
  });
}
export function metricValue(value, format) {
  if (value === null) return '—';
  if (format === 'percent') return value.toFixed(1) + '%';
  if (format === 'duration') { const seconds = Math.round(value); return `${Math.floor(seconds / 60)}m ${seconds % 60}s`; }
  return Math.round(value).toLocaleString('en-US');
}
export function metricChange({ value, previous, format }) {
  if (value === null || previous === null) return 'Comparison unavailable';
  if (format === 'percent') { const delta = value - previous; return `${delta > 0 ? '+' : ''}${delta.toFixed(1)} pp`; }
  if (previous === 0) return value === 0 ? 'No change' : 'No prior baseline';
  const delta = (value - previous) / previous * 100;
  return `${delta > 0 ? '+' : ''}${delta.toFixed(1)}%`;
}

export function explicitOverviewQueries(period) {
 return [overviewQuery(period),overviewQuery({...period,start:period.priorStart,end:period.priorEnd})]
   .map(query=>({...query,compareFilter:{compare:false}}));
}
export function parseExplicitOverview(current,previous) {
 if([current,previous].some(r=>r.error||!Array.isArray(r.results))) throw new Error('PostHog returned an incomplete overview.');
 const keys=METRICS.filter(([, ,format])=>format==='count').map(([key])=>key);
 const results=keys.map(key=>{
   const c=current.results.find(row=>row.key===key),p=previous.results.find(row=>row.key===key);
   if(!c||!p)throw new Error('PostHog returned an incomplete overview.');
   return {key,value:c.value,previous:p.value};
 });
 return parseOverview({results});
}
