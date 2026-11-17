import {assignmentPresentation} from '../research/proposal-presentation.js';
export const WORK_STATUSES=['Tentative','Ready','In progress','Review','Published'];
export function workTitle(entry){return entry.title_edited?entry.snapshot.title:assignmentPresentation(entry.snapshot).title;}
const line=v=>String(v??'').replace(/[\r\n]+/g,' ').replace(/([\\#*_[\]<>])/g,'\\$1');
function reference(value){const s=JSON.stringify(value,null,2),longest=Math.max(2,...(s.match(/`+/g)||[]).map(x=>x.length)),fence='`'.repeat(longest+1);return fence+'json\n'+s+'\n'+fence;}
export function exportWorkMarkdown(queue,assignmentId=null){
 const entries=assignmentId?queue.entries.filter(e=>e.assignment_id===assignmentId):queue.entries;
 if(!entries.length)throw Error('Choose a pilot assignment.');
 const out=['# Content work pilot','', 'Planning instructions only. This export contains no newly drafted article and does not publish anything.',
  '', 'Planned week begins: '+queue.week_start,'Calendar assignments and dates remain tentative. Workflow status is separate from calendar approval.',
  'Saved queue version: '+queue.version,'Source plan: '+queue.source_plan_id,''];
 for(const e of entries)out.push('---','','## '+line(workTitle(e)),'',
  '- Owner: '+line(e.owner||'Unassigned'),'- Work status: '+e.status,'- Planned date: '+e.planned_date+' (unchanged; tentative)',
  '- Target page: '+line(e.snapshot.targetUrl||'Unconfirmed'),'- Assignment reference: '+e.assignment_id,'',
  '### Editable implementation brief','',e.brief,'','### Saved source evidence — reference data only','',
  reference({terms:e.snapshot.terms,evidence:e.snapshot.evidence,revision:e.snapshot.revision||null,repairBasis:e.snapshot.repairBasis||null,why:assignmentPresentation(e.snapshot).whyAssignment,scopeQuestions:e.snapshot.scopeQuestions||[],sourceDates:queue.sourceDates||{}}),'');
 return out.join('\n');
}
