// Bound this process's query fan-out; other Vercel instances may still hit project limits.
export function createPostHogQueryRunner({ fetchImpl = fetch, sleep = ms => new Promise(resolve => setTimeout(resolve, ms)), concurrency = 2 } = {}) {
  let active = 0;
  const waiting = [];
  async function acquire() {
    if (active < concurrency) { active++; return; }
    await new Promise(resolve => waiting.push(resolve));
  }
  function release() {
    const next = waiting.shift();
    if (next) next(); else active--;
  }
  return async function run({ host, project, key, query }) {
    await acquire();
    try {
      for (let attempt = 0; attempt < 3; attempt++) {
        let response;
        try {
          response = await fetchImpl(`${host}/api/projects/${project}/query/`, {
            method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ query, name: 'Organic Dashboard — MedicareFAQ organic traffic' }),
            cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(25000),
          });
        } catch {
          if (attempt < 2) { await sleep(1000 * 2 ** attempt); continue; }
          throw new Error('PostHog could not be reached. Please try again shortly.');
        }
        if (!response.ok) {
          if ([429,502,503,504].includes(response.status) && attempt < 2) {
            const retryAfter = Number(response.headers.get('retry-after'));
            await sleep(Math.min(5000, Math.max(1000 * 2 ** attempt, Number.isFinite(retryAfter) ? retryAfter * 1000 : 0)));
            continue;
          }
          throw new Error(response.status===401 || response.status===403
            ? 'PostHog access was denied. Ask an administrator to check the API key and query permission.'
            : 'PostHog is temporarily unavailable. Please try again shortly.');
        }
        try { return await response.json(); }
        catch { throw new Error('PostHog returned an unreadable response.'); }
      }
    } finally { release(); }
  };
}
export const runPostHogQuery = createPostHogQueryRunner();
