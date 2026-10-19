'use client';
import {useEffect,useMemo,useRef,useState} from 'react';
import {compareQueryEvidence} from '../../lib/growth-hunter/keywords';
const number=value=>value.toLocaleString();
const percent=value=>(value*100).toFixed(2)+'%';
const position=value=>value.toFixed(2);
function Metric({prior,current,name,format=number}) {
 return <>{prior?format(prior[name]):'Unavailable'} → {current?format(current[name]):'Unavailable'}</>;
}
export default function KeywordResearch({runId,page,canRun}) {
 const [research,setResearch]=useState(null),[open,setOpen]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const [mode,setMode]=useState('declining'),[offset,setOffset]=useState(0);
 const controller=useRef(null);
 useEffect(()=>()=>controller.current?.abort(),[]);
 const comparison=useMemo(()=>research?compareQueryEvidence(research.payload):null,[research]);
 async function investigate() {
  if(research){setOpen(value=>!value);return;}
  if(busy)return;
  const requestController=new AbortController();controller.current=requestController;
  setBusy(true);setError('');setNotice('');
  try {
   const params=new URLSearchParams({runId,page});
   let response=await fetch('/api/growth-hunter/keywords?'+params,{cache:'no-store',signal:requestController.signal});
   let data=await response.json();if(!response.ok)throw new Error(data.error||'Keyword research is unavailable.');
   if(!data.research&&canRun){response=await fetch('/api/growth-hunter/keywords',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({runId,page}),signal:requestController.signal});data=await response.json();if(!response.ok)throw new Error(data.error||'Keyword research could not be saved.');}
   if(requestController.signal.aborted)return;
   if(data.research){setResearch(data.research);setOpen(true);setNotice(data.reused===false?'Keyword evidence saved.':'Opened saved keyword evidence.');}
   else setNotice('No keyword research saved for this page yet. An analyst can investigate it.');
  }catch(e){if(!requestController.signal.aborted)setError(e.message);}finally{if(!requestController.signal.aborted)setBusy(false);}
 }
 let rows=[];
 if(comparison){rows=mode==='priorOnly'?comparison.priorOnly.map(prior=>({query:prior.query,prior})):mode==='currentOnly'?comparison.currentOnly.map(current=>({query:current.query,current})):mode==='declining'?comparison.matched.filter(row=>row.lostClicks>0):comparison.matched;}
 return <section className="growth-keywords" aria-label={'Keyword research for '+page}>
  <button className="button" disabled={busy} onClick={investigate}>{busy?'Fetching keyword evidence…':research?(open?'Hide keyword research':'Open saved keyword research'):canRun?'Investigate keywords':'View saved keyword research'}</button>
  {error&&<p role="alert" className="growth-error">{error}</p>}
  {notice&&<p role="status" className="growth-muted">{notice}</p>}
  {open&&research&&<div>
   <h4>Which queries changed?</h4>
   <p>{research.payload.prior.start} to {research.payload.prior.end} → {research.payload.current.start} to {research.payload.current.end} · Pacific time</p>
   <p><strong>{comparison.decliningQueries} matched queries lost clicks.</strong> {comparison.matched.length} matched; {comparison.priorOnly.length} earlier-only; {comparison.currentOnly.length} later-only.</p>
   <p className="growth-note">Google omits some queries for privacy and reporting limits. Query totals may differ from page totals. Unavailable means no row was returned, not zero traffic. This evidence was fetched after the page analysis and may reflect later GSC revisions.</p>
   <label className="growth-run-select">Queries to review<select value={mode} onChange={e=>{setMode(e.target.value);setOffset(0);}}><option value="declining">Queries losing clicks</option><option value="matched">All matched queries</option><option value="priorOnly">Earlier period only</option><option value="currentOnly">Later period only</option></select></label>
   {!comparison.matched.length&&<p>No comparable query pairs were returned. This investigation cannot explain the page decline.</p>}
   {!rows.length?<p>No queries in this view.</p>:<>
    <div className="growth-table"><table><caption>Earlier → later metrics. Matched queries ordered by lost clicks; unmatched queries by observed clicks.</caption><thead><tr><th scope="col">Query</th><th scope="col">Clicks</th><th scope="col">Impressions</th><th scope="col">CTR</th><th scope="col">Average position</th><th scope="col">Investigation clues</th></tr></thead><tbody>{rows.slice(offset,offset+20).map(row=><tr key={row.query}><th scope="row">{row.query}</th><td><Metric prior={row.prior} current={row.current} name="clicks"/>{row.lostClicks>0&&<small className="growth-keyword-loss">{row.lostClicks} lost ({row.declinePercent}%)</small>}</td><td><Metric prior={row.prior} current={row.current} name="impressions"/></td><td><Metric prior={row.prior} current={row.current} name="ctr" format={percent}/></td><td><Metric prior={row.prior} current={row.current} name="position" format={position}/></td><td className="growth-query-clues">{row.patterns?.length?row.patterns.join('; '):row.prior&&row.current?'No click decline':'Missing comparison data; no decline inferred'}</td></tr>)}</tbody></table></div>
    <div className="growth-query-pagination"><button className="button" disabled={offset===0} onClick={()=>setOffset(value=>Math.max(0,value-20))}>Previous queries</button><span>{offset+1}–{Math.min(offset+20,rows.length)} of {rows.length}</span><button className="button" disabled={offset+20>=rows.length} onClick={()=>setOffset(value=>value+20)}>Next queries</button></div>
   </>}
   <details><summary>Evidence and pattern rules</summary><p>Exact page URL · MedicareFAQ URL-prefix property · finalized Web search · no country or device filters. Saved {new Date(research.created_at).toLocaleString()}; fetched {new Date(research.payload.fetchedAt).toLocaleString()}.</p><p>Clues apply only to matched queries losing clicks with at least 20 impressions in each period. Position worsened means an increase of at least 1; similar position means a change no greater than 0.5. Impression decline means at least 20%; CTR decline means at least 0.5 percentage points. These are pilot investigation rules, not proof of a cause. Average position is not a guaranteed rank.</p><p>The first investigation for this page and analysis is preserved. Reopening uses that saved evidence. Version {research.version} · Research {research.id.slice(0,8)}</p></details>
  </div>}
 </section>;
}
