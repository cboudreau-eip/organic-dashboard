'use client';
import {useState,useEffect} from 'react';
import {declineSuggestion,declineNotes} from '../../lib/growth-hunter/decline-plan';
import {leadImpact} from '../../lib/semrush/lead-impact';
export default function DeclinePlan({run,finding,research,canRun,onSaved,onContacts}){
 const [plan,setPlan]=useState(()=>declineSuggestion(finding)),[report,setReport]=useState(null),[load,setLoad]=useState(0),[loading,setLoading]=useState(false),[busy,setBusy]=useState(false),[saved,setSaved]=useState(false),[error,setError]=useState('');
 useEffect(()=>{
  if(!load)return;const controller=new AbortController();setLoading(true);setReport(null);setError('');
  const p=run.result,params=new URLSearchParams({mode:'custom',compare:'custom',start:p.currentPeriod.start,end:p.currentPeriod.end,priorStart:p.priorPeriod.start,priorEnd:p.priorPeriod.end});
  (async()=>{try{const r=await fetch('/api/analytics/lead-pages?'+params,{cache:'no-store',signal:controller.signal}),d=await r.json();if(!r.ok)throw Error(d.error||'Contact data unavailable.');if(!controller.signal.aborted){setReport(d);onContacts?.(leadImpact([{url:finding.url}],d)[0].lead);}}catch(e){if(!controller.signal.aborted){setError(e.message);onContacts?.({current:null,previous:null});}}finally{if(!controller.signal.aborted)setLoading(false);}})();
  return()=>controller.abort();
 },[load,run]);
 const lead=leadImpact([{url:finding.url}],report)[0].lead;
 const notes=declineNotes(run,finding,plan,research,report,lead);
 async function save(e){e.preventDefault();setBusy(true);setError('');try{
  const r=await fetch('/api/growth-hunter/actions',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({page:finding.url,title:'Investigate Google click decline',notes})}),d=await r.json();if(!r.ok)throw Error(d.error||'Could not save action.');setSaved(true);onSaved?.();
 }catch(e){setError(e.message);}finally{setBusy(false);}}
 return <section data-tour="decline-plan" aria-label={'Suggested next step for '+finding.url}>
 <h4>Suggested next step · approve or edit</h4><p>This is an investigation suggestion based on page-level signals, not a diagnosis or an instruction to change the website.</p>
 <div data-tour="decline-contacts"><button className="button" disabled={loading} onClick={()=>setLoad(v=>v+1)}>{loading?'Loading matching dates…':'Check organic traffic and contacts'}</button>
 {report&&<><p>PostHog · same Pacific dates as this analysis · tracked contact submissions, not policies.</p><p>Organic landing sessions: {lead.previous?.sessions??'Unavailable'} → {lead.current?.sessions??'Unavailable'} · Contact sessions: {lead.previous?.contactSessions??'Unavailable'} → {lead.current?.contactSessions??'Unavailable'}</p>{(report.current.truncated||report.previous.truncated)&&<p>Row limit reached. Missing pages are not zero.</p>}</>}</div>
 <form onSubmit={save}><label>Proposed next step<textarea rows={4} maxLength={1000} value={plan} disabled={!canRun||busy||saved} onChange={e=>setPlan(e.target.value)}/></label>
 <details><summary>Evidence attached automatically</summary><p style={{whiteSpace:'pre-wrap'}}>{notes}</p></details>
 {canRun?<button className="button primary" disabled={busy||saved||loading||!plan.trim()||notes.length>4000}>{saved?'Action saved':busy?'Saving…':'Approve and save action'}</button>:<p>An analyst can approve and save this action.</p>}
 {saved&&<p role="status">Saved with dates and evidence. Open it in Saved decline actions below. No website changes were made.</p>}{error&&<p role="alert">{error}</p>}</form></section>;
}
