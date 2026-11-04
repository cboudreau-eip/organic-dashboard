'use client';
import {useId,useState} from 'react';
import {contentMarkdown} from '../../lib/otterly/content-export';
export default function ContentSuggestion({snapshotId,promptId,canSave,prompt,report}){
 const fieldId=useId();
 const [result,setResult]=useState(null),[notes,setNotes]=useState(''),[busy,setBusy]=useState(''),[error,setError]=useState(''),[saved,setSaved]=useState(false),[existing,setExisting]=useState(false),[copied,setCopied]=useState(false);
 async function generate(){
  setBusy('generate');setError('');
  try{const response=await fetch('/api/otterly/content-suggestion',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({snapshotId,promptId})});const data=await response.json();if(!response.ok)throw Error(data.error||'Could not generate a suggestion.');setResult(data);setNotes(data.suggestion.notes);setSaved(false);setExisting(false);setCopied(false);}catch(e){setError(e.message);}finally{setBusy('');}
 }
 async function save(){
  setBusy('save');setError('');
  try{const response=await fetch('/api/growth-hunter/actions',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({operation:'track_otterly',snapshotId,promptId,notes})});const data=await response.json();if(!response.ok)throw Error(data.error||'Could not save this change.');setExisting(!!data.alreadyTracked);setSaved(!data.alreadyTracked);window.dispatchEvent(new window.Event('growth-action-saved'));}catch(e){setError(e.message);}finally{setBusy('');}
 }
 async function copy(){try{await navigator.clipboard.writeText(notes);setCopied(true);}catch{setError('Select the draft text and copy it manually.');}}
 function exportMarkdown(){
  try{
   const {text,filename}=contentMarkdown({result,notes,prompt,report,snapshotId,saved});
   const url=URL.createObjectURL(new Blob([text],{type:'text/markdown;charset=utf-8'}));
   const link=document.createElement('a');link.href=url;link.download=filename;document.body.appendChild(link);link.click();link.remove();
   setTimeout(()=>URL.revokeObjectURL(url),10000);
  }catch{setError('Could not export the recommendation. Please try again.');}
 }
 return <section className="content-suggestion" aria-label="Content recommendation">
  <button className="button" type="button" disabled={!canSave||!snapshotId||!!busy} onClick={generate}>{busy==='generate'?'Charlie is reviewing pages…':result?'Generate another suggestion':'Suggest a content change'}</button>
  {busy==='generate'&&<p role="status">Reading relevant MedicareFAQ pages and the saved Otterly evidence. This can take about a minute.</p>}
  {error&&<p role="alert">{error}</p>}
  {result&&<div className="content-review">
   <h5>Review Charlie’s suggested change</h5>
   <p><strong>Suggested page:</strong> <a href={result.suggestion.target} target="_blank" rel="noreferrer">{result.suggestion.target}</a></p>
   <p>This is an editorial suggestion, not a proven explanation for missing citations. Charlie read public page excerpts; it did not inspect competitors’ answers. Check Medicare facts before publishing.</p>
   <label htmlFor={fieldId}>Edit the proposed change before saving</label>
   <textarea id={fieldId} value={notes} maxLength={4000} rows={16} onChange={e=>{setNotes(e.target.value);setCopied(false);}} disabled={saved||!!busy}/>
   <small>{notes.length.toLocaleString()} / 4,000 characters. Saving creates a planned action; it does not publish to the website.</small>
   <details><summary>Pages reviewed and suggested internal links</summary><p>A limited shortlist from the site sitemap, read {new Date(result.generatedAt).toLocaleString()}. Page excerpts may omit later sections.</p><ul>{result.sources.map(s=><li key={s.id}><a href={s.url} target="_blank" rel="noreferrer">{s.url}</a>{result.suggestion.links.includes(s.url)?' — suggested internal link':''}</li>)}</ul></details>
   <div className="prompt-actions"><button className="button" type="button" disabled={!!busy||saved||existing||!notes.trim()} onClick={save}>{busy==='save'?'Saving…':saved?'Saved in Growth Hunter':'Approve & save in Growth Hunter'}</button><button className="button" type="button" onClick={copy}>{copied?'Copied':'Copy draft'}</button><button className="button" type="button" disabled={!!busy||!notes.trim()} onClick={exportMarkdown}>Export to Markdown</button></div>
   <p>Export downloads a .md implementation brief with your current edits, source links, and Otterly evidence. You can give this file to your LLM without saving an action first.</p>
   {saved&&<p role="status">Saved your approved draft and the original Otterly baseline.</p>}
   {existing&&<p role="status">This prompt already has an action. Its notes and original baseline were kept. Copy this draft, open Growth Hunter, and paste it into that action’s notes if you want to replace them.</p>}
   {(saved||existing)&&<button type="button" className="button" onClick={()=>document.querySelector('[data-nav="growth"]')?.click()}>Open Growth Hunter</button>}
  </div>}
 </section>;
}
