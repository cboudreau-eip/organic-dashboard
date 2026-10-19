// Shared, dependency-free validation. Only aggregate GSC Pages exports are accepted.
export const MAX_IMPORT_BYTES = 1_000_000;
export const MAX_ROWS = 2000;
export class GrowthError extends Error {
  constructor(message, status = 400, code = 'invalid_input') { super(message); this.status = status; this.code = code; }
}
const fail = message => { throw new GrowthError(message); };
export function validDate(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
    && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
}
export function validateWindow(start, end, now = new Date()) {
  if (!validDate(start) || !validDate(end) || start > end) fail('Choose a valid start and end date.');
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
  if (end >= today) fail('Use complete reporting dates before today in Pacific time.');
  if ((Date.parse(end) - Date.parse(start)) / 86400000 >= 366) fail('Import at most 366 days per snapshot.');
}
// RFC 4180-style quoted cells, including escaped quotes, CRLF and embedded newlines.
export function parseCsv(text) {
  if (typeof text !== 'string' || !text.trim() || new TextEncoder().encode(text).length > MAX_IMPORT_BYTES) fail('Choose a CSV file smaller than 1 MB.');
  text = text.replace(/^\uFEFF/, '');
  const records = []; let row = [], cell = '', quoted = false, closed = false;
  function pushCell() { row.push(cell); cell = ''; closed = false; }
  function pushRow() { pushCell(); if (row.some(value => value !== '')) records.push(row); row = []; if (records.length > MAX_ROWS + 1) fail(`Import at most ${MAX_ROWS} pages at a time.`); }
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else { quoted = false; closed = true; } }
      else cell += ch;
    } else if (ch === ',') pushCell();
    else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; pushRow(); }
    else if (ch === '"' && cell === '' && !closed) quoted = true;
    else { if (ch === '"' || closed) fail('CSV quoting is invalid. Export the Pages table again.'); cell += ch; }
  }
  if (quoted) fail('CSV contains an unfinished quoted cell.');
  if (cell || row.length || closed) pushRow();
  return records;
}
function number(value, label, integer = false) {
  const trimmed = value.trim();
  if (!/^(?:\d+)(?:\.\d+)?$/.test(trimmed)) fail(`${label} must be a nonnegative number without separators.`);
  const n = Number(trimmed);
  if (!Number.isFinite(n) || n > Number.MAX_SAFE_INTEGER || (integer && !Number.isSafeInteger(n))) fail(`${label} is outside the supported range.`);
  return n;
}
export function importGscPages({ csv, start, end } = {}, now = new Date()) {
  validateWindow(start, end, now);
  const records = parseCsv(csv);
  const headers = records.shift()?.map(value => value.trim().toLowerCase());
  const expected = ['top pages', 'clicks', 'impressions', 'ctr', 'position'];
  if (headers?.length !== 5 || new Set(headers).size !== 5 || expected.some(key => !headers.includes(key))) fail('Use a GSC Pages CSV with exactly: Top pages, Clicks, Impressions, CTR, Position. Other exports are not supported.');
  if (!records.length) fail('The export contains no page rows.');
  const seen = new Set();
  const rows = records.map((cells, index) => {
    const label = `Row ${index + 2}`;
    if (cells.length !== 5) fail(`${label} has the wrong number of columns.`);
    const values = Object.fromEntries(headers.map((key, i) => [key, cells[i].trim()]));
    let url;
    try { url = new URL(values['top pages']); } catch { fail(`${label} has an invalid page URL.`); }
    if (url.protocol !== 'https:' || url.host !== 'www.medicarefaq.com' || url.username || url.password || url.search || url.hash || url.href.length > 2000 || /[\s\\]/.test(values['top pages'])) fail(`${label} must be a MedicareFAQ HTTPS page without credentials, query parameters or fragments.`);
    if (seen.has(url.href)) fail(`${label} duplicates an earlier page. No rows were imported.`);
    seen.add(url.href);
    const clicks = number(values.clicks, `${label} clicks`, true);
    const impressions = number(values.impressions, `${label} impressions`, true);
    if (clicks > impressions || !impressions) fail(`${label} needs positive impressions and clicks no greater than impressions.`);
    if (!values.ctr.endsWith('%')) fail(`${label} CTR must include the percent sign from the GSC export.`);
    const ctr = number(values.ctr.slice(0, -1), `${label} CTR`) / 100;
    if (ctr > 1 || Math.abs(ctr - clicks / impressions) > 0.000101) fail(`${label} CTR does not agree with clicks and impressions.`);
    const position = number(values.position, `${label} position`);
    if (position < 1) fail(`${label} position must be at least 1.`);
    return { url: url.href, clicks, impressions, ctr: clicks / impressions, position };
  }).sort((a, b) => a.url < b.url ? -1 : a.url > b.url ? 1 : 0);
  return { schemaVersion: 1, source: 'gsc', property: 'https://www.medicarefaq.com/', timezone: 'America/Los_Angeles', start, end, coverage: 'manual_pages_export_not_exhaustive', rows };
}
