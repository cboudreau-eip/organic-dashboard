'use client';
import {useEffect,useRef,useState} from 'react';
async function api(queueId,assignmentId,input){
 const r=await fetch(input?'/api/content-work/assessment':`/api/content-work/assessment?queueId=${encodeURIComponent(queueId)}&assignmentId=${encodeURIComponent(assignmentId)}`,input?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({queueId,assignmentId,...input})}:{cache:'no-store'});
 const d=await r.json();if(!r.ok)throw Error(d.error||'Unable to prepare the assessment. Please retry.');return d;
}
export default function WorkAssessment({queueId,entry,enabled,canEdit,dirty,busy,brief,onUse}){
 const [data,setData]=useState(null),[selected,setSelected]=useState(null),[loading,setLoading]=useState(false),[error,setError]=useState(''),[revision,setRevision]=useState(0);
 const alive=useRef(true),started=useRef(false);
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
 useEffect(()=>{
  if(!enabled||started.current)return;started.current=true;let canceled=false;
  async function load(){setLoading(true);setError('');try{
   const d=await api(queueId,entry.assignment_id);if(canceled)return;setData(d);setSelected(d.current?.id||null);
   const running=d.history.some(r=>r.status==='running'&&Date.now()-Date.parse(r.created_at)<5*60000);
   if(!d.current&&!d.history.some(r=>r.status==='complete')&&d.hasTarget&&canEdit&&!dirty&&!busy&&!running&&d.history[0]?.status!=='failed'){
    const result=await api(queueId,entry.assignment_id,{fingerprint:d.fingerprint});if(canceled)return;
    setData({...d,current:result.assessment,history:[result.assessment,...d.history]});setSelected(result.assessment.id);
   }else if(running)setError('An assessment is running. Use Check saved assessment in a moment.');
   else if(!d.current&&d.history[0]?.status==='failed')setError(d.history[0].error||'The last assessment failed. Please retry.');
  }catch(e){if(!canceled)setError(e.message);}finally{if(!canceled)setLoading(false);}}
  load();return()=>{canceled=true;started.current=false;};
 },[enabled,queueId,entry.assignment_id,revision]);
 async function refresh(){if(dirty||busy||loading)return;setLoading(true);setError('');try{
  const d=await api(queueId,entry.assignment_id);if(!alive.current)return;setData(d);
  const r=await api(queueId,entry.assignment_id,{fingerprint:d.fingerprint,refresh:true});if(!alive.current)return;
  setData({...d,current:r.assessment,history:[r.assessment,...d.history]});setSelected(r.assessment.id);
 }catch(e){if(alive.current)setError(e.message);}finally{if(alive.current)setLoading(false);}}
 async function verifyOutstanding(){if(dirty||busy||loading||!data?.current)return;setLoading(true);setError('');try{
  const r=await api(queueId,entry.assignment_id,{action:'verify',assessmentId:data.current.id,fingerprint:data.fingerprint});if(!alive.current)return;
  setData({...data,current:r.assessment,history:[r.assessment,...data.history.filter(h=>h.id!==r.assessment.id)]});setSelected(r.assessment.id);
 }catch(e){if(alive.current)setError(e.message);}finally{if(alive.current)setLoading(false);}}
 const row=data?.history.find(r=>r.id===selected),p=row?.payload,result=p?.result,current=!!row&&row.id===data?.current?.id;
 const appended=p?.brief&&brief.includes(p.brief),tooLong=p?.brief&&brief.length+p.brief.length+2>20000;
 const outstanding=p?.verification?p.verification.items.filter(i=>['Unresolved','Partially resolved'].includes(i.status)).length:(result?.changes.filter(c=>c.needsVerification).length||0)+(result?.checks.length||0);
 return <section className="work-assessment" aria-label="Page assessment and brief">
  <header><div><h4>Page assessment & brief</h4><p>Live page review and specific editing recommendations, saved separately from your instructions.</p></div></header>
  {!enabled&&<p>Open this task to prepare its page assessment.</p>}
  {loading&&<p role="status">Reading the page, checking sources and reviewing your brief… This can take a few minutes. Your instructions stay unchanged.</p>}
  {error&&<p role="alert">{error}</p>}
  {enabled&&data&&!data.hasTarget&&<p>Choose a MedicareFAQ target page in Calendar → Edit assignment details first.</p>}
  {enabled&&!loading&&data&&!data.current&&data.history.some(r=>r.status==='complete')&&<p>Your saved assessment needs refreshing. Select Reassess page to update it.</p>}
  {enabled&&!loading&&<div className="work-assessment-actions"><button type="button" disabled={!canEdit||dirty||busy||data?.hasTarget===false} onClick={refresh}>{row||data?.history.some(r=>r.status==='complete')?'Reassess page':'Prepare assessment'}</button><button type="button" disabled={dirty||busy} onClick={()=>{started.current=false;setRevision(n=>n+1);}}>Check saved assessment</button></div>}
  {result&&<>
   <p className="work-assessment-meta">{current?'Current saved assessment':'Earlier assessment — reassess before using'} · {new Date(row.created_at).toLocaleString()} · AI-assisted proposal</p>
   <p>{result.summary}</p>
   <div className="work-assessment-actions"><button type="button" disabled={!current||!canEdit||dirty||busy||loading||!outstanding} onClick={verifyOutstanding}>Verify outstanding items</button><span>{outstanding} outstanding {outstanding===1?'item':'items'}</span></div>
   {p.verification?.version===2&&<>
    <section aria-label="Ready to implement"><h5>Ready to implement</h5><p>These instructions passed source review. Apply only their stated scope.</p>{p.verification.items.filter(v=>v.status!=='Unresolved').map(v=><article key={v.id}><strong>{v.group||v.section}</strong><p>{v.instruction}</p><small>Where: {v.section}{v.status==='Partially resolved'?' · Separate questions remain below':''}</small></article>)}{!p.verification.items.some(v=>v.status!=='Unresolved')&&<p>No supported editing instructions yet. Review the missing evidence below.</p>}</section>
    <section aria-label="Unresolved items"><h5>Unresolved — do not use as claims</h5>{p.verification.items.filter(v=>['Unresolved','Partially resolved'].includes(v.status)).map(v=><article key={v.id}><strong>{v.group||v.section}</strong><p>{v.remainingQuestion||v.reason}</p><small>Use Verify outstanding items to research this question inside the tool. Until supported, omit this detail; ready changes above can still proceed.</small></article>)}{!outstanding&&<p>No outstanding research questions in this assessment.</p>}</section>
   </>}
   {p.verification&&<section aria-label="Verification results"><h5>Verification results</h5><p>Saved {new Date(p.verification.checkedAt).toLocaleString()} · The corrected brief is saved separately from your instructions.</p>{p.verification.items.map(v=><details key={v.id}><summary><strong>{v.status}</strong> · {v.section}</summary><p><strong>Original question:</strong> {v.question}</p><p><strong>{v.status==='Unresolved'?'Still needs an answer':'Supported instruction'}:</strong> {v.status==='Unresolved'?v.remainingQuestion||v.reason:v.instruction}</p>{v.status==='Partially resolved'&&<p>Still unresolved: {v.remainingQuestion}</p>}<p>{v.reviewReason}</p>{[...(v.evidence||[]),...(v.reviewEvidence||[])].map((e,i)=><blockquote key={i}><p>{e.text}{e.excerptLimited?'… (excerpt; open source for full context)':''}</p><a href={e.url} target="_blank" rel="noreferrer">{e.page?`PDF page ${e.page} (document label ${e.pageLabel})`:'Source'} ↗</a><small> · Read {new Date(e.fetchedAt).toLocaleDateString()}</small></blockquote>)}</details>)}<details><summary>Research attempts</summary>{p.verification.attempts.map((a,i)=><p key={i}>{a.status} · {a.url||a.query}{a.urls?.length?' · '+a.urls.join(', '):''}{a.pages?.length?' · PDF pages '+a.pages.join(', '):''}</p>)}</details></section>}
   {p.verification?.version!==2&&<><h5>Recommended changes</h5><ol className="work-assessment-changes">{result.changes.map((c,i)=><li key={i}><strong>{c.section}</strong><p>{c.change}</p><details><summary>Why and supporting sources{c.needsVerification?' · verification needed':''}</summary><p>{c.why}</p>{!c.evidence.length&&<p>No supporting passage retrieved. Verify this task before implementation.</p>}{c.evidence.map((e,n)=><blockquote key={n}><p>{e.text}</p><a href={e.url} target="_blank" rel="noreferrer">{e.kind==='official'?'Official source':e.kind==='target'?'Current target page':'Related page'} ↗</a></blockquote>)}</details></li>)}</ol></>}
   <details><summary>Suggested outline, what to preserve and internal links</summary><h5>Suggested outline</h5><ol>{result.outline.map((x,i)=><li key={i}>{x}</li>)}</ol><h5>Preserve</h5><ul>{result.preserve.map((x,i)=><li key={i}>{x}</li>)}</ul><h5>Internal links</h5>{result.links.map((x,i)=><p key={i}><a href={x.url} target="_blank" rel="noreferrer">{x.url.replace('https://www.medicarefaq.com','')}</a> — {x.reason}</p>)}</details>
   <details><summary>Checks before publication and source dates</summary><ul>{[...result.checks,...p.warnings].map((x,i)=><li key={i}>{x}</li>)}</ul><p>Source references support review; they do not guarantee factual accuracy or ranking improvements.</p><ul>{p.sources.map(s=><li key={s.id}><a href={s.url} target="_blank" rel="noreferrer">{s.kind}: {s.url}</a> · Read {new Date(s.fetchedAt).toLocaleDateString()}{s.truncated?' · excerpt limited':''}</li>)}</ul><pre>{JSON.stringify(p.sourceDates,null,2)}</pre></details>
   <details><summary>{p.verification?'Corrected implementation brief':'Generated implementation brief'}</summary><pre>{p.brief}</pre></details>
   <button type="button" disabled={!canEdit||!current||loading||busy||dirty||appended||tooLong} onClick={()=>onUse(brief+'\n\n'+p.brief)}>{appended?'Proposal already in instructions':'Add proposal to my instructions'}</button>
   <p className="work-assessment-meta">{tooLong?'This proposal would exceed the instruction limit. Shorten your instructions first.':'Adds below your existing text for editing. Save changes when ready, or discard to undo.'}</p>
  </>}
  {data?.history.some(r=>r.status==='complete'&&r.id!==data.current?.id)&&<details><summary>Previous assessments</summary><ul>{data.history.filter(r=>r.status==='complete').map(r=><li key={r.id}><button type="button" onClick={()=>setSelected(r.id)}>{new Date(r.created_at).toLocaleString()}{r.id===data.current?.id?' · current':''}</button></li>)}</ul></details>}
 </section>;
}

