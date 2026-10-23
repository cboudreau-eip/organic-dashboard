'use client';
import {useState} from 'react';
import {normalizeSelection,resolvePeriod,shiftMonths} from '../../lib/gsc/dates';

export default function GscDateControls({selection,onApply,latest}) {
  const [draft,setDraft]=useState(selection);
  const [error,setError]=useState('');
  const today=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Los_Angeles',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  const update=(key,value)=>{setDraft({...draft,[key]:value});setError('');};
  function submit(e) {
    e.preventDefault();
    try {
      const next=normalizeSelection(draft);
      if(latest) resolvePeriod(next,latest,today);
      setError('');onApply(next);
    } catch(e) {setError(e.message);}
  }
  const base=latest||today;
  return <form className="gsc-date-controls" onSubmit={submit}>
    <div className="gsc-date-fields">
      <label>Reporting period<select value={draft.mode} onChange={e=>{setDraft({...draft,mode:e.target.value,month:draft.month||shiftMonths(base,-1).slice(0,7),start:draft.start||base,end:draft.end||base});setError('');}}>
        <option value="rolling">Recent finalized days</option><option value="month">Calendar month</option><option value="custom">Custom dates</option>
      </select></label>
      {draft.mode==='rolling'&&<label>Days<select value={draft.days||28} onChange={e=>update('days',Number(e.target.value))}>{[7,28,30].map(n=><option key={n} value={n}>Last {n} finalized days</option>)}</select></label>}
      {draft.mode==='month'&&<label>Month<input required type="month" value={draft.month||''} onChange={e=>update('month',e.target.value)}/></label>}
      {draft.mode==='custom'&&<><label>Start date<input required type="date" max={latest||undefined} value={draft.start||''} onChange={e=>update('start',e.target.value)}/></label><label>End date<input required type="date" max={latest||undefined} value={draft.end||''} onChange={e=>update('end',e.target.value)}/></label></>}
      <label>Compare with<select value={draft.compare} onChange={e=>update('compare',e.target.value)}>
        <option value="previous">{draft.mode==='month'?'Previous calendar month':'Previous equal-length period'}</option><option value="year">Same dates last year</option><option value="custom">Custom comparison dates</option>
      </select></label>
      {draft.compare==='custom'&&<><label>Comparison start<input required type="date" max={latest||undefined} value={draft.priorStart||''} onChange={e=>update('priorStart',e.target.value)}/></label><label>Comparison end<input required type="date" max={latest||undefined} value={draft.priorEnd||''} onChange={e=>update('priorEnd',e.target.value)}/></label></>}
      <button type="submit" className="button primary">Apply dates</button>
    </div>
    <p>Applies to GSC cards, chart and both tables. Dates use Pacific time. {latest&&'Latest finalized data: '+latest+'.'} Choose up to 366 days per period, within GSC’s 16-month history window.</p>
    {error&&<p className="organic-error" role="alert">{error}</p>}
  </form>;
}
