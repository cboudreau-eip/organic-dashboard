import { overviewQuery } from './overview.js';
export function detailQueries(period) {
  const { dateRange, properties } = overviewQuery(period);
  const trend = { kind: 'TrendsQuery', interval: 'day', series: [{ kind: 'EventsNode', event: '$pageview' }], properties };
  return [{ ...trend, dateRange }, { ...trend, dateRange: { date_from: period.priorStart, date_to: period.priorEnd } },
    { kind: 'WebStatsTableQuery', breakdownBy: 'InitialPage', dateRange, properties, includeHost: true, limit: 10 }];
}
const count = value => typeof value === 'number' && Number.isFinite(value) && value >= 0;
export function parseTrend(response, start, end) {
  const row = response.results?.[0];
  const length = Math.round((Date.parse(end) - Date.parse(start)) / 86400000) + 1;
  if (response.error || !row || row.days?.length !== length || row.data?.length !== length) throw new Error('Daily traffic is incomplete. Please try again.');
  return row.days.map((date, i) => {
    const expected = new Date(Date.parse(start) + i * 86400000).toISOString().slice(0, 10);
    if (date !== expected || !count(row.data[i])) throw new Error('Daily traffic is incomplete. Please try again.');
    return { date, views: row.data[i] };
  });
}
export function parseLandingPages(response) {
  if (response.error || !Array.isArray(response.results)) throw new Error('Landing pages are unavailable. Please try again.');
  return response.results.slice(0, 10).map(row => {
    if (!Array.isArray(row) || typeof row[0] !== 'string' || !count(row[1]?.[0])) throw new Error('Landing pages are incomplete. Please try again.');
    return { page: row[0] || '(Unknown landing page)', visitors: row[1][0] };
  });
}
