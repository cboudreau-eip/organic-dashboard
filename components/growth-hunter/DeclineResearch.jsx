'use client';
import { useEffect, useState } from 'react';
import KeywordResearch from './KeywordResearch';
async function request(init,signal) {
 const response=await fetch('/api/growth-hunter/runs',{cache:'no-store',...init,signal});
 const data=await response.json(); if(!response.ok) throw new Error(data.error || 'Research is unavailable.'); return data;
}
function Findings({run,canRun}) {
 const report=run.result;
 return <section aria-label="Decline research results">
  <h4>{report.priorPeriod.start} to {report.priorPeriod.end} compared with {report.currentPeriod.start} to {report.currentPeriod.end}</h4>
  <p>{report.matchedPages} matched pages; {report.priorOnlyPages} earlier-only and {report.currentOnlyPages} later-only pages excluded. Dates use Pacific time.</p>
  <p><strong>{report.candidateCount} decline candidates.</strong> Showing up to {report.displayLimit}, ordered by lost clicks. This is not a lead-value score.</p>
  {report.status==='insufficient_data' && <p className="growth-note">No matching pages. These snapshots cannot support a page decline comparison.</p>}
  {report.status==='no_candidates' && <p className="growth-note">No matched pages meet this detector’s thresholds. That does not establish that the entire site is stable.</p>}
  {report.findings.map(finding=><article className="growth-finding" key={finding.url}>
   <h4><a href={finding.url} target="_blank" rel="noopener noreferrer">{finding.url.replace('https://www.medicarefaq.com','')}</a></h4>
   <p><strong>{finding.lostClicks.toLocaleString()} fewer clicks ({finding.declinePercent}%)</strong> · {finding.prior.clicks.toLocaleString()} → {finding.current.clicks.toLocaleString()}</p>
   <dl className="growth-evidence"><div><dt>Impressions</dt><dd>{finding.prior.impressions.toLocaleString()} → {finding.current.impressions.toLocaleString()} ({finding.impressionsChangePercent}%)</dd></div><div><dt>Average position</dt><dd>{finding.prior.position.toFixed(2)} → {finding.current.position.toFixed(2)} (lower is better)</dd></div><div><dt>CTR</dt><dd>{(finding.prior.ctr*100).toFixed(2)}% → {(finding.current.ctr*100).toFixed(2)}%</dd></div></dl>
   <p><strong>Suggested investigation:</strong> Check this page’s query mix and indexing, compare search demand for these dates, and review any content or template changes. Confirm the cause before assigning edits.</p>
   <KeywordResearch key={run.id+finding.url} runId={run.id} page={finding.url} canRun={canRun}/>
  </article>)}
  <details><summary>Detection rules and evidence limits</summary><p>At least {report.thresholds.minimumPriorClicks} prior clicks, {report.thresholds.minimumPriorImpressions} prior impressions, {report.thresholds.minimumLostClicks} lost clicks and a {report.thresholds.minimumDeclinePercent}% decline. Pilot rules, not statistically validated success thresholds.</p><ul>{report.limitations.map(text=><li key={text}>{text}</li>)}</ul><p>{report.scopeConfirmation}</p><p>Saved {new Date(run.created_at).toLocaleString()} · {run.detector_version}. Results reference frozen snapshots.</p></details>
 </section>;
}
export default function DeclineResearch({snapshots,canRun,onEvidenceSaved}) {
 const [days,setDays]=useState(28);
 const [runs,setRuns]=useState(null),[selected,setSelected]=useState(null);
 const [priorId,setPrior]=useState(''),[currentId,setCurrent]=useState(''),[confirmed,setConfirmed]=useState(false);
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),[refresh,setRefresh]=useState(0);
 useEffect(()=>{const controller=new AbortController();setError('');request(undefined,controller.signal).then(data=>setRuns(data.runs)).catch(e=>{if(!controller.signal.aborted)setError(e.message)});return ()=>controller.abort();},[refresh]);
 async function run(event) {
  event.preventDefault();setBusy(true);setError('');setNotice('');
  try { const data=await request({method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({priorId,currentId,scopeConfirmed:confirmed})});setSelected(data.run);setRuns(previous=>[data.run,...(previous||[]).filter(item=>item.id!==data.run.id)].slice(0,20));setNotice(data.reused?'Opened the existing run for these snapshots.':'Research saved. No website changes were made.'); }
  catch(e){setError(e.message)}finally{setBusy(false)}
 }
 async function analyze(event) {
  event.preventDefault();setBusy(true);setSelected(null);setError('');setNotice('');
  try {
   const response=await fetch('/api/growth-hunter/analyze',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({days})});
   const data=await response.json();if(!response.ok)throw new Error(data.error||'GSC analysis is unavailable.');
   setSelected(data.run);setRuns(previous=>[data.run,...(previous||[]).filter(item=>item.id!==data.run.id)].slice(0,20));
   setNotice(data.reused?'Opened the saved analysis for this unchanged GSC evidence.':'GSC analysis saved with both reporting periods.');
   onEvidenceSaved?.();
  }catch(e){setError(e.message)}finally{setBusy(false)}
 }
 const option=snapshot=><option key={snapshot.id} value={snapshot.id}>{snapshot.period_start} to {snapshot.period_end} · {snapshot.row_count} pages · saved {new Date(snapshot.created_at).toLocaleString()} · {snapshot.id.slice(0,8)}</option>;
 return <section className="growth-panel" aria-label="Decline research"><h3>Find pages losing clicks</h3><p>Analyze the latest finalized GSC data against the preceding equal period. Only pages present in both periods are compared. Medicare enrollment seasonality can affect the results.</p>
  {error&&<p role="alert" className="growth-error">{error} <button className="button" onClick={()=>setRefresh(value=>value+1)} disabled={busy}>Retry saved research</button></p>}
  {notice&&<p role="status">{notice}</p>}
  {canRun&&<form onSubmit={analyze}><fieldset disabled={busy}><legend>Use connected Google Search Console</legend><label>Reporting period<select value={days} onChange={e=>setDays(Number(e.target.value))}><option value={7}>Last 7 finalized days</option><option value={28}>Last 28 finalized days</option></select></label><p>MedicareFAQ · Web search · Pacific dates. URLs with query parameters or fragments are excluded. Google may omit some pages; missing pages are never counted as zero.</p><button className="button primary" disabled={busy}>{busy?'Fetching GSC and comparing…':'Run analysis'}</button></fieldset></form>}
  {canRun&&<details><summary>Compare previously saved snapshots</summary><form onSubmit={run}><fieldset disabled={busy || snapshots.length<2}><legend>Select evidence</legend><div className="growth-fields"><label>Earlier snapshot<select required value={priorId} onChange={e=>{setPrior(e.target.value);setConfirmed(false)}}><option value="">Choose earlier period</option>{snapshots.map(option)}</select></label><label>Later snapshot<select required value={currentId} onChange={e=>{setCurrent(e.target.value);setConfirmed(false)}}><option value="">Choose later period</option>{snapshots.map(option)}</select></label></div><label className="growth-confirm"><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)} /> I checked that both exports use the same GSC property, Web search type and filters.</label><button className="button primary" disabled={busy||!confirmed||!priorId||!currentId||priorId===currentId}>{busy?'Comparing…':'Compare and save findings'}</button></fieldset>{snapshots.length<2&&<p className="growth-muted">Run an analysis to save evidence automatically, or use the optional import below.</p>}</form></details>}
  {runs===null&&!error&&<p role="status">Loading saved research…</p>}
  {runs?.length===0&&<p>No saved research yet. Opening this panel does not start a run.</p>}
  {!!runs?.length&&<label className="growth-run-select">Saved research (newest 20)<select value={selected?.id||''} onChange={e=>setSelected(runs.find(item=>item.id===e.target.value)||null)}><option value="">Choose a saved run</option>{runs.map(item=><option key={item.id} value={item.id}>{item.result.currentPeriod.start} to {item.result.currentPeriod.end} · {item.result.candidateCount} candidates · {item.id.slice(0,8)}</option>)}</select></label>}
  {selected&&<Findings run={selected} canRun={canRun}/>}
 </section>;
}
