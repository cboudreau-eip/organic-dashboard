'use client';
import {useState} from 'react';
import {PRODUCTS} from '../../lib/research/contracts';
export default function ResearchSettings({record,canEdit,busy,onSave}){
 const [form,setForm]=useState(record.settings);
 const change=(key,value)=>setForm(old=>({...old,[key]:value}));
 return <details className="research-settings" open={record.version===0}><summary>Planning settings</summary>
 <p>These settings belong to the team. Each research run saves its own copy. Capacity and content mix are saved for a later scheduling milestone; they do not change research scores.</p>
 <form onSubmit={e=>{e.preventDefault();onSave(form);}}><fieldset disabled={!canEdit||busy}><div className="research-fields">
 <label>Plan begins<input required type="date" value={form.start} onChange={e=>change('start',e.target.value)}/></label>
 <label>Planning days<input required type="number" min="7" max="366" value={form.duration} onChange={e=>change('duration',Number(e.target.value))}/></label>
 <label>Weekly publishing capacity<input required type="number" min="1" max="30" value={form.weeklyCapacity} onChange={e=>change('weeklyCapacity',Number(e.target.value))}/></label>
 <label>Target new content (%)<input required type="number" min="0" max="100" value={form.newContentPercent} onChange={e=>change('newContentPercent',Number(e.target.value))}/></label>
 </div><fieldset><legend>Priority products</legend>{PRODUCTS.map(product=><label className="research-check" key={product}><input type="checkbox" checked={form.products.includes(product)} onChange={e=>change('products',e.target.checked?[...form.products,product]:form.products.filter(p=>p!==product))}/>{product}</label>)}</fieldset>
 <label>Business objective<input required maxLength={300} value={form.objective} onChange={e=>change('objective',e.target.value)}/></label>
 <label>Priority states (full names, separated by commas)<input value={form.states.join(', ')} onChange={e=>change('states',e.target.value.split(',').map(x=>x.trimStart()))} onBlur={()=>change('states',form.states.map(x=>x.trim()).filter(Boolean))}/></label>
 <label>Exclude phrases (separated by commas)<input value={form.excluded.join(', ')} onChange={e=>change('excluded',e.target.value.split(',').map(x=>x.trimStart()))} onBlur={()=>change('excluded',form.excluded.map(x=>x.trim()).filter(Boolean))}/></label>
 <label>Planning notes<textarea maxLength={2000} value={form.notes} onChange={e=>change('notes',e.target.value)}/></label>
 <p>Objective and notes are context for reviewers. Scoring uses the displayed product, state, intent and evidence rules.</p>
 <button type="submit">Save planning settings</button></fieldset></form></details>;
}
