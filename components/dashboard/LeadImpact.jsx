'use client';
import SaveOpportunity from './SaveOpportunity';
import {useEffect,useMemo,useState} from 'react';
import {leadImpact} from '../../lib/semrush/lead-impact';
const number=n=>n==null?'Not reported':n.toLocaleString();
const signed=n=>n==null?'Not comparable':(n>0?'+':'')+n.toLocaleString();
const rate=n=>n==null?'Unavailable':n.toFixed(2)+'%';
export default function LeadImpact({groups,result,Pagination,snapshotId,canSave=false,onSaved}){
 const [open,setOpen]=useState(false),[state,setState]=useState(null),[attempt,setAttempt]=useState(0);
 const [sort,setSort]=useState('priority'),[page,setPage]=useState(0),[size,setSize]=useState(25);
 const period=result?.period;
 const key=period?new URLSearchParams({mode:'custom',compare:'custom',start:period.start,end:period.end,priorStart:period.priorStart,priorEnd:period.priorEnd}).toString():'';
 useEffect(()=>{
  if(!open||!key)return;
  const controller=new AbortController();setState({key,status:'loading'});
  (async()=>{
   try{
    const response=await fetch('/api/analytics/lead-pages?'+key,{signal:controller.signal,cache:'no-store'});
    const data=await response.json();
    if(!response.ok)throw Error(data.error||'Landing conversions unavailable.');
    if(!controller.signal.aborted)setState({key,status:'ready',data});
   }catch(error){if(!controller.signal.aborted)setState({key,status:'error',error:error.message});}
  })();
  return()=>controller.abort();
 },[open,key,attempt]);
 const active=state?.key===key?state:null;
 const data=active?.status==='ready'?active.data:null;
 const rows=useMemo(()=>{
  const joined=leadImpact(groups,data);
  return joined.sort((a,b)=>sort==='contacts'?(b.lead.current?.contactSessions??-1)-(a.lead.current?.contactSessions??-1):sort==='loss'?(a.lead.contactChange??Infinity)-(b.lead.contactChange??Infinity):a.lead.order-b.lead.order||(b.lead.previous?.contactSessions??0)-(a.lead.previous?.contactSessions??0));
 },[groups,data,sort]);
 const activePage=Math.min(page,Math.max(0,Math.ceil(rows.length/size)-1));
 return <details data-tour="lead-impact" className="sem-gsc-context" onToggle={event=>setOpen(event.currentTarget.open)}>
  <summary><strong>Lead impact · Which ranking pages generate contacts?</strong></summary>
  {open&&<>
   <p>Uses the keyword and page filters above. Counts are for the whole landing page, not individual keywords.</p>
   {!key?<p role="status">Choose dates and load Search performance above.</p>:<>
    <p><strong>{period.start} to {period.end}</strong> vs {period.priorStart} to {period.priorEnd} · Pacific time for both GSC and this PostHog report.</p>
    {period.warnings?.map(w=><p className="gsc-date-warning" key={w}>{w}</p>)}
    {active?.status==='error'?<p role="alert">{active.error} <button className="button" onClick={()=>setAttempt(n=>n+1)}>Retry lead data</button></p>:!data?<p role="status">Loading landing-page contacts…</p>:<>
     <p>{rows.filter(g=>g.lead.current).length} of {rows.length} URL groups match a current landing cohort. Retrieved {new Date(data.fetchedAt).toLocaleString()}.</p>
     {(data.current.truncated||data.previous.truncated)&&<p className="gsc-date-warning">PostHog results reached the {data.current.limit.toLocaleString()}-page limit. Missing pages may fall outside returned rows.</p>}
     <label>Sort lead impact<select value={sort} onChange={e=>{setSort(e.target.value);setPage(0);}}><option value="priority">Suggested priority</option><option value="contacts">Most contact sessions</option><option value="loss">Largest contact decrease</option></select></label>
     <Pagination page={activePage} pageSize={size} total={rows.length} noun="landing pages" placement="lead impact" onPage={setPage} onSize={n=>{setSize(n);setPage(0);}}/>
     <div className="organic-table-scroll" role="region" aria-label="Landing-page lead impact" tabIndex={0}><table><thead><tr>{['Landing page','GSC clicks / change','Organic landing sessions','Contact sessions / prior','Contact change','Contact rate / change','Phone-click sessions','Priority / next step'].map(label=><th key={label}>{label}</th>)}</tr></thead>
      <tbody>{rows.slice(activePage*size,(activePage+1)*size).map(g=><tr key={g.url}>
       <th scope="row">{g.url?<a href={g.url} target="_blank" rel="noreferrer">{g.url}</a>:'No ranking URL'}<small>{g.pageTwo} matching keywords at positions 11–20</small></th>
       <td>{number(g.gsc?.current?.clicks)}<small>{signed(g.gsc?.clicksChange)}</small></td>
       <td>{number(g.lead.current?.sessions)}<small>Prior: {number(g.lead.previous?.sessions)}</small></td>
       <td><strong>{number(g.lead.current?.contactSessions)}</strong><small>Prior: {number(g.lead.previous?.contactSessions)}</small></td>
       <td>{signed(g.lead.contactChange)}</td>
       <td>{rate(g.lead.current?.rate)}<small>{g.lead.rateChange==null?'Not comparable':signed(Number(g.lead.rateChange.toFixed(2)))+' pp'}</small>{g.lead.current?.sessions<30&&<small>Small sample: fewer than 30 sessions</small>}</td>
       <td>{number(g.lead.current?.phoneSessions)}<small>Not confirmed calls</small></td>
       <td className="sem-finding"><strong>{g.lead.priority}</strong><small>{g.lead.action}</small><SaveOpportunity key={g.url+'-'+(snapshotId||'preview')} page={g.url} title={g.lead.priority} snapshotId={snapshotId} disabled={!canSave||!g.url} onSaved={onSaved}/></td>
      </tr>)}</tbody></table></div>
     {!rows.length&&<p>No pages match your filters.</p>}
    </>}
   </>}
   <details><summary>Attribution and limitations</summary><p>Organic landing sessions start on MedicareFAQ in the reporting period and include a MedicareFAQ page view from the CDN tracking stream. A contact session has a final step_3_contact submission on demographics.medicarecompared.com after that page view, within the same tracked session and reporting period. Each session counts once. Contact rate is contact sessions divided by those landing sessions; it is not leads divided by Google clicks. These are tracked contact submissions, not CRM-verified leads, unique people or policies sold.</p><p>PostHog covers all organic search engines; GSC covers Google web search. The existing Overview uses New York time; this report uses Pacific time to align with GSC. The older conversion report also includes other tracking streams, so totals can differ. Broken cross-domain continuity and submissions after the period ends are not credited. No keyword-level conversion attribution is inferred.</p><p>Landing matches use exact host and path, preserving www, case and trailing slashes. Protocol and query strings are not available in this grouping; ranking URLs with query strings are withheld. Small-sample flags use a 30-session screening threshold, not statistical significance. Priorities are investigation prompts, not causal conclusions. Data is cached for up to five minutes.</p></details>
  </>}
 </details>;
}
