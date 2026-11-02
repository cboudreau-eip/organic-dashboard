'use client';
import {useState} from 'react';
export default function TrackOtterlyOpportunity({snapshotId,promptId,canSave}){
 const [busy,setBusy]=useState(false),[saved,setSaved]=useState(false),[error,setError]=useState(''),[existing,setExisting]=useState(false);
 async function save(){
  setBusy(true);setError('');
  try{
   const response=await fetch('/api/growth-hunter/actions',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({operation:'track_otterly',snapshotId,promptId})});
   const data=await response.json();if(!response.ok)throw Error(data.error||'Could not track this opportunity.');
   setSaved(true);setExisting(!!data.alreadyTracked);
   window.dispatchEvent(new window.Event('growth-action-saved'));
  }catch(e){setError(e.message);}finally{setBusy(false);}
 }
 return <div><button type="button" className="button" disabled={!canSave||!snapshotId||busy||saved} onClick={save}>{busy?'Saving…':saved?'Tracked in Growth Hunter':'Track this opportunity'}</button>
  {!canSave&&<small>Analyst access is required to track opportunities.</small>}
  {saved&&<><p role="status">{existing?'This prompt is already tracked. Its original baseline has been kept.':'Saved with the report dates, counts, competitors, and available platform evidence.'}</p><button type="button" className="button" onClick={()=>document.querySelector('[data-nav="growth"]')?.click()}>Open Growth Hunter</button></>}
  {error&&<p role="alert">{error}</p>}
 </div>;
}
