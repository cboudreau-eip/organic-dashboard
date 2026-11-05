'use client';
import {useId,useState} from 'react';
import {growthContentMarkdown} from '../../lib/growth-hunter/content';
export default function ContentSuggestion({run,finding,canRun,onSaved}){
 const fieldId=useId();
 const [result,setResult]=useState(null),[notes,setNotes]=useState(''),[busy,setBusy]=useState(''),[error,setError]=useState(''),[saved,setSaved]=useState(false);
 async function generate(){
  setBusy('generate');setError('');
  try{const r=await fetch('/api/growth-hunter/content-suggestion',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({runId:run.id,page:finding.url})}),data=await r.json();if(!r.ok)throw Error(data.error||'Could not generate a suggestion.');setResult(data);setNotes(data.suggestion.notes);setSaved(false);}catch(e){setError(e.message);}finally{setBusy('');}
 }
 async function save(){
  setBusy('save');setError('');
  try{const r=await fetch('/api/growth-hunter/actions',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({page:finding.url,title:'Review content change for Google click decline',notes,source_snapshot:run.current_snapshot_id})}),data=await r.json();if(!r.ok)throw Error(data.error||'Could not save action.');setSaved(true);onSaved?.();}catch(e){setError(e.message);}finally{setBusy('');}
 }
 function download(){try{const {text,filename}=growthContentMarkdown(result,notes),url=URL.createObjectURL(new Blob([text],{type:'text/markdown;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),10000);}catch{setError('Could not export the draft. Please retry.');}}
 return <section className="content-suggestion growth-review-section" aria-label="Growth Hunter content suggestion">
  <h5>Turn this opportunity into a content change</h5>
  <p>Charlie reviews this page and its saved GSC evidence to suggest one focused change. Investigate supporting keywords first to include query-level evidence. A content edit may not be the right response to a traffic decline.</p>
  <button className="button" type="button" disabled={!canRun||!!busy||!!result} onClick={generate}>{busy==='generate'?'Charlie is reviewing the page…':'Suggest a content change'}</button>
  {busy==='generate'&&<p role="status">Reading the selected page and relevant internal-link sources. This can take about a minute.</p>}
  {error&&<p role="alert">{error}</p>}
  {result&&<div className="content-review">
   <p><strong>Page reviewed:</strong> <a href={result.suggestion.target} target="_blank" rel="noreferrer">{result.suggestion.target}</a></p>
   <p>{result.evidence.keywordResearchId?'Includes saved keyword evidence.':'No saved keyword investigation was available; this draft uses page-level evidence only.'} This is a suggestion for editorial review, not a proven cause or guaranteed traffic recovery.</p>
   <label htmlFor={fieldId}>Review and edit the proposed change</label><textarea id={fieldId} rows={16} maxLength={4000} value={notes} disabled={saved||!!busy} onChange={e=>setNotes(e.target.value)}/>
   <small>{notes.length.toLocaleString()} / 4,000 characters. Check Medicare facts before publishing.</small>
   <details><summary>Pages reviewed and suggested links</summary><p>Public excerpts read {new Date(result.generatedAt).toLocaleString()}; these can differ from content during the analysis period.</p><ul>{result.sources.map(s=><li key={s.id}><a href={s.url} target="_blank" rel="noreferrer">{s.url}</a>{result.suggestion.links.includes(s.url)?' — suggested internal link':''}{s.truncated?' — excerpt truncated':''}</li>)}</ul></details>
   <div className="prompt-actions"><button className="button primary" type="button" disabled={!canRun||!!busy||saved||!notes.trim()} onClick={save}>{saved?'Action saved':busy==='save'?'Saving…':'Approve and save action'}</button><button className="button" type="button" disabled={!!busy||!notes.trim()} onClick={download}>Export to Markdown</button><button className="button" type="button" disabled={!!busy} onClick={()=>{setResult(null);setNotes('');setSaved(false);setError('');}}>Start a new draft</button></div>
   <p>Export includes your edited draft, source links and saved GSC evidence for your implementation LLM. Saving creates a planned action; nothing is published.</p>
   {saved&&<p role="status">Saved in Saved decline actions. Record the publication date there after implementing the change.</p>}
  </div>}
 </section>;
}
