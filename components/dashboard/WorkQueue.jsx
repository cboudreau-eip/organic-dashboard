'use client';
import {useEffect,useState} from 'react';
import {WORK_STATUSES,workTitle,exportWorkMarkdown} from '../../lib/work-queue/model';
import './content-plan.css';
import './work-queue.css';
async function request(input){const r=await fetch('/api/content-work',input?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(input)}:{cache:'no-store'}),d=await r.json();if(!r.ok)throw Error(d.error||'Unable to load the work queue.');return d;}
function TaskEditor({entry,queue,canEdit,busy,onSave,onDirty,onExport}){
 const [owner,setOwner]=useState(entry.owner),[status,setStatus]=useState(entry.status),[brief,setBrief]=useState(entry.brief);
 const dirty=owner!==entry.owner||status!==entry.status||brief!==entry.brief;
 useEffect(()=>{onDirty(dirty);return()=>onDirty(false);},[dirty,onDirty]);
 useEffect(()=>{if(!dirty)return;const warn=e=>{e.preventDefault();e.returnValue='';};window.addEventListener('beforeunload',warn);return()=>window.removeEventListener('beforeunload',warn);},[dirty]);
 return <section className="work-editor" aria-label="Pilot task editor"><span className="plan-eyebrow">{entry.snapshot.category} · Planned {entry.planned_date}</span><h3>{workTitle(entry)}</h3><p>{entry.snapshot.targetUrl?<a href={entry.snapshot.targetUrl} target="_blank" rel="noreferrer">Open target page ↗</a>:'Target page unconfirmed'}</p>
 <form onSubmit={e=>{e.preventDefault();onSave({owner,status,brief});}}><fieldset disabled={!canEdit||busy}>
 <div className="work-fields"><label>Owner<input maxLength={120} value={owner} onChange={e=>setOwner(e.target.value)} placeholder="Unassigned — name or team"/></label><label>Work status<select value={status} onChange={e=>setStatus(e.target.value)}>{WORK_STATUSES.map(s=><option key={s}>{s}</option>)}</select></label></div>
 <p className="research-help">Owner is a work label, not an invitation or access permission. Status tracks work only; choosing Published does not publish anything.</p>
 <label>Implementation brief<textarea rows={18} required maxLength={20000} value={brief} onChange={e=>setBrief(e.target.value)}/></label>
 <div className="plan-toolbar"><button type="submit" disabled={!dirty||busy}>Save task</button>{dirty&&<button type="button" onClick={()=>{setOwner(entry.owner);setStatus(entry.status);setBrief(entry.brief);}}>Discard unsaved changes</button>}<span>{dirty?'Unsaved changes — save before switching tasks or exporting.':'All changes saved'}</span></div></fieldset></form>
 <button disabled={busy||dirty} onClick={()=>onExport(entry.assignment_id)}>Export task Markdown</button>
 <details><summary>Original assignment and evidence</summary><p>{entry.snapshot.action}</p><p><strong>Queries: </strong>{entry.snapshot.terms?.join(' · ')}</p>{entry.snapshot.notes&&<p><strong>Saved assignment notes: </strong>{entry.snapshot.notes}</p>}<p>{entry.snapshot.verification}</p><p>The exported brief includes the saved source evidence. These are planning instructions, not a drafted article.</p></details></section>;
}
export default function WorkQueue({active,onDirtyChange}){
 const [data,setData]=useState(null),[error,setError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false),[selected,setSelected]=useState(null),[dirty,setDirty]=useState(false),[retry,setRetry]=useState(0);
 useEffect(()=>{onDirtyChange?.(dirty);return()=>onDirtyChange?.(false);},[dirty,onDirtyChange]);
 useEffect(()=>{if(!active)return;let live=true;request().then(d=>{if(live){setData(d);setSelected(d.queue?.entries[0]?.assignment_id||null);}}).catch(e=>{if(live)setError(e.message);});return()=>{live=false;};},[active,retry]);
 async function mutate(input){setBusy(true);setError('');try{const d=await request(input);setData(old=>({...old,queue:d.queue}));setSelected(current=>current||d.queue.entries[0].assignment_id);setDirty(false);setNotice(input.action==='start'?'Five pilot assignments saved. Calendar edits and planned dates are unchanged.':'Task saved. Your calendar is unchanged.');}catch(e){setError(e.message);}finally{setBusy(false);}}
 function download(id){const markdown=exportWorkMarkdown(data.queue,id),url=URL.createObjectURL(new Blob([markdown],{type:'text/markdown;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download='medicarefaq-'+(id?'task-'+id:'work-pilot-'+data.queue.week_start)+'.md';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);setNotice('Markdown exported from the saved queue. No article was generated or published.');}
 const queue=data?.queue,entry=queue?.entries.find(e=>e.assignment_id===selected);
 return <section className="content-plan work-pilot" aria-label="This week work queue"><header className="plan-heading"><div><span className="plan-eyebrow">CONTENT OPERATIONS · FIVE-ASSIGNMENT PILOT</span><h2>This week</h2><p>A focused work queue for the first five assignments in your saved calendar.</p></div>{queue&&<button disabled={busy||dirty} onClick={()=>download()}>Export pilot Markdown</button>}</header>
 {error&&<p role="alert">{error} <button disabled={busy||dirty} onClick={()=>{setError('');setRetry(n=>n+1);}}>Reload queue</button></p>}{notice&&<p role="status">{notice}</p>}
 {!data&&!error&&<p role="status">Loading the work queue…</p>}
 {data&&!queue&&<div className="work-empty"><h3>Start with five assignments</h3><p>Uses the first five assignments by planned date from your latest saved calendar, including your existing edits. Owners start unassigned and work statuses start Tentative. The brief begins with the saved assignment instructions.</p><button disabled={!data.canEdit||!data.plan||busy} onClick={()=>mutate({action:'start',planId:data.plan.id,version:data.plan.version})}>{busy?'Starting pilot…':'Start five-assignment pilot'}</button></div>}
 {queue&&<><p className="plan-notice"><strong>Planned week: {queue.week_start} – {new Date(Date.parse(queue.week_start+'T12:00:00Z')+6*86400000).toISOString().slice(0,10)}</strong>. This is the calendar’s planned week, not the current week. All calendar dates remain tentative.</p>
 <div className="work-counts">{WORK_STATUSES.map(s=><span key={s}><strong>{queue.entries.filter(e=>e.status===s).length}</strong> {s}</span>)}</div>
 <p className="research-help">This pilot preserves the assignments as they were when started. Owner, status and brief edits are saved separately; later calendar revisions do not overwrite them.</p>
 <div className="work-layout"><nav className="work-tasks" aria-label="Pilot assignments">{queue.entries.map(e=><button disabled={busy||dirty} aria-pressed={selected===e.assignment_id} key={e.assignment_id} onClick={()=>setSelected(e.assignment_id)}><span>{e.planned_date} · {e.status}</span><strong>{workTitle(e)}</strong><small>{e.owner||'Unassigned'}</small></button>)}</nav>
 {entry&&<TaskEditor key={queue.id+':'+queue.version+':'+entry.assignment_id} entry={entry} queue={queue} canEdit={data.canEdit} busy={busy} onDirty={setDirty} onExport={download} onSave={fields=>mutate({action:'save',queueId:queue.id,version:queue.version,assignmentId:entry.assignment_id,...fields})}/>}</div></>}
 </section>;
}
