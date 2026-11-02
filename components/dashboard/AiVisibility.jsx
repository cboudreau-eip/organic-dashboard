'use client';
import {useEffect,useState} from 'react';
import {REPORT_URL,reportPeriod} from '../../lib/otterly/report';
const count=v=>v==null?'Unavailable':v.toLocaleString();
const percent=v=>v==null?'Unavailable':v.toLocaleString(undefined,{maximumFractionDigits:2})+'%';
export default function AiVisibility({active}){
 const [data,setData]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[selection,setSelection]=useState(''),[message,setMessage]=useState('');
 useEffect(()=>{
  if(!active)return;
  const controller=new AbortController();setBusy(true);setError('');
  fetch('/api/otterly/reports'+(selection?'?id='+encodeURIComponent(selection):''),{cache:'no-store',signal:controller.signal}).then(async r=>{const d=await r.json();if(!r.ok)throw Error(d.error);setData(d);}).catch(e=>{if(!controller.signal.aborted)setError(e.message);}).finally(()=>{if(!controller.signal.aborted)setBusy(false);});
  return()=>controller.abort();
 },[active,selection]);
 async function sync(){
  setBusy(true);setError('');setMessage('');
  try{const r=await fetch('/api/otterly/reports',{method:'POST'}),d=await r.json();if(!r.ok)throw Error(d.error);setMessage(d.synced?'Report synced successfully.':d.message);
   const latest=await fetch('/api/otterly/reports',{cache:'no-store'}),next=await latest.json();if(!latest.ok)throw Error(next.error);setData(next);setSelection('');
  }catch(e){setError(e.message);}finally{setBusy(false);}
 }
 const report=data?.report?.payload,s=report?.summary,stale=report&&report.period.end<reportPeriod().end;
 const gaps=report?.prompts.filter(p=>p.mentions===0&&p.competitors.length>0)||[];
 return <section className="organic-live ai-visibility" aria-labelledby="ai-heading">
  <div className="organic-heading"><div><span className="organic-badge">OTTERLY · AI VISIBILITY</span><h2 id="ai-heading">How MedicareFAQ appears in AI answers</h2><p>Brand mentions and citations in monitored AI answers. These are not website visits, leads, or signed policies.</p></div><a className="button" href={REPORT_URL} target="_blank" rel="noreferrer">Open Otterly</a></div>
  <div className="ai-toolbar"><label>Saved report <select value={selection} onChange={e=>setSelection(e.target.value)} disabled={busy}><option value="">Latest report</option>{data?.history.map(r=><option key={r.id} value={r.id}>30 days ending {r.period_end}</option>)}</select></label>{data&&data.role!=='viewer'&&<button className="button" disabled={busy||!data.configured} onClick={sync}>{busy?'Working…':'Sync latest report'}</button>}</div>
  {busy&&<p role="status">Loading Otterly report…</p>}{error&&<p className="organic-error" role="alert">{error}</p>}{message&&<p role="status">{message}</p>}
  {data&&!data.configured&&<p className="organic-error">Otterly API access has not been configured.</p>}
  {data?.run?.status==='failed'&&<p className="organic-error">The latest sync failed. {data.run.message}</p>}
  {stale&&<p className="organic-error">{selection?'You are viewing a historical report.':'This saved report is behind the latest completed day.'} Check the dates below before using these figures.</p>}
  {data&&!report&&!busy&&<p>No Otterly report has been saved yet. An analyst can start the first sync.</p>}
  {report&&<>
   <p className="organic-freshness"><strong>{report.period.start} – {report.period.end}</strong> · United States · All monitored engines · {count(s.totalPrompts)} prompts · Synced {new Date(report.fetchedAt).toLocaleString()}</p>
   <div className="ai-kpis">{[['Brand coverage',percent(s.coverage),'Share of monitored answers mentioning MedicareFAQ.'],['MedicareFAQ mentions',count(s.mentions),'Mentions reported by Otterly across monitored answers.'],['MedicareFAQ page citations',report.pages.some(p=>p.citations==null)?'Unavailable':count(report.pages.reduce((total,p)=>total+p.citations,0)),'Citations of the MedicareFAQ URLs listed below; not unique people or answers.'],['Cited MedicareFAQ pages',count(report.pages.length),'Distinct reported URLs on medicarefaq.com or www.medicarefaq.com.']].map(([name,value,note])=><div className="card" key={name}><h3>{name}</h3><strong>{value}</strong><p>{note}</p></div>)}</div>
   <details className="organic-definitions"><summary>Scope, refresh schedule, and how to read this report</summary><p>Automatic daily sync at 14:00 UTC. Each saved report covers the last 30 completed calendar days, ending yesterday in America/New_York. Dates are sent to Otterly as calendar dates; Otterly’s underlying collection timezone is not supplied by this API.</p><p>Page rows are restricted to medicarefaq.com and www.medicarefaq.com. Brand mentions can appear in answers that cite other sites. Competitors below are comparison context and are never added to MedicareFAQ totals. Share of voice uses the configured competitor set. Missing values remain unavailable; zero is shown only when the source returns zero.</p><p>Daily snapshots preserve what Otterly reported at sync time. Adjacent snapshots overlap by 29 days and should not be summed. Historical prompt or engine changes can affect coverage. An empty list does not prove that no monitoring took place. This report uses its own dates, separate from the traffic and policy sections.</p></details>
   <h3>Visibility by AI platform</h3><div className="ai-table-wrap"><table><thead><tr><th>Platform</th><th>Brand coverage</th><th>Mentions</th><th>MedicareFAQ citations</th><th>Prompts</th></tr></thead><tbody>{report.engines.map(e=><tr key={e.id}><td>{e.label}</td><td>{percent(e.coverage)}</td><td>{count(e.mentions)}</td><td>{count(e.citations)}</td><td>{count(e.totalPrompts)}</td></tr>)}</tbody></table></div><p>Citations count references to medicarefaq.com and www.medicarefaq.com pages on each platform. Unavailable means the measurement was not saved, could not be retrieved, or the platform has no monitored prompts. It does not mean zero visibility.</p>
   <h3>MedicareFAQ pages cited in AI answers</h3><div className="ai-table-wrap"><table><thead><tr><th>Page</th><th>Citations</th></tr></thead><tbody>{report.pages.map(p=><tr key={p.url}><td><a href={p.url} target="_blank" rel="noreferrer">{p.title||p.url}</a><small>{p.url}</small></td><td>{count(p.citations)}</td></tr>)}</tbody></table></div>{!report.pages.length&&<p>No MedicareFAQ page citations were returned for this report.</p>}
   <h3>Prompts to investigate</h3><p>These prompts have zero reported MedicareFAQ mentions while a configured competitor has mentions. Review the answers in Otterly before deciding what content to change.</p>{gaps.length?<ul>{gaps.map(p=><li key={p.id}><strong>{p.prompt}</strong><p>Competitors mentioned: {p.competitors.map(c=>c.brand).join(', ')}</p></li>)}</ul>:<p>No competitor-only prompt gaps were returned for this period.</p>}
   <details className="organic-definitions"><summary>All monitored prompts ({report.prompts.length})</summary><div className="ai-table-wrap"><table><thead><tr><th>Prompt</th><th>MedicareFAQ mentions</th><th>Domain mentions</th></tr></thead><tbody>{report.prompts.map(p=><tr key={p.id}><td>{p.prompt}</td><td>{count(p.mentions)}</td><td>{count(p.domainMentions)}</td></tr>)}</tbody></table></div></details>
   <details className="organic-definitions"><summary>Daily brand coverage</summary><div className="ai-table-wrap"><table><thead><tr><th>Date</th><th>MedicareFAQ coverage</th></tr></thead><tbody>{s.history.map(h=><tr key={h.date}><td>{h.date.slice(0,10)}</td><td>{percent(h.coverage)}</td></tr>)}</tbody></table></div></details>
   <details className="organic-definitions"><summary>Competitor comparison — separate from our totals</summary><div className="ai-table-wrap"><table><thead><tr><th>Brand</th><th>Brand coverage</th><th>Share of voice in this competitor set</th></tr></thead><tbody>{s.competitors.map(c=><tr key={c.brand}><td>{c.brand}{c.main?' (MedicareFAQ)':''}</td><td>{percent(c.coverage)}</td><td>{percent(c.shareOfVoice)}</td></tr>)}</tbody></table></div></details>
  </>}
 </section>;
}
