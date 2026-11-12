'use client';
import {useState} from 'react';
import {PLAN_STATUSES} from '../../lib/content-plan/contracts';
export default function ContentPlanEditor({item,canEdit,onSaved}){
 const [owner,setOwner]=useState(item.owner||''),[brief,setBrief]=useState(item.brief||''),[status,setStatus]=useState(item.status),[approved,setApproved]=useState(item.approved||false),[date,setDate]=useState(item.scheduledDate||'');
 const [busy,setBusy]=useState(false),[message,setMessage]=useState('');
 async function save(event){event.preventDefault();setBusy(true);setMessage('');try{
  const response=await fetch('/api/content-plan',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:item.id,version:item.version,status,owner,brief,approved,scheduledDate:date||null})});
  const data=await response.json();if(!response.ok)throw Error(data.error||'Save failed.');onSaved(data.item);
 }catch(error){setMessage(error.message);}finally{setBusy(false);}}
 if(!canEdit)return <section><h4>Saved plan</h4><p>{item.status} · {item.owner||'Unassigned'} · {item.scheduledDate||'Unscheduled'}</p><p style={{whiteSpace:'pre-wrap'}}>{item.brief||'No editorial brief saved yet.'}</p><p>Your access is view-only.</p></section>;
 return <form onSubmit={save} className="plan-editor"><h4>Review and save this opportunity</h4><label>Owner<input maxLength={120} value={owner} onChange={e=>setOwner(e.target.value)}/></label><label>Editorial brief<textarea rows={8} maxLength={12000} value={brief} onChange={e=>setBrief(e.target.value)} placeholder="Outline, internal links, sources to verify, and the reader’s next step…"/></label><label><input type="checkbox" checked={approved} onChange={e=>{setApproved(e.target.checked);if(!e.target.checked){setDate('');setStatus('Needs review');}}}/> I have reviewed and approved this opportunity</label><label>Status<select value={status} onChange={e=>setStatus(e.target.value)}>{PLAN_STATUSES.map(value=><option key={value} disabled={!approved&&!['Needs review','Deferred'].includes(value)}>{value}</option>)}</select></label><label>Planned publication date<input type="date" min="2027-01-01" max="2027-03-31" value={date} disabled={!approved} onChange={e=>setDate(e.target.value)}/></label><p>Leave the date blank until the publishing schedule is agreed.</p><button disabled={busy}>{busy?'Saving…':'Save opportunity'}</button>{message&&<p role="alert">{message}</p>}</form>;
}
