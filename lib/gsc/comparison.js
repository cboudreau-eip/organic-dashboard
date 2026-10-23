export const COMPARISON_LIMIT = 2500;

// Absence from Google's returned rows is not proof of zero traffic.
export function compareRows(current, previous) {
  const now = new Map(current.map(row => [row.keys[0], row]));
  const prior = new Map(previous.map(row => [row.keys[0], row]));
  return [...new Set([...now.keys(), ...prior.keys()])].map(key => {
    const c = now.get(key), p = prior.get(key);
    const comparable = !!c && !!p;
    return {
      key, current: c ? {clicks:c.clicks, impressions:c.impressions, ctr:c.ctr, position:c.position} : null,
      previous: p ? {clicks:p.clicks, impressions:p.impressions, ctr:p.ctr, position:p.position} : null,
      clicksChange: comparable ? c.clicks - p.clicks : null,
      clicksPercent: comparable && p.clicks > 0 ? (c.clicks / p.clicks - 1) * 100 : null,
      impressionsChange: comparable ? c.impressions - p.impressions : null,
      ctrChange: comparable && c.ctr != null && p.ctr != null ? (c.ctr - p.ctr) * 100 : null,
      positionChange: comparable && c.position != null && p.position != null ? p.position - c.position : null,
    };
  });
}
export function tableValue(row, key) {
  if (key.startsWith('current.')) return row.current?.[key.slice(8)] ?? null;
  if (key.startsWith('previous.')) return row.previous?.[key.slice(9)] ?? null;
  return row[key] ?? null;
}
export function selectRows(rows, {search = '', filter = 'all', sort = 'current.clicks', direction = 'desc'} = {}) {
  const needle = search.trim().toLowerCase();
  return rows.filter(row => row.key.toLowerCase().includes(needle) &&
    (filter === 'all' || (filter === 'gainers' && row.clicksChange > 0) ||
    (filter === 'losers' && row.clicksChange < 0) ||
    (filter === 'unmatched' && (!row.current || !row.previous))))
    .sort((a,b) => {
      const x = tableValue(a,sort), y = tableValue(b,sort);
      if (x == null || y == null) return x == null && y == null ? a.key.localeCompare(b.key) : x == null ? 1 : -1;
      const order = typeof x === 'string' ? x.localeCompare(y) : x-y;
      return (direction === 'asc' ? order : -order) || a.key.localeCompare(b.key);
    });
}
export function paginateRows(rows, page, size) {
  const pages = Math.max(1,Math.ceil(rows.length/size));
  const active = Math.min(pages,Math.max(1,Math.trunc(page)||1));
  return {page:active,pages,rows:rows.slice((active-1)*size,active*size)};
}
