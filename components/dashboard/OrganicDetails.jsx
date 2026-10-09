'use client';
import { useEffect, useState } from 'react';
const number = n => n.toLocaleString('en-US');
const dateLabel = date => new Date(date + 'T12:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
export default function OrganicDetails({ days, refresh }) {
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setResult(null); setError('');
    (async () => {
      try {
        const response = await fetch(`/api/analytics/details?days=${days}`, { signal: controller.signal, cache: 'no-store' });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Traffic details could not be loaded.');
        if (!controller.signal.aborted) setResult(data);
      } catch (e) { if (!controller.signal.aborted) setError(e.message); }
    })();
    return () => controller.abort();
  }, [days, refresh, retry]);
  if (error) return <div className="organic-error" role="alert">{error} <button className="button" onClick={() => setRetry(retry + 1)}>Retry traffic details</button></div>;
  if (!result) return <p role="status">Loading organic traffic trend and landing pages…</p>;
  const max = Math.max(1, ...result.current.map(r => r.views), ...result.previous.map(r => r.views));
  const x = i => 52 + i / Math.max(1, result.current.length - 1) * 688;
  const y = v => 200 - v / max * 170;
  const points = rows => rows.map((r, i) => `${x(i)},${y(r.views)}`).join(' ');
  return <div className="organic-details">
    <section className="card organic-trend" aria-labelledby="organic-trend-title">
      <h3 id="organic-trend-title">Organic traffic trend</h3><p>Daily page views · Current period vs previous period, aligned by day</p>
      <div className="organic-legend"><span>━━ Current period</span><span>┄┄ Previous period</span></div>
      <svg viewBox="0 0 770 240" role="img" aria-label="Daily organic page views for the current and previous periods. Exact values are in the daily data table below.">
        {[0, .5, 1].map(t => <g key={t}><line x1="52" x2="740" y1={y(max * t)} y2={y(max * t)} stroke="#dce6dc"/><text x="44" y={y(max * t) + 4} textAnchor="end" fontSize="11" fill="#53675b">{number(Math.round(max * t))}</text></g>)}
        <polyline points={points(result.previous)} fill="none" stroke="#936e41" strokeWidth="2" strokeDasharray="6 5"/>
        <polyline points={points(result.current)} fill="none" stroke="#168263" strokeWidth="3"/>
        {result.current.map((row, i) => <circle key={row.date} cx={x(i)} cy={y(row.views)} r="3" fill="#168263"><title>{row.date}: {number(row.views)} page views; {result.previous[i].date}: {number(result.previous[i].views)}</title></circle>)}
        {[0, Math.floor((result.current.length - 1) / 2), result.current.length - 1].map(i => <text key={i} x={x(i)} y="226" textAnchor="middle" fontSize="11" fill="#53675b">{dateLabel(result.current[i].date)}</text>)}
      </svg>
      <details><summary>View daily values</summary><div className="organic-table-scroll"><table><thead><tr><th scope="col">Date</th><th scope="col">Page views</th><th scope="col">Prior date</th><th scope="col">Prior page views</th></tr></thead><tbody>{result.current.map((row, i) => <tr key={row.date}><td>{row.date}</td><td>{number(row.views)}</td><td>{result.previous[i].date}</td><td>{number(result.previous[i].views)}</td></tr>)}</tbody></table></div></details>
    </section>
    <section className="card organic-landing" aria-labelledby="organic-pages-title"><h3 id="organic-pages-title">Top organic landing pages</h3><p>Top 10 by visitors · First page of the session</p>
      {result.pages.length ? <div className="organic-table-scroll"><table><thead><tr><th scope="col">Landing page</th><th scope="col">Visitors</th></tr></thead><tbody>{result.pages.map((row, i) => <tr key={`${row.page}:${i}`}><td>{row.page.replace(/^www\.medicarefaq\.com/, '')}</td><td>{number(row.visitors)}</td></tr>)}</tbody></table></div> : <p>No organic landing pages in this period.</p>}
      <p className="organic-detail-note">Visitors can enter through different pages in separate sessions, so row counts should not be added to obtain total visitors.</p>
    </section>
    <p className="organic-detail-note">Same organic search and website filters as the cards · {result.timezone} · Retrieved {new Date(result.fetchedAt).toLocaleString()}. Page views are grouped by event date; sessions spanning midnight can affect reconciliation with the overview.</p>
  </div>;
}
