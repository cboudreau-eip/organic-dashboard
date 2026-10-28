'use client';
import CollapsibleSection from './CollapsibleSection';
import { useEffect, useState } from 'react';
const format = (value, column) => value === null || value === '' ? '—' : typeof value === 'number' ? /Ratio|Rate|%/.test(column) ? `${(value * 100).toFixed(1)}%` : value.toLocaleString('en-US') : value === 'null' ? 'Unknown landing page' : value;

export default function DatoramaSnapshot() {
  const [data, setData] = useState(null), [error, setError] = useState('');
  const [sheetIndex, setSheetIndex] = useState(0), [search, setSearch] = useState('');
  const [sort, setSort] = useState({ column: 1, descending: true });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setError('');
    fetch('/api/analytics/datorama', { signal: controller.signal, cache: 'no-store' }).then(async response => {
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setData(result);
    }).catch(e => { if (!controller.signal.aborted) setError(e.message); });
    return () => controller.abort();
  }, [attempt]);
  if (error) return <section className="card datorama-import"><h2>Datorama historical report</h2><p role="alert">{error}</p><button className="button" onClick={() => setAttempt(attempt + 1)}>Retry import</button></section>;
  if (!data) return <p role="status">Loading Datorama historical report…</p>;
  const sheet = data.sheets[sheetIndex];
  const rows = sheet.rows.filter(row => row.some(value => String(value ?? '').toLowerCase().includes(search.toLowerCase()))).sort((a, b) => {
    const x = a[sort.column], y = b[sort.column];
    if (x === null) return y === null ? 0 : 1;
    if (y === null) return -1;
    return (typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y))) * (sort.descending ? -1 : 1);
  });
  const main = data.sheets[0];
  return <CollapsibleSection className="card datorama-import" title="Historical leads & policies" level={2} header={<div className="organic-heading"><div><span className="organic-badge">DATORAMA · IMPORTED SNAPSHOT</span><h2>Historical leads & policies</h2></div><a href={data.url} target="_blank" rel="noreferrer">Open source report ↗</a></div>}>
    
    <p><strong>July 1 – September 30, 2026</strong> · {data.dateBasis}. Exported {new Date(data.exportedAt).toLocaleDateString()}.</p>
    <p>This fixed three-month report is independent of the live reporting-period selector below. {data.scope}</p>
    <div className="organic-cards conversion-cards">{[1,2,10,12].map(i => <article className="card" key={i}><span>{main.columns[i]}</span><strong>{format(main.totals[i], main.columns[i])}</strong><small>MedicareFAQ archive total</small></article>)}</div>
    <details className="organic-definitions"><summary>Import scope and metric definitions</summary>{data.notes.map(note => <p key={note}>{note}</p>)}<p>G MS Policies, G MA Policies, and G M Policies retain their original report names. Their business definitions and the timezone require confirmation. Do not combine these counts with PostHog submissions or calculate a cross-source conversion rate.</p></details>
    <div className="datorama-controls"><label>Report table <select value={sheetIndex} onChange={e => { setSheetIndex(Number(e.target.value)); setSearch(''); setSort({ column: Number(e.target.value) === 0 ? 1 : 2, descending: true }); }}>{data.sheets.map((s,i) => <option key={s.name} value={i}>{s.name}</option>)}</select></label><label>Search table <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Landing page, plan, carrier…" /></label></div>
    <p>{rows.length} of {sheet.rows.length} rows · Search filters the table only; summary cards and totals remain for the MedicareFAQ archive. Click a column heading to sort.</p>
    <div className="organic-table-scroll datorama-table"><table><thead><tr>{sheet.columns.map((column,i) => <th key={column} scope="col" aria-sort={sort.column === i ? sort.descending ? 'descending' : 'ascending' : 'none'}><button onClick={() => setSort({ column:i, descending:sort.column === i ? !sort.descending : true })}>{column}{sort.column === i ? sort.descending ? ' ↓' : ' ↑' : ''}</button></th>)}</tr></thead><tbody>{rows.map((row,i) => <tr key={i}>{row.map((value,j) => <td key={j}>{format(value,sheet.columns[j])}</td>)}</tr>)}</tbody><tfoot><tr>{sheet.totals.map((value,i) => <td key={i}>{i === 0 ? 'MedicareFAQ archive total' : format(value,sheet.columns[i])}</td>)}</tr></tfoot></table>{!rows.length && <p>No matching rows.</p>}</div>
  </CollapsibleSection>;
}
