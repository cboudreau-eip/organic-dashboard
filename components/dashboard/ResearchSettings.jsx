'use client';
import {useState} from 'react';
import {PRODUCTS} from '../../lib/research/contracts';
export default function ResearchSettings({record,canEdit,busy,onSave}){
 const [form,setForm]=useState(record.settings);
 const change=(key,value)=>setForm(old=>({...old,[key]:value}));
 return <details className="research-settings" open={record.version===0}><summary>Research settings<span>Choose the products, locations and topics to focus on</span></summary>
 <p>Shared team settings for new research runs. Save changes before starting research; existing runs keep their original settings.</p>
 <form onSubmit={e=>{e.preventDefault();onSave(form);}}><fieldset disabled={!canEdit||busy}><section className="research-settings-group"><h4>Research focus</h4><p>Choose at least one product. Add optional state priorities or phrases to leave out.</p><fieldset><legend>Priority products</legend>{PRODUCTS.map(product=><label className="research-check" key={product}><input type="checkbox" checked={form.products.includes(product)} onChange={e=>change('products',e.target.checked?[...form.products,product]:form.products.filter(p=>p!==product))}/>{product}</label>)}</fieldset>

 <label>Priority states (full names, separated by commas)<input value={form.states.join(', ')} onChange={e=>change('states',e.target.value.split(',').map(x=>x.trimStart()))} onBlur={()=>change('states',form.states.map(x=>x.trim()).filter(Boolean))}/></label>
 <label>Exclude phrases (separated by commas)<input value={form.excluded.join(', ')} onChange={e=>change('excluded',e.target.value.split(',').map(x=>x.trimStart()))} onBlur={()=>change('excluded',form.excluded.map(x=>x.trim()).filter(Boolean))}/></label>
 </section><section className="research-settings-group"><h4>Context for your team</h4><p>Your objective and notes guide reviewers; they do not directly change research scores.</p><label>Business objective<input required maxLength={300} value={form.objective} onChange={e=>change('objective',e.target.value)}/></label><label>Research notes<textarea maxLength={2000} value={form.notes} onChange={e=>change('notes',e.target.value)}/></label>
 </section><details className="research-planning-preferences"><summary>Planning preferences</summary><p>Saved planning context only. These fields do not change research scores or reschedule your content calendar.</p><div className="research-fields">
 <label>Plan begins<input required type="date" value={form.start} onChange={e=>change('start',e.target.value)}/></label>
 <label>Planning days<input required type="number" min="7" max="366" value={form.duration} onChange={e=>change('duration',Number(e.target.value))}/></label>
 <label>Weekly publishing capacity<input required type="number" min="1" max="30" value={form.weeklyCapacity} onChange={e=>change('weeklyCapacity',Number(e.target.value))}/></label>
 <label>Target new content (%)<input required type="number" min="0" max="100" value={form.newContentPercent} onChange={e=>change('newContentPercent',Number(e.target.value))}/></label>
 </div></details>
 <div className="research-settings-save"><button type="submit">{busy?'Saving…':'Save research settings'}</button><span>Applies to new research runs.</span></div></fieldset></form></details>;
}
