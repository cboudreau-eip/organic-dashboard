'use client';
import {useEffect,useState} from 'react';
const fields=[['eipLeads','EIP leads'],['opportunities','Opportunities'],['grossMS','Gross MS'],['grossMA','Gross MA'],['approvedMS','Approved MS'],['approvedMA','Approved MA']];
const date=value=>new Date(value).toLocaleString('en-US',{timeZone:'UTC'})+' UTC';
export default function CohortHistory({month,exportedAt}){
 const [data,setData]=useState(null),[error,setError]=useState(''),[attempt,setAttempt]=useState(0);
 useEffect(()=>{const controller=new AbortController();setData(null);setError('');
  (async()=>{try{const r=await fetch('/api/analytics/datorama/checkpoints?'+new URLSearchParams({month}),{signal:controller.signal,cache:'no-store'});const body=await r.json();if(!r.ok)throw Error(body.error||'Could not load history.');if(!controller.signal.aborted)setData(body);}catch(e){if(!controller.signal.aborted)setError(e.message);}})();
  return()=>controller.abort();
 },[month,exportedAt,attempt]);
 return <section aria-label="Saved cohort checkpoints"><h4>Saved cohort checkpoints</h4>
  <p>Each distinct imported report is preserved automatically when this view loads and by a daily background check. This saves imported data; it does not download new Datorama data.</p>
  {!data&&!error&&<p role="status">Loading saved checkpoints…</p>}
  {error&&<p role="alert">{error}</p>}{data?.saveError&&<p role="alert">{data.saveError}</p>}
  <button className="button" type="button" onClick={()=>setAttempt(n=>n+1)}>Refresh saved history</button>
  {data?.checkpoints.length===0&&<p>No checkpoints have been saved for this cohort.</p>}
  {data?.checkpoints.length===1&&<p>First saved baseline. Changes will appear after another source export is imported. Reopening the same export does not add a checkpoint.</p>}
  {!!data?.checkpoints.length&&<div className="organic-table-scroll" role="region" aria-label="Cohort checkpoint values and changes" tabIndex={0}><table><thead><tr><th>Source export / saved date</th>{fields.map(([key,title])=><th key={key}>{title}</th>)}</tr></thead><tbody>{data.checkpoints.map(row=><tr key={row.id}><th scope="row">{date(row.sourceExportedAt)}<small className="datorama-conversion-note">Saved {date(row.savedAt)}</small><small className="datorama-conversion-note">Lead dates {row.start}–{row.end}{row.partial?' · Partial cohort':''}</small></th>{fields.map(([key])=>{const m=row.metrics[key];return <td key={key}>{m?.total==null?'Unavailable':m.total.toLocaleString('en-US')}{m?.missingDays>0&&<small className="datorama-conversion-note">{m.total==null?'Unreported':'Subtotal'} · {m.missingDays} missing days</small>}<small className="datorama-conversion-note">{m?.delta==null?'Change unavailable':`${m.delta>0?'+':''}${m.delta.toLocaleString('en-US')} vs previous export`}</small></td>;})}</tr>)}</tbody></table></div>}
  {data?.limited&&<p>Showing the latest 100 saved checkpoints. Older checkpoints remain stored.</p>}
  <p>Changes require the same complete lead-date range and complete values in both exports. Same-export corrections remain separate revisions without a growth comparison. Policy changes can reflect corrections or status updates; they are not a persistency rate.</p>
 </section>;
}
