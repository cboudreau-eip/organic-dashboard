export const TIMEZONE = 'America/New_York';
export const METRICS = [
  ['visitors', 'Visitors', 'count'], ['views', 'Page views', 'count'],
  ['sessions', 'Sessions', 'count'], ['session duration', 'Session duration', 'duration'],
  ['bounce rate', 'Bounce rate', 'percent'],
];
const shift = (date, days) => new Date(Date.parse(date + 'T12:00:00Z') + days * 86400000).toISOString().slice(0, 10);
export function overviewPeriod(days = 7, now = new Date()) {
  if (![7, 28, 30].includes(days)) throw new Error('Choose 7, 28, or 30 days.');
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
  return { start: shift(today, -days), end: shift(today, -1), priorStart: shift(today, -2 * days), priorEnd: shift(today, -days - 1) };
}
export function overviewQuery(period) {
  return {
    kind: 'WebOverviewQuery',
    dateRange: { date_from: period.start, date_to: period.end },
    compareFilter: { compare: true },
    properties: [
      { key: '$channel_type', type: 'session', operator: 'exact', value: ['Organic Search'] },
      { key: '$host', type: 'event', operator: 'exact', value: ['www.medicarefaq.com', 'medicarefaq.com'] },
    ],
  };
}
export function parseOverview(response) {
  if (response.error || !Array.isArray(response.results)) throw new Error('PostHog returned an incomplete overview.');
  return METRICS.map(([key, label, format]) => {
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
