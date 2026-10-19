'use client';
import { useEffect, useState } from 'react';
import DeclineResearch from './DeclineResearch';
import { readGscFile } from '../../lib/growth-hunter/files';

async function api(init, id, signal) {
  const response = await fetch('/api/growth-hunter/snapshots' + (id ? '?id=' + encodeURIComponent(id) : ''), { cache: 'no-store', ...init, signal });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Growth Hunter is unavailable.');
  return data;
}
function PageRows({ rows }) {
  return <div className="growth-table"><table><caption>Saved page evidence</caption><thead><tr><th scope="col">Page</th><th scope="col">Clicks</th><th scope="col">Impressions</th><th scope="col">CTR</th><th scope="col">Average position</th></tr></thead><tbody>{rows.map(row => <tr key={row.url}><th scope="row">{row.url.replace('https://www.medicarefaq.com', '')}</th><td>{row.clicks.toLocaleString()}</td><td>{row.impressions.toLocaleString()}</td><td>{(row.ctr * 100).toFixed(2)}%</td><td>{row.position.toFixed(2)}</td></tr>)}</tbody></table></div>;
}
export default function GrowthHunter({ active }) {
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const [reload, setReload] = useState(0);
  const [csv, setCsv] = useState('');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [preview, setPreview] = useState(null);
  const [selected, setSelected] = useState(null);
  useEffect(() => {
    if (!active) return;
    const controller = new AbortController();
    setError(''); setResult(null); setSelected(null); setPreview(null);
    api(undefined, undefined, controller.signal).then(setResult).catch(e => { if (!controller.signal.aborted) setError(e.message); });
    return () => controller.abort();
  }, [active, reload]);
  function changed(setter, value) { setter(value); setPreview(null); setStatus(''); setError(''); }
  async function fileChanged(event) {
    const file = event.target.files?.[0];
    setPreview(null); setCsv(''); setStatus(''); setError('');
    if (!file) return;
    setBusy(true);
    try { const loaded = await readGscFile(file); setCsv(loaded.csv); setStatus(loaded.message); } catch (e) { setError(e.message || 'The file could not be read.'); } finally { setBusy(false); }
  }
  async function submit(mode) {
    setBusy(true); setError(''); setStatus('');
    try {
      const data = await api({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ csv, start, end, mode }) });
      if (mode === 'preview') setPreview(data.preview);
      else { setStatus(data.snapshot.inserted ? `Saved ${data.snapshot.rowCount} pages. Evidence is now stored for the team.` : 'This exact snapshot was already saved. No duplicate was created.'); setPreview(null); setReload(value => value + 1); }
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  }
  async function inspect(id) {
    setBusy(true); setSelected(null); setError('');
    try { setSelected((await api(undefined, id)).snapshot); } catch (e) { setError(e.message); } finally { setBusy(false); }
  }
  const canImport = result && ['analyst', 'admin'].includes(result.role);
  return <section className="growth-hunter" aria-label="Growth Hunter">
    <div className="heading"><div><div className="eyebrow">GROWTH HUNTER</div><h2>Find organic growth opportunities</h2><p>Analyze connected Google Search Console data and review pages losing clicks.</p></div></div>
    <div className="growth-note">Save evidence and compare pages for click declines. Findings are investigation candidates; approval and implementation tracking are not available yet.</div>
    {error && <p role="alert" className="growth-error">{error} <button className="button" onClick={() => setReload(value => value + 1)} disabled={busy}>Reload evidence</button></p>}
    {status && <p role="status">{status}</p>}
    {!result && !error && <p role="status">Loading saved evidence…</p>}
    {active && result && <DeclineResearch snapshots={result.snapshots} canRun={canImport} onEvidenceSaved={() => api().then(setResult).catch(() => setError('Analysis saved. Reload evidence to refresh the snapshot list.'))} />}
    {canImport && <details className="growth-panel"><summary>Optional: import a saved Excel or CSV export</summary><p>Export the Pages table for the MedicareFAQ URL-prefix property, Web search, with no country, device or page filters. Enter its exact reporting dates. Only aggregate page metrics are accepted.</p>
      <form onSubmit={e => { e.preventDefault(); submit('preview'); }}><fieldset disabled={busy}><legend>Snapshot details</legend><div className="growth-fields"><label>Start date (Pacific)<input type="date" value={start} onChange={e => changed(setStart, e.target.value)} required /></label><label>End date (Pacific)<input type="date" value={end} onChange={e => changed(setEnd, e.target.value)} required /></label><label>Excel or CSV export<input type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,.csv,text/csv" onChange={fileChanged} required /></label></div>
      <p className="growth-muted">Excel: upload the full GSC .xlsx workbook (under 5 MB); we read only the Pages sheet. CSV: under 1 MB. Up to 2,000 pages. Columns: Top pages, Clicks, Impressions, CTR, Position. URLs with query parameters are rejected. No personal or visitor-level exports.</p><button className="button primary" disabled={!csv || !start || !end || busy}>Validate and preview</button></fieldset></form>
      {preview && <div className="growth-preview"><h4>{preview.rowCount.toLocaleString()} valid pages · {preview.start} to {preview.end}</h4><p>First {preview.rows.length} rows shown. All rows passed validation. Export coverage is unverified and may be incomplete; absence does not mean zero traffic.</p><PageRows rows={preview.rows} /><button className="button primary" disabled={busy} onClick={() => submit('commit')}>{busy ? 'Saving…' : 'Save this snapshot'}</button></div>}
    </details>}
    {result && <section className="growth-panel"><h3>Saved evidence</h3><p>Newest 50 snapshots. Each analysis saves both reporting periods. Historical evidence stays unchanged; identical evidence is reused.</p>
      {!result.snapshots.length ? <p className="growth-note">No evidence saved yet.{canImport ? ' Run an analysis above to begin.' : ' An analyst can run the first analysis.'}</p> : <ul className="growth-snapshots">{result.snapshots.map(snapshot => <li key={snapshot.id}><div><strong>{snapshot.period_start} to {snapshot.period_end}</strong><span>{snapshot.row_count.toLocaleString()} pages · {snapshot.coverage.startsWith('gsc_api_') ? 'Connected GSC' : 'GSC export'} · Pacific dates</span><small>Saved {new Date(snapshot.created_at).toLocaleString()} · Coverage not exhaustive</small></div><button className="button" disabled={busy} onClick={() => inspect(snapshot.id)}>Inspect evidence</button></li>)}</ul>}
    </section>}
    {selected && <section className="growth-panel"><h3>Snapshot evidence</h3><p>{selected.payload.start} to {selected.payload.end} · {selected.payload.timezone} · GSC page-level aggregates</p><p className="growth-muted">Showing {Math.min(20, selected.row_count)} of {selected.row_count} saved pages. CTR is calculated from each page’s clicks and impressions. Average position is not a guaranteed rank. These rows cannot be summed into site totals.</p><PageRows rows={selected.payload.rows.slice(0, 20)} /><button className="button" onClick={() => setSelected(null)}>Close evidence</button></section>}
  </section>;
}
