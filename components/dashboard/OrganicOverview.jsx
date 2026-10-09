'use client';
import { useEffect, useState } from 'react';
import { METRICS, metricValue, metricChange } from '../../lib/posthog/overview';
import OrganicDetails from './OrganicDetails';

export default function OrganicOverview() {
  const [days, setDays] = useState(7);
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    setResult(null); setError('');
    (async () => {
      try {
        const response = await fetch(`/api/analytics/overview?days=${days}`, { signal: controller.signal, cache: 'no-store' });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Analytics could not be loaded.');
        if (!controller.signal.aborted) setResult(data);
      } catch (e) { if (!controller.signal.aborted) setError(e.message || 'Analytics could not be loaded.'); }
    })();
    return () => controller.abort();
  }, [days, attempt]);
  return <section className="organic-live" aria-labelledby="organic-title">
    <div className="organic-heading"><div><span className="organic-badge">POSTHOG · ORGANIC SEARCH</span><h2 id="organic-title">MedicareFAQ performance</h2><p>medicarefaq.com · All pages · All devices</p></div>
      <label>Live reporting period<select value={days} onChange={e => { setResult(null); setDays(Number(e.target.value)); }}><option value={7}>Last 7 complete days</option><option value={28}>Last 28 complete days</option><option value={30}>Last 30 complete days</option></select></label>
    </div>
    <p className="organic-period" role="status">{result ? `${result.period.start} – ${result.period.end} vs ${result.period.priorStart} – ${result.period.priorEnd} · ${result.timezone}` : error ? 'Live data unavailable' : 'Loading organic search performance…'}</p>
    {error && <div className="organic-error" role="alert">{error} <button type="button" className="button" onClick={() => setAttempt(attempt + 1)}>Try again</button></div>}
    <div className="organic-cards" aria-busy={!result && !error}>{METRICS.map(([key, label]) => {
      const metric = result?.metrics.find(item => item.key === key);
      return <article className="card" key={key}><span>{label}</span><strong>{metric ? metricValue(metric.value, metric.format) : '—'}</strong><span className="organic-change">{metric ? metricChange(metric) : error ? 'Unavailable' : 'Loading…'}</span><small>{metric ? `vs. ${metricValue(metric.previous, metric.format)} prior` : 'Previous period comparison'}</small></article>;
    })}</div>
    <OrganicDetails key={days} days={days} refresh={attempt} />
    <details className="organic-definitions"><summary>About these metrics</summary><p>Only sessions classified by PostHog as Organic Search are included, with page views on www.medicarefaq.com or medicarefaq.com. Visitors are distinct people; sessions, average session duration, and bounce rate use PostHog’s Web Analytics definitions. Project timezone and internal/test-user defaults apply. The comparison uses the immediately preceding period of equal length. Bounce-rate changes are percentage points (pp).</p><p>Results may be cached for five minutes plus PostHog’s source cache. Zero means no matching activity; a dash means unavailable. These cards use the reporting period above. Filters and charts below are still a separate sample workspace; Ask Charlie still answers from sample data.</p></details>
    {result && <p className="organic-freshness">Retrieved {new Date(result.fetchedAt).toLocaleString()} {result.sourceUpdatedAt && `· Source calculated ${new Date(result.sourceUpdatedAt).toLocaleString()}`} · <a href="https://us.posthog.com/project/452683/web" target="_blank" rel="noreferrer">Open PostHog</a></p>}
  </section>;
}
