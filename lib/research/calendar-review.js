import {DEMO_DATES} from './demo-calendar.js';
export function calendarReview(plan,now=new Date()){
 const items=plan.payload.items,dates=plan.calendar?.dates||{},ids=new Set(items.map(i=>i.id)),scheduled=items.map(i=>dates[i.id]);
 const scheduleValid=items.length===90&&ids.size===90&&Object.keys(dates).length===90&&new Set(scheduled).size===90&&scheduled.every(d=>DEMO_DATES.includes(d))&&(plan.calendar?.locked||[]).every(id=>ids.has(id));
 const incomplete=items.filter(i=>![i.title,i.action,i.verification,i.measure].every(v=>typeof v==='string'&&v.trim())||!i.terms?.length).map(i=>i.id);
 const noEvidence=items.filter(i=>!['gsc','semrush','otterly','paidSearch'].some(k=>i.evidence?.[k]?.length)&&!i.revision?.rows?.length).map(i=>i.id);
 const flagged=plan.qualityAudit?.flagged??items.length;
 return {checkedAt:now.toISOString(),assignments:items.length,flagged,scheduleValid,tentative:plan.calendar?.status==='Tentative',incomplete,noEvidence,ready:scheduleValid&&plan.calendar?.status==='Tentative'&&!flagged&&!incomplete.length&&!noEvidence.length,scope:'Planning review of saved assignments, evidence, page-target decisions, duplication flags and the January–March schedule. Not factual approval or permission to publish. Recheck source freshness and each proposed change before implementation.'};
}
