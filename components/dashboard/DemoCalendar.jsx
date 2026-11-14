'use client';
import {useState,useEffect,useRef} from 'react';
import {DEMO_DATES} from '../../lib/research/demo-calendar';
import './demo-calendar.css';
const months=['January','February','March'];
const tone={'High intent':'commercial','Long-tail':'longtail','AI citations':'citations',Evergreen:'evergreen'};
export default function DemoCalendar({plan,items,canEdit,busy,onChange,onEdit}){
 const [view,setView]=useState('month'),[month,setMonth]=useState(0),[category,setCategory]=useState('All'),[selected,setSelected]=useState(null),[moveDate,setMoveDate]=useState('');
 const editor=useRef(null);useEffect(()=>{if(selected){editor.current?.scrollIntoView?.({block:'center'});editor.current?.focus();}},[selected]);
 const calendar=plan.calendar,all=plan.payload.items,chosen=all.find(x=>x.id===selected);
 const byDate=new Map(all.map(x=>[calendar?.dates[x.id],x]));
 const visible=DEMO_DATES.filter(d=>Number(d.slice(5,7))===month+1),offset=new Date(visible[0]+'T12:00:00Z').getUTCDay();
 const select=x=>{setSelected(x.id);setMoveDate(calendar.dates[x.id]);};
 const mutate=input=>onChange({...input,planId:plan.id,version:plan.version});
 return <section className="demo-calendar" aria-label="Tentative demo calendar"><header><h3>January–March 2027 demo calendar</h3><p>One tentative assignment every day, including weekends. Dates are planning placeholders, not publishing commitments.</p></header>
 <div className="plan-toolbar"><button disabled={!canEdit||busy||all.length!==90} onClick={()=>mutate({action:'calendar-generate'})}>{calendar?'Rebalance unfixed dates':'Generate tentative calendar'}</button>{calendar&&<><button aria-pressed={view==='month'} onClick={()=>setView('month')}>Month view</button><button aria-pressed={view==='agenda'} onClick={()=>setView('agenda')}>Agenda view</button></>}</div>
 <p className="research-help">Moving an assignment swaps it with the assignment on the chosen date, keeping one per day. Both dates become fixed and survive rebalancing. Assignment text, notes and evidence are preserved.</p>
 {calendar&&<><p><strong>90 scheduled · 0 unscheduled · All tentative</strong> · {calendar.locked.length} fixed dates · January 1–March 31, 2027</p>
 <div className="calendar-legend">{Object.keys(tone).map(c=><span className={tone[c]} key={c}>{c}</span>)}</div>
 <label>Calendar category<select value={category} onChange={e=>setCategory(e.target.value)}>{['All',...Object.keys(tone)].map(c=><option key={c}>{c}</option>)}</select></label>
 {view==='month'?<><div className="plan-month"><button aria-label="Previous calendar month" disabled={month===0} onClick={()=>setMonth(m=>m-1)}>←</button><h4>{months[month]} 2027</h4><button aria-label="Next calendar month" disabled={month===2} onClick={()=>setMonth(m=>m+1)}>→</button></div><div className="demo-month" role="group" aria-label={`${months[month]} 2027 tentative assignments`}>
 {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d=><strong className="weekday" key={d}>{d}</strong>)}{Array.from({length:offset},(_,i)=><div className="empty-day" key={'empty'+i}/>)}
 {visible.map(date=>{const x=byDate.get(date),show=category==='All'||x.category===category;return <div className="demo-day" key={date}><time dateTime={date}>{Number(date.slice(8))}</time>{show?<button className={tone[x.category]} onClick={()=>select(x)} aria-label={`${date}: ${x.title} — Tentative`}><small>{x.category} · Tentative{calendar.locked.includes(x.id)?' · Fixed':''}</small><span>{x.title}</span></button>:<small>Assignment hidden by filter</small>}</div>;})}</div></>:<div className="demo-agenda">{DEMO_DATES.map(date=>{const x=byDate.get(date);return category!=='All'&&x.category!==category?null:<button className={tone[x.category]} key={date} onClick={()=>select(x)}><time>{date}</time><span>{x.title}</span><small>{x.category} · Tentative{calendar.locked.includes(x.id)?' · Fixed':''}</small></button>;})}</div>}
 {chosen&&<section ref={editor} tabIndex={-1} className="calendar-date-editor" aria-label="Calendar assignment"><h4>{chosen.title}</h4><p>{chosen.category} · Tentative · {calendar.dates[chosen.id]}</p><p>{chosen.action}</p><button onClick={()=>onEdit(chosen.id)}>Edit assignment details</button><form onSubmit={e=>{e.preventDefault();mutate({action:'calendar-move',itemId:chosen.id,date:moveDate});}}><fieldset disabled={!canEdit||busy}><label>Move to date<input type="date" required min="2027-01-01" max="2027-03-31" value={moveDate} onChange={e=>setMoveDate(e.target.value)}/></label><p>{moveDate!==calendar.dates[chosen.id]&&byDate.get(moveDate)?`Swaps dates with: ${byDate.get(moveDate).title}`:'Choose another date to swap assignments.'}</p><button type="submit">Swap dates and fix them</button><button type="button" onClick={()=>mutate({action:'calendar-lock',itemId:chosen.id,locked:!calendar.locked.includes(chosen.id)})}>{calendar.locked.includes(chosen.id)?'Unfix this date':'Fix this date'}</button></fieldset></form></section>}
 </>}
 </section>;
}
