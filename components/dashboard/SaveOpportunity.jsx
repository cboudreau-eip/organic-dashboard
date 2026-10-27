'use client';
import {useState} from 'react';
export default function SaveOpportunity({page,title,snapshotId,disabled,onSaved}){
 const [busy,setBusy]=useState(false),[saved,setSaved]=useState(false),[error,setError]=useState('');
 async function save(){
  setBusy(true);setError('');
  try{
   const r=await fetch('/api/growth-hunter/actions',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({page,title,source_snapshot:snapshotId||null,notes:''})});
   const data=await r.json();if(!r.ok)throw Error(data.error||'Could not save action.');
   setSaved(true);onSaved?.();
  }catch(e){setError(e.message);}finally{setBusy(false);}
 }
 return <><button type="button" className="button" data-tour="save-opportunity" disabled={disabled||busy||saved} onClick={save}>{busy?'Saving…':saved?'Saved':'Save opportunity'}</button>
 {saved&&<button type="button" className="button" onClick={()=>document.getElementById('growth-action-list')?.scrollIntoView({behavior:'smooth'})}>View saved actions</button>}
 {error&&<small role="alert">{error}</small>}</>;
}
