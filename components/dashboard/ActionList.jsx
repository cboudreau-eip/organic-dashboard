'use client';
import {useEffect,useState} from 'react';
import CollapsibleSection from './CollapsibleSection';
import {ACTION_STATUSES,actionWindow,todayPacific} from '../../lib/growth-hunter/actions';
const label=s=>s.replaceAll('_',' ').replace(/^./,c=>c.toUpperCase());
async function api(query='',init){
 const r=await fetch('/api/growth-hunter/actions'+query,{cache:'no-store',...init});
 const data=await r.json();if(!r.ok)throw Error(data.error||'Action request failed.');return data;
}
const num=n=>n==null?'Not reported':n.toLocaleString(undefined,{maximumFractionDigits:2});
function Outcome({record,action}){
 const p=record.payload,rows=[
 ['GSC clicks',p.gsc.row?.previous?.clicks,p.gsc.row?.current?.clicks,''],
 ['GSC impressions',p.gsc.row?.previous?.impressions,p.gsc.row?.current?.impressions,''],
 ['Organic landing sessions',p.leads.before?.sessions,p.leads.after?.sessions,''],
 ['Contact sessions',p.leads.before?.contactSessions,p.leads.after?.contactSessions,''],
 ['Contact rate',p.leads.before?.rate,p.leads.after?.rate,'%'],
 ['Phone-click sessions',p.leads.before?.phoneSessions,p.leads.after?.phoneSessions,'']
 ];
 return <details className="sem-gsc-context"><summary>{record.window_days}-day results · Saved {new Date(record.created_at).toLocaleString()}</summary>
  {record.published_on!==action.published_on&&<p role="status">Historical result for a different publication date: {record.published_on}.</p>}
  <p><strong>Before:</strong> {p.period.priorStart} to {p.period.priorEnd} · <strong>After:</strong> {p.period.start} to {p.period.end} · Pacific time. Recorded against action revision {record.action_version}.</p>
  <div className="organic-table-scroll"><table><thead><tr><th>Metric</th><th>Before</th><th>After</th><th>Observed change</th></tr></thead><tbody>{rows.map(([name,a,b,unit])=><tr key={name}><th scope="row">{name}</th><td>{num(a)}{a!=null?unit:''}</td><td>{num(b)}{b!=null?unit:''}</td><td>{a==null||b==null?'Not comparable':(b-a>0?'+':'')+num(b-a)+(unit?' pp':'')}</td></tr>)}</tbody></table></div>
  {p.leads.after?.sessions<30&&<p>Small sample: fewer than 30 after-period sessions. Rate changes may be unstable.</p>}
  <p>Missing source rows are not zero. GSC returned {p.gsc.coverage.previous}/{p.gsc.coverage.current} before/after pages (limit {p.gsc.limit}); PostHog rows {p.leads.beforeTruncated||p.leads.afterTruncated?'reached the limit':'did not reach the limit'} ({p.leads.limit}).</p>
  <h4>Tracked rankings</h4>
  <p>{p.rankings.available?p.rankings.comparable+' comparable keywords: '+p.rankings.improved+' improved, '+p.rankings.declined+' declined.':'A complete compatible snapshot pair is unavailable.'}</p>
  <p>Before snapshot: {p.rankings.beforeDate||'Unavailable'} · After snapshot: {p.rankings.afterDate||'Unavailable'}.</p>
  {p.rankings.scope&&<p>{p.rankings.scope.location} · {p.rankings.scope.device} · {p.rankings.scope.engine}</p>}
  {p.rankings.rows?.length>0&&<div className="organic-table-scroll"><table><thead><tr><th>Keyword</th><th>Before rank</th><th>After rank</th><th>Improvement</th></tr></thead><tbody>{p.rankings.rows.map(r=><tr key={r.keyword}><th scope="row">{r.keyword}</th><td>{r.before}</td><td>{r.after}</td><td>{r.change>0?'+':''}{r.change}</td></tr>)}</tbody></table></div>}
  <p>{p.rankings.note} Up to 100 keyword details shown.</p><p>{p.disclaimer}</p>
 </details>;
}
function Editor({action,canEdit,busy,onSave}){
 const [title,setTitle]=useState(action.title),[notes,setNotes]=useState(action.notes),[status,setStatus]=useState(action.status),[published,setPublished]=useState(action.published_on||'');
 return <form onSubmit={e=>{e.preventDefault();onSave({id:action.id,version:action.version,title,notes,status,published_on:published||null});}}>
 <fieldset disabled={!canEdit||busy}><legend>Work and publication details</legend>
 <label>Action title<input required maxLength={160} value={title} onChange={e=>setTitle(e.target.value)}/></label>
 <label>Status<select value={status} onChange={e=>setStatus(e.target.value)}>{ACTION_STATUSES.map(s=><option key={s} value={s}>{label(s)}</option>)}</select></label>
 <label>Publication date (Pacific)<input type="date" min="2000-01-01" max={todayPacific()} value={published} required={['published','monitoring'].includes(status)} onChange={e=>setPublished(e.target.value)}/></label>
 <label>What changed / work notes<textarea rows={5} maxLength={4000} value={notes} onChange={e=>setNotes(e.target.value)} placeholder="What you plan to change, what you published, and anything that may affect the results."/></label>
 <button className="button primary" type="submit">{busy?'Saving…':'Save changes'}</button>
 </fieldset></form>;
}
export default function ActionList({refresh=0}){
 const [data,setData]=useState(null),[error,setError]=useState(''),[notice,setNotice]=useState(''),[attempt,setAttempt]=useState(0);
 const [status,setStatus]=useState('all'),[offset,setOffset]=useState(0),[detail,setDetail]=useState(null),[busy,setBusy]=useState(false);
 useEffect(()=>{
  let active=true;setError('');setData(null);
  api('?status='+status+'&offset='+offset).then(d=>{if(active)setData(d);}).catch(e=>{if(active)setError(e.message);});
  return()=>{active=false;};
 },[refresh,attempt,status,offset]);
 async function open(id){
  setBusy(true);setError('');setNotice('');
  try{setDetail(await api('?id='+id));}catch(e){setError(e.message);}finally{setBusy(false);}
 }
 async function save(input){
  setBusy(true);setError('');setNotice('');
  try{const d=await api('',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(input)});
   setDetail(previous=>({...previous,action:d.action}));setNotice('Changes saved.');setAttempt(n=>n+1);
  }catch(e){setError(e.message);}finally{setBusy(false);}
 }
 async function measure(days){
  setBusy(true);setError('');setNotice('');
  try{await api('',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({operation:'measure',id:detail.action.id,version:detail.action.version,days})});
   setDetail(await api('?id='+detail.action.id));setNotice('Before/after results saved.');
  }catch(e){setError(e.message);}finally{setBusy(false);}
 }
 const canEdit=['analyst','admin'].includes(detail?.role||data?.role);
 return <CollapsibleSection id="growth-action-list" className="sem-history" title="Saved actions" level={3} header={<h3>Saved actions · Work and results</h3>}>
 <p>Save a page opportunity below, record your work here, then measure observed results after publication. Status changes record your work; they do not publish website edits.</p>
 {error&&<p role="alert">{error} <button className="button" disabled={busy} onClick={()=>setAttempt(n=>n+1)}>Reload list</button>{detail&&<button className="button" disabled={busy} onClick={()=>open(detail.action.id)}>Reload selected action</button>}</p>}
 {notice&&<p role="status">{notice}</p>}
 <label>Filter status<select value={status} onChange={e=>{setStatus(e.target.value);setOffset(0);}}><option value="all">All statuses</option>{ACTION_STATUSES.map(s=><option key={s} value={s}>{label(s)}</option>)}</select></label>
 {!data&&!error&&<p role="status">Loading saved actions…</p>}
 {data&&<>
 <p>{data.total} saved actions match this filter.</p>
 {!data.actions.length?<p>No saved actions in this view.</p>:<ul>{data.actions.map(a=><li key={a.id}><span><strong>{a.title}</strong><small>{a.page}</small><small>{label(a.status)} · Published {a.published_on||'not yet'} · Updated {new Date(a.updated_at).toLocaleDateString()}</small></span><button className="button" disabled={busy} onClick={()=>open(a.id)}>Open action</button></li>)}</ul>}
 <div className="sem-page-numbers" role="group" aria-label="Saved action pages">{Array.from({length:Math.ceil(data.total/25)},(_,i)=>i).filter(i=>i===0||i===Math.ceil(data.total/25)-1||Math.abs(i-offset/25)<=2).map(i=><button className="button" key={i} aria-current={i===offset/25?'page':undefined} onClick={()=>setOffset(i*25)}>{i+1}</button>)}</div>
 </>}
 {detail&&<section className="sem-gsc-context" aria-label="Selected saved action">
  <h4>{detail.action.title}</h4><a href={detail.action.page} target="_blank" rel="noreferrer">{detail.action.page}</a>
  <Editor key={detail.action.id+'-'+detail.action.version} action={detail.action} canEdit={canEdit} busy={busy} onSave={save}/>
  <h4>Measure results</h4><p>Equal windows before and after publication; publication day is excluded. Save your edits before measuring. Results are saved on request, not scheduled automatically.</p>
  {[7,28].map(days=>{let waiting='';try{actionWindow(detail.action.published_on,days);}catch(e){waiting=e.message;}
   return <div key={days}><button className="button" disabled={busy||!canEdit||!!waiting||!['published','monitoring'].includes(detail.action.status)} onClick={()=>measure(days)}>{busy?'Working…':'Measure '+days+' days'}</button><small>{waiting||'Ready to check finalized source data.'}</small></div>;
  })}
  <p>Newest 10 saved measurements. Earlier publication dates remain labeled on historical results.</p>
  {detail.results.map(record=><Outcome key={record.id} record={record} action={detail.action}/>)}
  <details><summary>Work history ({detail.action.history.length} revisions)</summary>{[...detail.action.history].reverse().map(h=><div key={h.version}><strong>Revision {h.version} · {label(h.status)}</strong><p>{new Date(h.at).toLocaleString()} · Published {h.published_on||'not yet'}</p><p>{h.title}</p><p style={{whiteSpace:'pre-wrap'}}>{h.notes||'No work notes recorded.'}</p></div>)}</details>
  <button className="button" disabled={busy} onClick={()=>setDetail(null)}>Close action</button>
 </section>}
 </CollapsibleSection>;
}
