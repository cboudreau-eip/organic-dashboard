'use client';
import {useEffect,useState} from 'react';
import './content-plan.css';
import './proposed-assignments.css';
const count=v=>v==null?'Unavailable':Number(v).toLocaleString();
export default function PaidSearchSource({active}){
 const [data,setData]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 async function load(){const r=await fetch('/api/research/proposals',{cache:'no-store'}),d=await r.json();if(!r.ok)throw Error(d.error||'Unable to load paid-search evidence.');setData(d);}
 useEffect(()=>{if(active)load().catch(e=>setError(e.message));},[active]);
 async function importPaid(file){
  if(!file)return;setBusy(true);setError('');setNotice('');
  try{const form=new FormData();form.append('file',file);const r=await fetch('/api/research/paid-search',{method:'POST',body:form}),d=await r.json();if(!r.ok)throw Error(d.error);await load(data.plan?.id);setNotice(d.duplicate?'This workbook is already imported.':'Paid-search evidence imported. Saved dates and edits preserved.');}catch(e){setError(e.message);}finally{setBusy(false);}
 }

 const items=data?.plan?.payload.items||[];
 const source=data?.plan?.paidSearch;
 return <details className="card connection-card dashboard-source-section paid-source-card" open aria-label="Paid-search data source">
 <summary className="connection-top"><span className="source-logo" style={{'--source-color':'#286547'}}>PS</span><span><strong>Paid search</strong><small style={{display:'block'}}>Google &amp; Bing · Search-term research</small></span><span className="connection-state">{error?'Unavailable':!data?'Loading…':source?'Imported snapshot':'Not imported'}</span><span className="dashboard-source-toggle"><span className="when-open">Collapse ▴</span><span className="when-closed">Expand ▾</span></span></summary>
 {error&&<p role="alert">{error} <button onClick={()=>load().then(()=>setError('')).catch(e=>setError(e.message))}>Retry</button></p>}{notice&&<p role="status">{notice}</p>}
 <dl><dt>Workspace</dt><dd>MedicareFAQ · account scope retained</dd><dt>Refresh behavior</dt><dd>Manual import · no automatic sync</dd><dt>Report coverage</dt><dd>{source?source.period.start+' – '+source.period.end:'—'}</dd><dt>Workbook</dt><dd>{source?.filename||'No workbook loaded'}</dd><dt>Search terms</dt><dd>{source?count(source.terms):'—'}</dd><dt>Plan matches</dt><dd>{source?source.matchedAssignments+' of '+items.length:'—'}</dd></dl>
 <footer><span>Imported evidence supports Content Plan. Uploading does not revise assignments.</span></footer>
 <details className="paid-source-tools"><summary>Import &amp; research details</summary><p>Use an XLSX workbook with All Terms and Notes sheets. MedicareCompared-only rows are excluded from calendar matching; combined accounts remain labeled.</p>{data?.canEdit&&<label>Import paid-search workbook (.xlsx)<input type="file" accept=".xlsx" disabled={busy} onChange={e=>{importPaid(e.target.files?.[0]);e.target.value='';}}/></label>}
 {source&&<><p>{source.excludedMC} MedicareCompared-only terms excluded · {source.qualityExcluded} inconsistent rows excluded.</p><p>{source.methodology}</p><h4>Additional commercial terms to investigate</h4><p>These are not scheduled or approved. Compare existing coverage before replacing an assignment. Figures are platform attribution, not Salesforce policies.</p><div className="research-table"><table><thead><tr><th>Search term</th><th>Account scope</th><th>Attributed leads</th><th>Attributed sales</th></tr></thead><tbody>{data.plan.paidSearch.additional.map(r=><tr key={r.term}><td>{r.term}</td><td>{r.account==='MFAQ'?'MedicareFAQ only':'Combined MC + MedicareFAQ'}</td><td>{count(r.leads)}</td><td>{count(r.sales)}</td></tr>)}</tbody></table></div></>}
 </details></details>;
}
