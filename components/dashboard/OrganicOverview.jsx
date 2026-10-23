'use client';
import CollapsibleSection from './CollapsibleSection';
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
  return <CollapsibleSection className="organic-live" aria-labelledby="organic-title" title="MedicareFAQ performance" level={2} header={<div className="organic-heading"><div><span className="organic-badge">POSTHOG · ORGANIC SEARCH</span><h2 id="organic-title">MedicareFAQ performance</h2><p>medicarefaq.com · All pages · All devices</p></div>
      <label>Live reporting period<select value={days} onChange={e => { setResult(null); setDays(Number(e.target.value)); }}><option value={7}>Last 7 complete days</option><option value={28}>Last 28 complete days</option><option value={30}>Last 30 complete days</option></select></label>
    </div>}>
    
    <p className="organic-period" role="status">{result ? `${result.period.start} – ${result.period.end} vs ${result.period.priorStart} – ${result.period.priorEnd} · ${result.timezone}` : error ? 'Live data unavailable' : 'Loading organic search performance…'}</p>
    {error && <div className="organic-error" role="alert">{error} <button type="button" className="button" onClick={() => setAttempt(attempt + 1)}>Try again</button></div>}
    <div className="organic-cards overview-kpis" aria-busy={!result && !error}>{METRICS.map(([key, label]) => {
      const metric = result?.metrics.find(item => item.key === key);
      const comparable=metric&&!metric.unavailableReason&&metric.value!==null&&metric.previous!==null;
      const delta=comparable?metric.value-metric.previous:null;
      const direction=delta===null||delta===0?'flat':delta>0?'up':'down';
      // Engagement direction alone does not establish a better visitor outcome.
      const tone=!comparable||delta===0?'neutral':metric.format==='count'?(delta>0?'positive':'negative'):'context';
      return <article className="card overview-kpi" data-tone={tone} key={key}>
        <span className="overview-kpi-label">{key === 'session duration' && metric?.coverage ? `Measured ${label.toLowerCase()}` : label}</span>
        <strong className="overview-kpi-value">{metric ? metricValue(metric.value, metric.format) : '—'}</strong>
        <div className="overview-kpi-change">
          <span className="overview-kpi-badge"><span aria-hidden="true">{direction==='up'?'↗':direction==='down'?'↘':'–'}</span><span>{metric?.unavailableReason || (metric ? metricChange(metric) : error ? 'Unavailable' : 'Loading…')}</span></span>
          {comparable&&metric.format==='count'&&<span className="overview-kpi-delta">{delta>0?'+':''}{Math.round(delta).toLocaleString('en-US')} {label.toLowerCase()} vs. prior</span>}
          {comparable&&metric.format!=='count'&&<span className="overview-kpi-delta">Change vs. previous period{metric.format==='percent'?' · pp = percentage points':''}</span>}
        </div>
        <div className="overview-kpi-prior"><span>Previous period</span><strong>{metric?metricValue(metric.previous,metric.format):'—'}</strong></div>
        {metric?.unavailableReason&&<small>Not included in comparisons</small>}
        {metric?.coverage && <small className="overview-kpi-coverage" title={metric.coverage.previousMeasured===null ? 'Prior period temporarily unavailable' : `Prior period: ${metric.coverage.previousMeasured.toLocaleString()} of ${metric.coverage.previousTotal.toLocaleString()} sessions measured`}>{metric.coverage.measured.toLocaleString()} of {metric.coverage.total.toLocaleString()} sessions measured</small>}
      </article>;
    })}</div>
    {result?.engagementStatus === 'partial' && <p role="status">Some engagement data could not be loaded. <button type="button" className="button" onClick={() => setAttempt(value => value + 1)}>Retry engagement</button></p>}
    <OrganicConversions key={`conversions-${days}`} days={days} />
    <OrganicDetails key={days} days={days} refresh={attempt} />
    <details className="organic-definitions"><summary>About these metrics</summary><p>Only sessions classified by PostHog as Organic Search are included, with page views on www.medicarefaq.com or medicarefaq.com. Traffic uses only the GTM/CDN PostHog stream; the duplicate website-installed stream is excluded. Visitors are distinct people and sessions are distinct PostHog sessions represented by the selected stream. Measured engagement is rebuilt from GTM/CDN events on MedicareFAQ, rather than mixed-stream session totals. Duration runs from the first pageview to last observed activity and requires a recorded exit at or after the final pageview. Single-page session rate is the share of all tracked organic sessions with exactly one recorded pageview, regardless of time spent, clicks or whether an exit was recorded. It is not bounce rate. Reloads count as additional pageviews. Duration coverage is shown separately and describes only visits with a recorded final exit. Adjacent-day events are included so midnight does not cut sessions short. Coverage may differ between comparison periods. Organic classification comes from PostHog; all dates use America/New_York. The comparison uses the immediately preceding period of equal length. Single-page session rate changes are percentage points (pp).</p><p>Results may be cached for five minutes plus PostHog’s source cache. Zero means no matching activity; a dash means unavailable. These cards use the reporting period above. Ask Charlie uses live data and its own reporting-period selector. Historical lead and policy imports appear separately in Leads & funnel.</p></details>
    {result && <p className="organic-freshness">Retrieved {new Date(result.fetchedAt).toLocaleString()} {result.sourceUpdatedAt && `· Source calculated ${new Date(result.sourceUpdatedAt).toLocaleString()}`} · <a href="https://us.posthog.com/project/452683/web" target="_blank" rel="noreferrer">Open PostHog</a></p>}
  </CollapsibleSection>;
}
