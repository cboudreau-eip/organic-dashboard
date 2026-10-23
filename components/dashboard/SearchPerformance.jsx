'use client';
import CollapsibleSection from './CollapsibleSection';
import GscComparisonTable from './GscComparisonTable';
import GscDateControls from './GscDateControls';
import { trendRows } from '../../lib/gsc/dates';
import { useEffect, useState } from 'react';
import { changeLabel, displayMetric } from '../../lib/gsc/report';

const metrics = [['clicks', 'Clicks'], ['impressions', 'Impressions'], ['ctr', 'Click-through rate'], ['position', 'Average position']];
function Trend({result}) {
  const rows=trendRows(result);
  const max=Math.max(1,...rows.flatMap(row=>[row.current??0,row.previous??0]));
  const x=i=>45+i*710/Math.max(1,rows.length-1);
  const points=key=>rows.flatMap((row,i)=>row[key]==null?[]:[x(i)+','+(190-row[key]/max*160)]).join(' ');
  return <CollapsibleSection className="card gsc-trend" title="Daily Google search clicks" level={3} header={<h3>Daily Google search clicks</h3>}>
    <p>Solid: selected period · Dashed: comparison period. Aligned by day number, not weekday. Extra days in a longer period have no matching comparison day.</p>
    <svg viewBox="0 0 800 225" role="img" aria-label="Daily clicks aligned by day number; exact dates and values in the table below">
      <line x1="45" y1="190" x2="755" y2="190" stroke="#b5c7bd"/><text x="10" y="194">0</text><text x="5" y="30">{max}</text>
      <polyline points={points('previous')} fill="none" stroke="#77877d" strokeWidth="2" strokeDasharray="6 5"/>
      <polyline points={points('current')} fill="none" stroke="#206647" strokeWidth="3"/>
      {rows.length===1&&<><circle cx="45" cy={190-(rows[0].previous??0)/max*160} r="5" fill="#77877d"/><circle cx="45" cy={190-(rows[0].current??0)/max*160} r="3" fill="#206647"/></>}
      <text x="45" y="217">Day 1</text>{rows.length>1&&<text x="755" y="217" textAnchor="end">Day {rows.length}</text>}
    </svg>
    <details><summary>View daily click values</summary><div className="organic-table-scroll"><table><thead><tr><th>Day</th><th>Date</th><th>Clicks</th><th>Comparison date</th><th>Comparison clicks</th></tr></thead><tbody>{rows.map(row=><tr key={row.day}><td>{row.day}</td><td>{row.date||'No matching day'}</td><td>{row.current?.toLocaleString()??'N/A'}</td><td>{row.previousDate||'No matching day'}</td><td>{row.previous?.toLocaleString()??'N/A'}</td></tr>)}</tbody></table></div></details>
  </CollapsibleSection>;
}
export default function SearchPerformance() {
  const [selection, setSelection] = useState({mode:'rolling',days:28,compare:'previous'});
  const [latest,setLatest] = useState(null);
  const requestKey = new URLSearchParams(selection).toString();
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    setResult(null); setError('');
    (async () => {
      try {
        const response = await fetch(`/api/analytics/search?${requestKey}`, { signal: controller.signal, cache: 'no-store' });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Search performance unavailable.');
        if (!controller.signal.aborted) { setResult(data); setLatest(data.availableThrough); }
      } catch (e) { if (!controller.signal.aborted) setError(e.message); }
    })();
    return () => controller.abort();
  }, [requestKey, attempt]);
  return <CollapsibleSection className="organic-live gsc-performance" aria-labelledby="gsc-title" title="MedicareFAQ search performance" level={2} header={<div className="organic-heading"><div><span className="organic-badge">GOOGLE SEARCH CONSOLE · FINALIZED DATA</span><h2 id="gsc-title">MedicareFAQ search performance</h2><p>Google organic web search · www.medicarefaq.com · All countries and devices</p></div></div>}>
    <GscDateControls selection={selection} latest={latest} onApply={next=>{setResult(null);setSelection(next);setAttempt(n=>n+1);}} />
    <p className="organic-period" role="status">{result ? `${result.period.start} – ${result.period.end} vs ${result.period.priorStart} – ${result.period.priorEnd} · Pacific time` : error ? 'Live search data unavailable' : 'Loading Google search performance…'}</p>
    {result?.period.warnings?.map(warning=><p className="gsc-date-warning" key={warning}>{warning}</p>)}
    {error && <div className="organic-error" role="alert">{error} <button className="button" onClick={() => setAttempt(attempt + 1)}>Try again</button></div>}
    <div className="organic-cards gsc-cards overview-kpis" aria-busy={!result && !error}>{metrics.map(([key, label]) => {
      const current = result?.current[key], previous = result?.previous[key];
      const comparable = current != null && previous != null;
      const delta = comparable ? current - previous : null;
      const improvement = key === 'position' ? -delta : delta;
      const tone = !comparable || delta === 0 ? 'neutral' : improvement > 0 ? 'positive' : 'negative';
      const change = result ? changeLabel(current, previous, key).replace(' positions (lower is better)', ' positions') : error ? 'Unavailable' : 'Loading…';
      const note = key === 'position' ? 'Lower average position is better' : key === 'ctr' ? 'Change in percentage points (pp)' : comparable ? (delta > 0 ? '+' : '') + displayMetric(delta, key) + ' ' + label.toLowerCase() + ' vs. prior' : 'Selected comparison period';
      return <article className="card overview-kpi" data-tone={tone} key={key}>
        <span className="overview-kpi-label">{label}</span>
        <strong className="overview-kpi-value">{result ? displayMetric(current, key) : '—'}</strong>
        <div className="overview-kpi-change">
          <span className="overview-kpi-badge"><span aria-hidden="true">{!comparable || delta === 0 ? '–' : delta > 0 ? '↗' : '↘'}</span><span>{change}</span></span>
          <span className="overview-kpi-delta">{note}</span>
        </div>
        <div className="overview-kpi-prior"><span>Comparison period</span><strong>{result ? displayMetric(previous, key) : '—'}</strong></div>
      </article>;
    })}</div>
    {result && <><p className="gsc-data-through"><strong>GSC data through {result.availableThrough}</strong> · Latest available finalized date</p><Trend result={result}/><GscComparisonTable key={'queries-'+requestKey} title="Search query gains and losses" dimension="Query" rows={result.comparisons.queries} coverage={result.coverage.queries} limit={result.coverage.limit} period={result.period}/><GscComparisonTable key={'pages-'+requestKey} title="Page gains and losses" dimension="Page" rows={result.comparisons.pages} coverage={result.coverage.pages} limit={result.coverage.limit} period={result.period}/></>}
    <details className="organic-definitions"><summary>About this Google data</summary><p>Clicks and impressions come from Google web search results, not website sessions. CTR is clicks divided by impressions. Average position is Google’s impression-weighted position; lower is better. Totals are requested directly from Google, not calculated from the comparison tables.</p><p>Recent-day presets end on the latest finalized date reported in the last 14 days. Calendar months and custom ranges use the dates shown above. Year-over-year compares calendar dates, with February 29 clamped to February 28 when needed; full calendar months remain full months. Google uses Pacific time and has a reporting delay. PostHog uses its own session attribution and dates, so its totals will differ. Query privacy rules and top-row limits mean table rows do not add up to the cards; page metrics also use page-level aggregation.</p><p>Results are cached for up to 15 minutes. This view uses only its own reporting-period control. Conversion tracking is separate; Ask Charlie has its own reporting-period selector.</p></details>
    {result && <p className="organic-freshness">Retrieved {new Date(result.fetchedAt).toLocaleString()} · <a href="https://search.google.com/search-console/performance/search-analytics?resource_id=https%3A%2F%2Fwww.medicarefaq.com%2F" target="_blank" rel="noreferrer">Open Search Console</a></p>}
  </CollapsibleSection>;
}
