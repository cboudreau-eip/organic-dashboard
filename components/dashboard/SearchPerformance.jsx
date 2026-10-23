'use client';
import CollapsibleSection from './CollapsibleSection';
import GscComparisonTable from './GscComparisonTable';
import { useEffect, useState } from 'react';
import { changeLabel, displayMetric, shiftDate } from '../../lib/gsc/report';

const metrics = [['clicks', 'Clicks'], ['impressions', 'Impressions'], ['ctr', 'Click-through rate'], ['position', 'Average position']];
function Trend({ result, days }) {
  const byDate = new Map(result.daily.map(row => [row.keys[0], row]));
  const rows = Array.from({ length: days }, (_, i) => {
    const date = shiftDate(result.period.start, i), previousDate = shiftDate(result.period.priorStart, i);
    return { date, previousDate, current: byDate.get(date)?.clicks ?? 0, previous: byDate.get(previousDate)?.clicks ?? 0 };
  });
  const max = Math.max(1, ...rows.flatMap(row => [row.current, row.previous]));
  const points = key => rows.map((row, i) => `${45 + i * 710 / (days - 1)},${190 - row[key] / max * 160}`).join(' ');
  return <CollapsibleSection className="card gsc-trend" title="Daily Google search clicks" level={3} header={<h3>Daily Google search clicks</h3>}><p>Solid: current period · Dashed: previous period, aligned by day</p><svg viewBox="0 0 800 225" role="img" aria-label="Daily clicks for current and previous periods; exact values in the table below"><line x1="45" y1="190" x2="755" y2="190" stroke="#b5c7bd"/><text x="10" y="194">0</text><text x="5" y="30">{max}</text><polyline points={points('previous')} fill="none" stroke="#77877d" strokeWidth="2" strokeDasharray="6 5"/><polyline points={points('current')} fill="none" stroke="#206647" strokeWidth="3"/><text x="45" y="217">{result.period.start}</text><text x="755" y="217" textAnchor="end">{result.period.end}</text></svg><details><summary>View daily click values</summary><div className="organic-table-scroll"><table><thead><tr><th>Date</th><th>Clicks</th><th>Previous date</th><th>Previous clicks</th></tr></thead><tbody>{rows.map(row => <tr key={row.date}><td>{row.date}</td><td>{row.current.toLocaleString()}</td><td>{row.previousDate}</td><td>{row.previous.toLocaleString()}</td></tr>)}</tbody></table></div></details></CollapsibleSection>;
}
export default function SearchPerformance() {
  const [days, setDays] = useState(28);
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    setResult(null); setError('');
    (async () => {
      try {
        const response = await fetch(`/api/analytics/search?days=${days}`, { signal: controller.signal, cache: 'no-store' });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Search performance unavailable.');
        if (!controller.signal.aborted) setResult(data);
      } catch (e) { if (!controller.signal.aborted) setError(e.message); }
    })();
    return () => controller.abort();
  }, [days, attempt]);
  return <CollapsibleSection className="organic-live gsc-performance" aria-labelledby="gsc-title" title="MedicareFAQ search performance" level={2} header={<div className="organic-heading"><div><span className="organic-badge">GOOGLE SEARCH CONSOLE · FINALIZED DATA</span><h2 id="gsc-title">MedicareFAQ search performance</h2><p>Google organic web search · www.medicarefaq.com · All countries and devices</p></div><label>Search reporting period<select value={days} onChange={e => { setResult(null); setDays(Number(e.target.value)); }}>{[7, 28, 30].map(n => <option key={n} value={n}>Last {n} finalized days</option>)}</select></label></div>}>
    <p className="organic-period" role="status">{result ? `${result.period.start} – ${result.period.end} vs ${result.period.priorStart} – ${result.period.priorEnd} · Pacific time` : error ? 'Live search data unavailable' : 'Loading Google search performance…'}</p>
    {error && <div className="organic-error" role="alert">{error} <button className="button" onClick={() => setAttempt(attempt + 1)}>Try again</button></div>}
    <div className="organic-cards gsc-cards" aria-busy={!result && !error}>{metrics.map(([key, label]) => <article className="card" key={key}><span>{label}</span><strong>{result ? displayMetric(result.current[key], key) : '—'}</strong><span className="organic-change">{result ? changeLabel(result.current[key], result.previous[key], key) : error ? 'Unavailable' : 'Loading…'}</span><small>{result ? `vs. ${displayMetric(result.previous[key], key)} prior` : 'Previous equal-length period'}</small></article>)}</div>
    {result && <><p className="gsc-data-through"><strong>GSC data through {result.period.end}</strong> · Latest available finalized date</p><Trend result={result} days={days}/><GscComparisonTable key={'queries-'+days} title="Search query gains and losses" dimension="Query" rows={result.comparisons.queries} coverage={result.coverage.queries} limit={result.coverage.limit} period={result.period}/><GscComparisonTable key={'pages-'+days} title="Page gains and losses" dimension="Page" rows={result.comparisons.pages} coverage={result.coverage.pages} limit={result.coverage.limit} period={result.period}/></>}
    <details className="organic-definitions"><summary>About this Google data</summary><p>Clicks and impressions come from Google web search results, not website sessions. CTR is clicks divided by impressions. Average position is Google’s impression-weighted position; lower is better. Totals are requested directly from Google, not calculated from the comparison tables.</p><p>The period ends on the latest date with finalized data reported in the last 14 days. Google uses Pacific time and has a reporting delay. PostHog uses its own session attribution and dates, so its totals will differ. Query privacy rules and top-row limits mean table rows do not add up to the cards; page metrics also use page-level aggregation.</p><p>Results are cached for up to 15 minutes. This view uses only its own reporting-period control. Conversion tracking is separate; Ask Charlie has its own reporting-period selector.</p></details>
    {result && <p className="organic-freshness">Retrieved {new Date(result.fetchedAt).toLocaleString()} · <a href="https://search.google.com/search-console/performance/search-analytics?resource_id=https%3A%2F%2Fwww.medicarefaq.com%2F" target="_blank" rel="noreferrer">Open Search Console</a></p>}
  </CollapsibleSection>;
}
