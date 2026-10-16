'use client';
import { useEffect, useState } from 'react';
import { METRICS, metricValue, metricChange } from '../../lib/posthog/overview';
import OrganicDetails from './OrganicDetails';
import OrganicConversions from './OrganicConversions';

export default function OrganicOverview({ days, setDays }) {
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
      return <article className="card" key={key}><span>{metric?.coverage ? `Measured ${label.toLowerCase()}` : label}</span><strong>{metric ? metricValue(metric.value, metric.format) : '—'}</strong><span className="organic-change">{metric?.unavailableReason || (metric ? metricChange(metric) : error ? 'Unavailable' : 'Loading…')}</span><small>{metric?.unavailableReason ? 'Not included in comparisons' : metric ? `vs. ${metricValue(metric.previous, metric.format)} prior` : 'Previous period comparison'}</small>{metric?.coverage && <small title={`Prior period: ${metric.coverage.previousMeasured.toLocaleString()} of ${metric.coverage.previousTotal.toLocaleString()} sessions measured`}>{metric.coverage.measured.toLocaleString()} of {metric.coverage.total.toLocaleString()} sessions measured</small>}</article>;
    })}</div>
    <OrganicConversions key={`conversions-${days}`} days={days} />
    <OrganicDetails key={days} days={days} refresh={attempt} />
    <details className="organic-definitions"><summary>About these metrics</summary><p>Only sessions classified by PostHog as Organic Search are included, with page views on www.medicarefaq.com or medicarefaq.com. Traffic uses only the GTM/CDN PostHog stream; the duplicate website-installed stream is excluded. Visitors are distinct people and sessions are distinct PostHog sessions represented by the selected stream. Measured engagement is rebuilt from GTM/CDN events on MedicareFAQ, rather than mixed-stream session totals. Duration runs from the first pageview to last observed activity and requires a recorded exit at or after the final pageview. A bounce has one pageview, no autocaptured interactions and lasts under 10 seconds. Visits without enough evidence are excluded from the bounce denominator. Coverage is shown on each card; results describe measured visits, not all visits. Adjacent-day events are included so midnight does not cut sessions short. Coverage may differ between comparison periods. Organic classification comes from PostHog; all dates use America/New_York. The comparison uses the immediately preceding period of equal length. Bounce-rate changes are percentage points (pp).</p><p>Results may be cached for five minutes plus PostHog’s source cache. Zero means no matching activity; a dash means unavailable. These cards use the reporting period above. Ask Charlie uses live data and its own reporting-period selector. Historical lead and policy imports appear separately in Leads & funnel.</p></details>
    {result && <p className="organic-freshness">Retrieved {new Date(result.fetchedAt).toLocaleString()} {result.sourceUpdatedAt && `· Source calculated ${new Date(result.sourceUpdatedAt).toLocaleString()}`} · <a href="https://us.posthog.com/project/452683/web" target="_blank" rel="noreferrer">Open PostHog</a></p>}
  </section>;
}
