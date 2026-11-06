'use client';
import MetricHelp from './MetricHelp';
import {METRIC_HELP} from '../../lib/metric-definitions';
import {useEffect,useState} from 'react';
import {executiveDefaults,executivePeriod,executiveChange,leadCoverage} from '../../lib/posthog/executive';
import {periodParams} from '../../lib/posthog/period';
import './executive-summary.css';

const number=n=>n==null?'Unavailable':n.toLocaleString('en-US');
export default function ExecutiveSummary({onInspectPages}){
 const [draft,setDraft]=useState(()=>executiveDefaults());
 const [applied,setApplied]=useState(()=>executivePeriod(executiveDefaults()));
 const [validation,setValidation]=useState(''),[retry,setRetry]=useState(0);
 const [traffic,setTraffic]=useState(null),[leads,setLeads]=useState(null);
 const query=periodParams(applied.selection),p=applied.period;
 useEffect(()=>{
  const controller=new AbortController();setTraffic(null);setLeads(null);
  const read=async url=>{const r=await fetch(url,{signal:controller.signal,cache:'no-store'});const json=await r.json();if(!r.ok)throw Error(json.error||'Source unavailable');return json;};
  read(`/api/analytics/overview?${query}`).then(data=>{if(!controller.signal.aborted)setTraffic({data,query});}).catch(()=>{if(!controller.signal.aborted)setTraffic({error:'Traffic could not be loaded. Retry the scorecard.',query});});
  (async()=>{
   try{
    const meta=await read('/api/analytics/datorama/periods');
    const gap=leadCoverage(meta,p);if(gap){if(!controller.signal.aborted)setLeads({error:gap,meta,query});return;}
    const params=new URLSearchParams({mode:'custom',compare:'custom',start:p.start,end:p.end,priorStart:p.priorStart,priorEnd:p.priorEnd});
    const data=await read(`/api/analytics/datorama/periods?${params}`);
    if(!controller.signal.aborted)setLeads({data,meta,query});
   }catch{if(!controller.signal.aborted)setLeads({error:'Imported leads could not be loaded. Retry the scorecard.',query});}
  })();
  return()=>controller.abort();
 },[query,retry]);
 const currentTraffic=traffic?.query===query?traffic:null,currentLeads=leads?.query===query?leads:null;
 const session=currentTraffic?.data?.metrics.find(m=>m.key==='sessions');
 const lead=currentLeads?.data?.metrics.find(m=>m.key==='eipLeads');
 const rows=[
  {name:'Organic traffic growth',definition:'Distinct PostHog sessions with MedicareFAQ organic-search page views in the GTM/CDN stream. Growth compares session totals with the same dates last year.',value:session?.value,prior:session?.previous,complete:!!session&&!session.unavailableReason,loading:!currentTraffic,note:currentTraffic?.error||session?.unavailableReason||'Organic sessions · PostHog',detail:'Tracking coverage can differ across years. No recorded baseline is not proof of no traffic.'},
  {name:'Organic lead generation',definition:'Datorama Lead Count (EIP), scoped to its SEO channel and production MedicareFAQ landing URLs. This is the source lead count, not a count of independently verified unique people.',value:lead?.total,prior:lead?.previous?.total,complete:!!lead&&!lead.missingDays&&!lead.previous.missingDays,loading:!currentLeads,note:currentLeads?.error||'EIP leads · Datorama imported snapshot',detail:lead&&(lead.missingDays||lead.previous.missingDays)?`Reported subtotals: ${lead.reportedDays} of ${lead.reportedDays+lead.missingDays} current days and ${lead.previous.reportedDays} of ${lead.previous.reportedDays+lead.previous.missingDays} prior days reported. No growth comparison is calculated.`:'Lead counts use source calendar dates; the Datorama timezone is unconfirmed.'},
 ];
 function apply(e){e.preventDefault();try{setApplied(executivePeriod(draft));setRetry(n=>n+1);setValidation('');}catch(error){setValidation(error.message);}}
 return <section className="executive-summary" aria-labelledby="executive-title">
  <header><span className="organic-badge">MEDICAREFAQ.COM · EXECUTIVE SUMMARY</span><h2 id="executive-title">Organic performance scorecard</h2><p>Five business KPIs, with measured results and measurement gaps kept visible.</p></header>
  <form className="executive-controls" onSubmit={apply}>
   <label>Scorecard period<select value={draft.mode} onChange={e=>setDraft({...draft,mode:e.target.value})}><option value="month">Monthly</option><option value="quarter">Quarterly</option><option value="ytd">Year to date</option></select></label>
   {draft.mode==='month'&&<label>Scorecard month<input type="month" required value={draft.month} onChange={e=>setDraft({...draft,month:e.target.value})}/></label>}
   {draft.mode==='quarter'&&<><label>Quarter<select value={draft.quarter} onChange={e=>setDraft({...draft,quarter:e.target.value})}>{[1,2,3,4].map(q=><option key={q} value={q}>Q{q}</option>)}</select></label><label>Quarter year<input type="number" min="2000" max="2100" required value={draft.year} onChange={e=>setDraft({...draft,year:e.target.value})}/></label></>}
   <button className="button" type="submit">Apply scorecard dates</button>
  </form>
  {validation&&<p role="alert">{validation}</p>}
  <p className="executive-dates"><strong>{p.start} – {p.end}</strong> compared with <strong>{p.priorStart} – {p.priorEnd}</strong> · Same dates last year</p>
  <p className="executive-note">{p.days} current days / {p.priorDays} comparison days. This scorecard has its own dates; reports below keep their separate controls.</p>
  <div className="executive-table" role="region" aria-label="Executive KPI scorecard" tabIndex={0}><table><thead><tr><th scope="col">KPI & definition</th><th scope="col">Selected period<MetricHelp label="Selected period" definition={METRIC_HELP.selected} /></th><th scope="col">Last year<MetricHelp label="Last year" definition={METRIC_HELP.previous} /></th><th scope="col">Change<MetricHelp label="Change" definition={METRIC_HELP.change} /></th></tr></thead><tbody>
   {rows.map(row=>{const change=executiveChange(row.value,row.prior,row.complete);return <tr key={row.name}><th scope="row"><strong>{row.name}</strong><MetricHelp label={row.name} definition={METRIC_HELP[row.name==='Organic traffic growth'?'sessions':'eipLeads']} /><details><summary>Definition</summary><p>{row.definition}</p></details><small>{row.note}</small><small>{row.detail}</small></th><td>{row.loading?'Loading…':number(row.value)}{row.value!=null&&!row.complete&&<small>Reported subtotal / incomplete</small>}</td><td>{row.loading?'Loading…':number(row.prior)}</td><td><span className="executive-change" data-tone={change.tone}>{row.loading?'Loading…':change.text}</span></td></tr>;})}
   <tr><th scope="row"><strong>Overall page performance</strong><MetricHelp label="Overall page performance" definition={METRIC_HELP.pagePerformance} /><small>Page-level traffic, engagement and search results need separate interpretation; no combined score is defined.</small></th><td colSpan={3}><button className="button" type="button" onClick={()=>onInspectPages(applied.selection)}>Review pages for these dates</button><small>Opens the PostHog landing-page breakdown below. GSC keeps its own date controls.</small></td></tr>
   <tr><th scope="row"><strong>Opportunities generated by organic</strong><MetricHelp label="Opportunities generated by organic" definition={METRIC_HELP.opportunities} /><small>Requires a defined CRM opportunity stage, date basis and attribution to MedicareFAQ organic traffic. Growth Hunter suggestions are not sales opportunities.</small></th><td colSpan={3}><span className="executive-gap">Not yet measured</span><small>CRM opportunity data and attribution are not connected to this KPI.</small></td></tr>
   <tr><th scope="row"><strong>Revenue generated by organic</strong><MetricHelp label="Revenue generated by organic" definition={METRIC_HELP.revenue} /><small>Requires an agreed revenue definition and CRM revenue records attributed to MedicareFAQ organic traffic.</small></th><td colSpan={3}><span className="executive-gap">Not yet measured</span><small>Policy counts and Semrush traffic value are not revenue.</small></td></tr>
  </tbody></table></div>
  <footer><p>Sources: <a href="https://us.posthog.com/project/452683/web" target="_blank" rel="noreferrer">PostHog</a>{currentTraffic?.data&&` · Retrieved ${new Date(currentTraffic.data.fetchedAt).toLocaleString()}`} · Datorama{currentLeads?.meta&&` · Imported ${new Date(currentLeads.meta.exportedAt).toLocaleString()} · Lead data through ${currentLeads.meta.leadDataThrough}`}</p><button type="button" className="button" onClick={()=>setRetry(n=>n+1)}>Refresh scorecard</button></footer>
 </section>;
}
