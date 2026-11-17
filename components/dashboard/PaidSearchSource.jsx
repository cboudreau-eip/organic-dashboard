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
 return <section className="content-plan" aria-label="Paid-search data source"><h2>Paid-search data</h2><p>Manual workbook import · Google and Bing search terms. Imported evidence remains available to Content Plan; uploading does not revise assignments.</p>{error&&<p role="alert">{error} <button onClick={()=>load().then(()=>setError('')).catch(e=>setError(e.message))}>Retry</button></p>}{notice&&<p role="status">{notice}</p>}{!data&&!error&&<p role="status">Loading paid-search data…</p>}{data&&<> <details className="proposal-editor" open><summary>Paid search · Google &amp; Bing</summary><p>Upload this report format with All Terms and Notes sheets. MedicareCompared-only rows are excluded from calendar matching. Mixed-account results remain labeled.</p>{data.canEdit&&<label>Import paid-search workbook (.xlsx)<input type="file" accept=".xlsx" disabled={busy} onChange={e=>{importPaid(e.target.files?.[0]);e.target.value='';}}/></label>}
 {data.plan?.paidSearch&&<><p><strong>{data.plan.paidSearch.matchedAssignments} of {items.length} assignments matched</strong> · {data.plan.paidSearch.terms} search terms · {data.plan.paidSearch.excludedMC} MedicareCompared-only terms excluded · {data.plan.paidSearch.qualityExcluded} inconsistent rows excluded.</p><p>{data.plan.paidSearch.filename} · {data.plan.paidSearch.period.start} – {data.plan.paidSearch.period.end}</p><p>{data.plan.paidSearch.methodology}</p><h4>Additional commercial terms to investigate</h4><p>These are not scheduled or approved. Compare existing coverage before replacing an assignment. Figures are platform attribution, not Salesforce policies.</p><div className="research-table"><table><thead><tr><th>Search term</th><th>Account scope</th><th>Attributed leads</th><th>Attributed sales</th></tr></thead><tbody>{data.plan.paidSearch.additional.map(r=><tr key={r.term}><td>{r.term}</td><td>{r.account==='MFAQ'?'MedicareFAQ only':'Combined MC + MedicareFAQ'}</td><td>{count(r.leads)}</td><td>{count(r.sales)}</td></tr>)}</tbody></table></div></>}
 </details>{!data.plan?.paidSearch&&<p>No paid-search evidence is attached to the latest saved plan.</p>}</>}</section>;
}
