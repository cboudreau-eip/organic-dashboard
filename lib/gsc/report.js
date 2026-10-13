export const SITE = 'https://www.medicarefaq.com/';
export const TIMEZONE = 'America/Los_Angeles';
export function shiftDate(date, days) {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}
export function reportingPeriod(end, days) {
  if (![7, 28, 30].includes(days)) throw new Error('Invalid reporting period');
  return { start: shiftDate(end, 1 - days), end, priorStart: shiftDate(end, 1 - 2 * days), priorEnd: shiftDate(end, -days) };
}
export function metricRow(row) {
  if (!row) return { clicks: 0, impressions: 0, ctr: null, position: null };
  for (const key of ['clicks', 'impressions', 'ctr', 'position']) {
    if (!Number.isFinite(row[key]) || row[key] < 0) throw new Error('Invalid GSC response');
  }
  if (row.ctr > 1) throw new Error('Invalid GSC response');
  return { clicks: row.clicks, impressions: row.impressions, ctr: row.impressions ? row.ctr : null, position: row.impressions ? row.position : null };
}
export function displayMetric(value, key) {
  if (value == null) return '—';
  if (key === 'ctr') return `${(value * 100).toFixed(2)}%`;
  return value.toLocaleString('en-US', { maximumFractionDigits: key === 'position' ? 1 : 0 });
}
export function changeLabel(current, previous, key) {
  if (current == null || previous == null) return 'No comparison available';
  const delta = key === 'ctr' ? (current - previous) * 100 : key === 'position' ? current - previous : previous ? (current / previous - 1) * 100 : null;
  if (delta == null) return current ? 'No prior activity' : 'No change';
  return `${delta > 0 ? '+' : ''}${delta.toFixed(key === 'ctr' ? 2 : 1)}${key === 'ctr' ? ' pp' : key === 'position' ? ' positions (lower is better)' : '%'}`;
}
