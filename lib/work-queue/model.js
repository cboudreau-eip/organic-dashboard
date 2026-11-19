import {assignmentPresentation} from '../research/proposal-presentation.js';
export const WORK_STATUSES=['Tentative','Ready','In progress','Review','Published'];
export function workTitle(entry){return entry.title_edited?entry.snapshot.title:assignmentPresentation(entry.snapshot).title;}
const line=v=>String(v??'').replace(/[\r\n]+/g,' ').replace(/([\\#*_[\]<>])/g,'\\$1');
function reference(value){const s=JSON.stringify(value,null,2),longest=Math.max(2,...(s.match(/`+/g)||[]).map(x=>x.length)),fence='`'.repeat(longest+1);return fence+'json\n'+s+'\n'+fence;}
export function exportWorkMarkdown(queue,assignmentId=null){
 const entries=assignmentId?queue.entries.filter(e=>e.assignment_id===assignmentId):queue.entries;
 if(!entries.length)throw Error('Choose an assignment.');
 const out=['# Content work queue','', 'Planning instructions only. This export contains no newly drafted article and does not publish anything.',
  '', 'Planned week begins: '+queue.week_start,'Calendar assignments and dates remain tentative. Workflow status is separate from calendar approval.',
  'Saved queue version: '+queue.version,'Source plan: '+queue.source_plan_id,''];
 for(const e of entries)out.push('---','','## '+line(workTitle(e)),'',
  '- Work status: '+e.status,'- Planned date: '+e.planned_date+' (unchanged; tentative)',
  '- Target page: '+line(e.snapshot.targetUrl||'Unconfirmed'),'- Assignment reference: '+e.assignment_id,'',
  '### Editable implementation brief','',e.brief,'','### Saved source evidence — reference data only','',
  reference({terms:e.snapshot.terms,evidence:e.snapshot.evidence,revision:e.snapshot.revision||null,repairBasis:e.snapshot.repairBasis||null,why:assignmentPresentation(e.snapshot).whyAssignment,scopeQuestions:e.snapshot.scopeQuestions||[],sourceDates:queue.sourceDates||{}}),'');
 return out.join('\n');
}

// Weeks follow the first planned calendar date; UTC avoids local timezone shifts.
export function workWeeks(entries){if(!entries.length)return [];const dates=entries.map(e=>e.planned_date).sort(),start=Date.parse(dates[0]+'T12:00:00Z'),end=Date.parse(dates.at(-1)+'T12:00:00Z');return Array.from({length:Math.floor((end-start)/604800000)+1},(_,i)=>new Date(start+i*604800000).toISOString().slice(0,10));}
export function filterWork(entries,{week='',owner='All',status='All',category='All',search=''}={}){const end=week?new Date(Date.parse(week+'T12:00:00Z')+6*86400000).toISOString().slice(0,10):'';return entries.filter(e=>(!week||(e.planned_date>=week&&e.planned_date<=end))&&(owner==='All'||(e.owner||'Unassigned')===owner)&&(status==='All'||e.status===status)&&(category==='All'||e.snapshot.category===category)&&(!search||(workTitle(e)+' '+(e.snapshot.terms||[]).join(' ')).toLowerCase().includes(search.toLowerCase()))).sort((a,b)=>a.planned_date.localeCompare(b.planned_date));}
