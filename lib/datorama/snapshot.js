import 'server-only';
import { gunzipSync } from 'node:zlib';

// Keep business data out of the public repository and browser bundles.
export function datoramaSnapshot() {
  const value = process.env.DATORAMA_SNAPSHOT_GZIP;
  if (!value) return null;
  const data = JSON.parse(gunzipSync(Buffer.from(value, 'base64'), { maxOutputLength: 2_000_000 }).toString('utf8'));
  if (!data.period?.start || !Array.isArray(data.sheets) || !data.sheets.length) throw new Error('Invalid Datorama snapshot');
  if (data.scopeId !== 'medicarefaq-production' || data.sheets.some(sheet => sheet.rows.some(row => {
    try { return !['www.medicarefaq.com', 'medicarefaq.com'].includes(new URL(row[0]).hostname); }
    catch { return true; }
  }))) throw new Error('Unverified website scope');
  return data;
}
