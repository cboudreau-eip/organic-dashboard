'use client';
import {useEffect,useState} from 'react';
import {periodParams,formatReportDate} from '../../lib/posthog/period';
import MetricHelp from './MetricHelp';
import './page-performance.css';
const n=value=>value==null?'Unavailable':value.toLocaleString('en-US');
const pct=value=>value==null?'Unavailable':`${value.toFixed(1)}%`;
const definitions={
 scroll:{meaning:'Average maximum content depth reached on the landing page, across sessions with valid scroll metadata.',calculation:'Maximum content depth per session, averaged across measured sessions × 100.',source:'PostHog · CDN pageleave events · organic MedicareFAQ sessions',limit:'Includes the visible viewport, not just scrolling. Repeat visits to the landing page use the deepest observation. Missing measurements are excluded, not zero.'},
 bounce:{meaning:'Short single-page exits among sessions with an observed final page exit.',calculation:'Sessions with one CDN pageview, no CDN autocaptured interactions and duration under 10 seconds ÷ exit-covered sessions × 100.',source:'PostHog · custom measured session calculation',limit:'Not the native PostHog bounce rate or an estimate for unmeasured sessions. Tracking gaps and custom interactions can affect this result.'}
};
export default function PagePerformance({days,refresh}){
 const key=periodParams(days);
 const [data,setData]=useState(null),[error,setError]=useState(''),[retry,setRetry]=useState(0);
 const [search,setSearch]=useState(''),[scope,setScope]=useState('all'),[sort,setSort]=useState('sessions'),[shown,setShown]=useState(25);
 useEffect(()=>{const controller=new AbortController();setData(null);setError('');setShown(25);
  (async()=>{try{const r=await fetch(`/api/analytics/page-performance?${key}`,{signal:controller.signal,cache:'no-store'});const json=await r.json();if(!r.ok)throw Error(json.error||'Page performance is unavailable.');if(!controller.signal.aborted)setData(json);}catch(e){if(!controller.signal.aborted)setError(e.message);}})();
  return()=>controller.abort();
 },[key,refresh,retry]);
 const value=row=>sort==='sessions'?row.engagement?.sessions:sort==='scroll'?row.engagement?.scroll:sort==='quoteStarts'?row.conversions?.quoteStarts:row.conversions?.completedFunnel;
 const rows=(data?.rows||[]).filter(r=>(scope!=='local'||r.local)&&r.path.toLowerCase().includes(search.toLowerCase())).sort((a,b)=>(value(b)??-1)-(value(a)??-1)||a.path.localeCompare(b.path));
 return <section className="card page-performance" aria-labelledby="page-performance-title">
  <h3 id="page-performance-title">Page performance & local content</h3>
  <p>Find pages attracting organic visits, engaging readers, and starting quote journeys.</p>
  {error&&<p role="alert">{error} <button className="button" onClick={()=>setRetry(x=>x+1)}>Retry page performance</button></p>}
  {!data&&!error&&<p role="status">Loading page performance… Other reports remain available.</p>}
  {data&&<>
   <p className="organic-detail-note">{formatReportDate(data.period.start)} – {formatReportDate(data.period.end)} · {data.timezone} · Selected period only · Retrieved {new Date(data.fetchedAt).toLocaleString()}</p>
   {data.unavailable.length>0&&<p role="status">Unavailable: {data.unavailable.join(', ')}. Missing values are not zero. <button className="button" onClick={()=>setRetry(x=>x+1)}>Retry</button></p>}
   {data.truncated&&<p role="status">Limited to the top {n(data.limit)} pages per source. Filters apply to loaded pages only.</p>}
   <div className="page-performance-controls">
    <label>Find a page<input type="search" placeholder="Search URL, e.g. florida" value={search} onChange={e=>{setSearch(e.target.value);setShown(25);}}/></label>
    <label>Page group<select value={scope} onChange={e=>{setScope(e.target.value);setShown(25);}}><option value="all">All pages</option><option value="local">Local / state pages</option></select></label>
    <label>Sort by<select value={sort} onChange={e=>{setSort(e.target.value);setShown(25);}}><option value="sessions">Most organic sessions</option><option value="scroll">Highest measured scroll depth</option><option value="quoteStarts">Most quote starts</option><option value="completed">Most completed journeys</option></select></label>
   </div>
   <p className="organic-detail-note">Local / state pages identifies geographic content under Medicare by state and Medicare Supplement state paths; it does not filter visitor location. Search can find pages outside those URL families.</p>
   <p role="status">{n(rows.length)} matching pages · Showing {Math.min(shown,rows.length)}</p>
   <div className="page-performance-list">{rows.slice(0,shown).map(row=>{const e=row.engagement,c=row.conversions;return <article className="page-performance-row" key={row.path}>
    <div className="page-performance-heading"><a href={`https://www.medicarefaq.com${row.path}`} target="_blank" rel="noopener noreferrer">{row.path}</a>{row.local&&<span>Local / state</span>}</div>
    <dl><div><dt>Organic sessions</dt><dd>{n(e?.sessions)}</dd></div><div><dt>Measured scroll<MetricHelp label={`Measured scroll for ${row.path}`} definition={definitions.scroll}/></dt><dd>{pct(e?.scroll)}</dd></div><div><dt>Quote starts</dt><dd>{n(c?.quoteStarts)}</dd></div><div><dt>Completed journeys</dt><dd>{n(c?.completedFunnel)}</dd></div></dl>
    <details><summary>Engagement, completion rate & measurement coverage</summary>
     <dl><div><dt>Measured bounce<MetricHelp label={`Measured bounce for ${row.path}`} definition={definitions.bounce}/></dt><dd>{pct(e?.bounceRate)}</dd></div><div><dt>Measured session duration</dt><dd>{e?.duration==null?'Unavailable':`${Math.round(e.duration)} sec`}</dd></div><div><dt>Quote completion rate</dt><dd>{pct(c?.quoteStarts?100*c.completedFunnel/c.quoteStarts:null)}</dd></div><div><dt>Contact submissions</dt><dd>{n(c?.contactSessions)}</dd></div></dl>
     <p>Exit coverage: {n(e?.measured)} of {n(e?.sessions)} sessions. Landing-page scroll measured in {n(e?.scrollSessions)} sessions. Quote activity eligible sessions: {n(c?.sessions)}.</p>
     <p>Completed journeys require a ZIP submission followed by a contact submission in the same session. Contact submissions are not verified CRM leads or policies. A zero-start completion rate is unavailable.</p>
    </details>
   </article>;})}</div>
   {!rows.length&&<p>No pages match these filters.</p>}
   {rows.length>shown&&<button className="button" onClick={()=>setShown(x=>x+25)}>Show 25 more pages</button>}
   <details className="page-performance-method"><summary>How to read this report</summary><p>Engagement uses CDN pageviews, exits and autocaptured interactions for organic sessions active in the selected period, including adjacent-day events to preserve sessions crossing midnight. Duration is first pageview to last observed activity, not active reading time; only sessions with a final page exit are measured. Scroll depth describes the landing page; duration and measured bounce describe the session.</p><p>Quote activity uses sessions starting in the selected period with a CDN MedicareFAQ pageview, plus tracked cross-domain quote steps inside the selected dates. These eligibility rules can produce a different session count from engagement. No rate mixes the two denominators. All figures are observed tracking data; missing events and small samples limit interpretation.</p></details>
  </>}
 </section>;
}
