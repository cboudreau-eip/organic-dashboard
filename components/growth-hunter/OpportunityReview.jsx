'use client';
import {useEffect,useRef,useState} from 'react';
import KeywordResearch from './KeywordResearch';
import DeclinePlan from './DeclinePlan';
import ContentSuggestion from './ContentSuggestion';
import {opportunitySignal,pageLabel,visibleOpportunities,contactLabel} from '../../lib/growth-hunter/opportunity-view';

function Review({run,finding,canRun,onSaved,onContacts,onBack}){
 const [research,setResearch]=useState(null);
 const signal=opportunitySignal(finding);
 return <article className="growth-review">
  <button type="button" className="button" onClick={onBack}>← Back to opportunities</button>
  <div className="growth-review-heading"><span className="growth-signal">{signal.label}</span><h4>{pageLabel(finding.url)}</h4><a href={finding.url} target="_blank" rel="noreferrer">Open page ↗</a><p className="growth-page-path">{finding.url}</p></div>
  <section className="growth-review-section"><h5>What changed</h5><p><strong>{finding.lostClicks.toLocaleString()} fewer Google clicks ({finding.declinePercent}% decline)</strong> compared with the previous period.</p>
  <dl className="growth-review-metrics"><div><dt>Clicks</dt><dd>{finding.prior.clicks.toLocaleString()} → {finding.current.clicks.toLocaleString()}</dd></div><div><dt>Impressions</dt><dd>{finding.prior.impressions.toLocaleString()} → {finding.current.impressions.toLocaleString()}</dd></div><div><dt>Click-through rate</dt><dd>{(finding.prior.ctr*100).toFixed(2)}% → {(finding.current.ctr*100).toFixed(2)}%</dd></div><div><dt>Average position</dt><dd>{finding.prior.position.toFixed(2)} → {finding.current.position.toFixed(2)}</dd></div></dl>
  <p>{signal.description} These are investigation signals, not proven causes. Lower average position is better.</p></section>
  <details className="growth-support"><summary>Investigate supporting keywords</summary><p>Load query evidence to see which searches lost clicks. Evidence you load here is attached when you save the proposed next step.</p><KeywordResearch runId={run.id} page={finding.url} canRun={canRun} onEvidence={setResearch}/></details>
  <ContentSuggestion run={run} finding={finding} canRun={canRun} onSaved={onSaved}/>
  <details className="growth-support"><summary>Plan an investigation instead</summary><DeclinePlan run={run} finding={finding} research={research} canRun={canRun} onSaved={onSaved} onContacts={onContacts}/></details>
 </article>;
}
export default function OpportunityReview({run,canRun,onSaved}){
 const report=run.result;
 const [query,setQuery]=useState(''),[signal,setSignal]=useState('all'),[sort,setSort]=useState('lost'),[selected,setSelected]=useState(null),[visited,setVisited]=useState([]),[contacts,setContacts]=useState({});
 const heading=useRef(null),firstRender=useRef(true);
 useEffect(()=>{if(firstRender.current){firstRender.current=false;return;}heading.current?.focus();},[selected]);
 const rows=visibleOpportunities(report.findings,{query,signal,sort});
 const lost=report.findings.reduce((sum,f)=>sum+f.lostClicks,0);
 const checked=Object.keys(contacts).length;
 const fewer=Object.values(contacts).filter(e=>e.current&&e.previous&&e.current.contactSessions<e.previous.contactSessions).length;
 function open(url){setVisited(previous=>previous.includes(url)?previous:[...previous,url]);setSelected(url);}
 return <section className="growth-opportunities" aria-label="Decline research results">
  <div className="growth-period"><strong>{report.currentPeriod.start} – {report.currentPeriod.end}</strong><span>Compared with {report.priorPeriod.start} – {report.priorPeriod.end} · Pacific dates</span><small>Analysis saved {new Date(run.created_at).toLocaleString()}</small></div>
  <div className="growth-queue-stats"><div><span>Pages flagged</span><strong>{report.candidateCount.toLocaleString()}</strong><small>{report.findings.length} available in this review</small></div><div><span>Clicks lost</span><strong>{lost.toLocaleString()}</strong><small>Across these {report.findings.length} listed pages only</small></div><div><span>Contact checks</span><strong>{checked} / {report.findings.length}</strong><small>{checked?`${fewer} checked pages show fewer contacts`:'Open an opportunity to check contacts'}</small></div></div>
  <h4 ref={heading} tabIndex={-1} className="growth-queue-title">{selected?'Review opportunity':'Opportunities to review'}</h4>
  <div hidden={!!selected}>
   <p className="growth-queue-intro">Start with the largest click losses, then review the evidence before choosing a change.</p>
   <div className="growth-queue-controls"><label>Find a page<input type="search" placeholder="Search page name or URL" value={query} onChange={e=>setQuery(e.target.value)}/></label><label>Main signal<select value={signal} onChange={e=>setSignal(e.target.value)}><option value="all">All signals</option><option value="position">Position worsened</option><option value="ctr">Lower click-through rate</option><option value="impressions">Fewer impressions</option><option value="review">Needs investigation</option></select></label><label>Sort by<select value={sort} onChange={e=>setSort(e.target.value)}><option value="lost">Most clicks lost</option><option value="percent">Largest percentage decline</option><option value="page">Page name A–Z</option></select></label></div>
   {report.status==='insufficient_data'?<p className="growth-note">No matching pages. These snapshots cannot support a comparison.</p>:!report.findings.length?<p className="growth-note">No matched pages met the decline thresholds. This does not establish that the entire site is stable.</p>:<>
    <p className="growth-muted" role="status">Showing {rows.length} of {report.findings.length} listed opportunities. Contact checks reflect this review session; missing data is not zero.</p>
    {rows.length?<div className="growth-queue-scroll"><table className="growth-queue-table"><caption className="growth-visually-hidden">Page opportunities, sorted by {sort==='lost'?'most clicks lost':sort==='percent'?'percentage decline':'page name'}</caption><thead><tr><th scope="col">Page</th><th scope="col">Clicks lost</th><th scope="col">Main signal</th><th scope="col">Contact impact</th><th scope="col"><span className="growth-visually-hidden">Review</span></th></tr></thead><tbody>{rows.map(f=><tr key={f.url}><th scope="row"><span className="growth-page-name">{pageLabel(f.url)}</span><small className="growth-page-path">{new URL(f.url).pathname}</small></th><td><strong className="growth-loss">−{f.lostClicks.toLocaleString()}</strong><small>{f.declinePercent}% decline</small></td><td><span className="growth-signal">{opportunitySignal(f).label}</span></td><td><span className={contacts[f.url]?'':'growth-muted'}>{contactLabel(contacts[f.url])}</span></td><td><button type="button" className="button" aria-label={`Review opportunity: ${pageLabel(f.url)}`} onClick={()=>open(f.url)}>Review opportunity →</button></td></tr>)}</tbody></table></div>:<div className="growth-note">No pages match these filters. <button className="button" type="button" onClick={()=>{setQuery('');setSignal('all');}}>Clear filters</button></div>}
   </>}
  </div>
  {visited.map(url=><div hidden={selected!==url} key={url}><Review run={run} finding={report.findings.find(f=>f.url===url)} canRun={canRun} onSaved={onSaved} onContacts={evidence=>setContacts(previous=>({...previous,[url]:evidence}))} onBack={()=>setSelected(null)}/></div>)}
  <details className="growth-support"><summary>Analysis coverage and detection rules</summary><p>{report.matchedPages} matched pages; {report.priorOnlyPages} earlier-only and {report.currentOnlyPages} later-only pages excluded. Up to {report.displayLimit} findings are saved per run. Filters and summaries apply to the listed pages, not site totals. Page names are shortened URL paths, not fetched page titles.</p><p>At least {report.thresholds.minimumPriorClicks} prior clicks, {report.thresholds.minimumPriorImpressions} prior impressions, {report.thresholds.minimumLostClicks} lost clicks and a {report.thresholds.minimumDeclinePercent}% decline. Pilot investigation rules, not statistically validated success thresholds.</p><ul>{report.limitations.map(text=><li key={text}>{text}</li>)}</ul><p>{report.scopeConfirmation}</p><p>{run.detector_version} · Results reference frozen snapshots.</p></details>
 </section>;
}
