import { authorizeGrowth } from './access.js';
import { GrowthError, MAX_IMPORT_BYTES, importGscPages } from './contracts.js';

export const reply = (body, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' } });
export const errorReply = error => error instanceof GrowthError
  ? reply({ error: error.message, code: error.code }, error.status)
  : reply({ error: 'Growth Hunter could not complete the request. Please retry.', code: 'unavailable' }, 503);
export async function readBody(request, limit = MAX_IMPORT_BYTES * 2 + 1024) {
  if (!request.headers.get('content-type')?.startsWith('application/json')) throw new GrowthError('Send a JSON import request.', 415);
  // Stream limit also covers chunked requests, independent of Content-Length.
  if (Number(request.headers.get('content-length')) > limit) throw new GrowthError('Import is too large.', 413);
  const reader = request.body?.getReader();
  if (!reader) throw new GrowthError('Import body is missing.');
  const chunks = []; let size = 0;
  try {
    while (true) { const { value, done } = await reader.read(); if (done) break; size += value.byteLength; if (size > limit) { await reader.cancel(); throw new GrowthError('Import is too large.', 413); } chunks.push(value); }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size); let offset = 0; for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  try { return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)); } catch { throw new GrowthError('Import request is not valid UTF-8 JSON.'); }
}
export function createGrowthHandlers({ getClient, enabled, origin, now = () => new Date() }) {
  async function access(action) {
    // Avoid auth/network calls when rollout is disabled.
    if (!enabled()) return authorizeGrowth(null, false, action);
    return authorizeGrowth(await getClient(), true, action);
  }
  return {
    async GET(request) {
      try {
        const { client, role } = await access('read');
        const id = new URL(request.url).searchParams.get('id');
        if (id && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) throw new GrowthError('Invalid snapshot ID.');
        let query = client.from('growth_snapshots').select(id ? 'id,created_at,payload,row_count' : 'id,created_at,period_start,period_end,row_count,coverage');
        query = id ? query.eq('id', id).maybeSingle() : query.order('created_at', { ascending: false }).order('id', { ascending: false }).limit(50);
        const { data, error } = await query;
        if (error) throw new GrowthError('Saved evidence is temporarily unavailable.', 503, 'storage_unavailable');
        if (id && !data) throw new GrowthError('Snapshot not found.', 404, 'not_found');
        return reply(id ? { snapshot: data, role } : { snapshots: data, role, limit: 50 });
      } catch (error) { return errorReply(error); }
    },
    async POST(request) {
      try {
        const { client } = await access('import');
        if (request.headers.get('origin') !== new URL(origin()).origin) throw new GrowthError('Submit imports from the dashboard.', 403, 'origin_rejected');
        const body = await readBody(request);
        if (!body || Object.keys(body).some(key => !['csv', 'start', 'end', 'mode'].includes(key)) || !['preview', 'commit'].includes(body.mode)) throw new GrowthError('Choose preview or commit for the import.');
        const payload = importGscPages(body, now());
        if (body.mode === 'preview') return reply({ preview: { start: payload.start, end: payload.end, rowCount: payload.rows.length, rows: payload.rows.slice(0, 10), coverage: payload.coverage } });
        const { data, error } = await client.rpc('growth_import_snapshot', { input: payload });
        if (error) {
          if (error.code === '42501') throw new GrowthError('Import permission changed. Reload before continuing.', 403, 'forbidden');
          throw new GrowthError('The snapshot could not be saved. No successful import was confirmed.', 503, 'storage_unavailable');
        }
        return reply({ snapshot: data }, data.inserted ? 201 : 200);
      } catch (error) { return errorReply(error); }
    },
  };
}
