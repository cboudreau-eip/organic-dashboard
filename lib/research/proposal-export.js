// Quote every field and neutralize spreadsheet formulas in user/source text.
const cell=value=>{
 let text=String(value??'');
 if(/^[\s\uFEFF]*[=+@-]/.test(text)||/^[\t\r\n]/.test(text))text="'"+text;
 return '"'+text.replace(/"/g,'""')+'"';
};
export function exportProposalCsv(plan){
 if(!plan?.payload?.items?.length)throw Error('No saved assignments to export.');
 const dates=plan.calendar?.dates||{},fixed=new Set(plan.calendar?.locked||[]);
 const sourceDates=Object.entries(plan.payload.sourceDates||{}).map(([name,s])=>`${name}: ${s.period?`${s.period.start} to ${s.period.end}`:'Reporting dates unavailable'}; ${s.status||'unknown'}${s.fetchedAt?`; retrieved ${s.fetchedAt}`:''}`).join('\n');
 const headers=['Date','Status','Fixed date','Category','Assignment title','Proposed work','Target page','Why this assignment','Supporting evidence','Target queries / questions','Notes','Opportunity basis','Verify before implementation','How to measure','Original research title','Source dates and coverage','Plan ID','Assignment ID','Saved plan version'];
 const rows=[...plan.payload.items].sort((a,b)=>(dates[a.id]||'9999').localeCompare(dates[b.id]||'9999')).map(i=>[
  dates[i.id]||'Unscheduled','Tentative',fixed.has(i.id)?'Yes':'No',i.category,i.title,i.action,i.targetUrl,
  [i.whyAssignment?.summary,i.whyAssignment?.sourceScope].filter(Boolean).join('\n'),
  (i.whyAssignment?.facts||[]).join('\n'),(i.terms||[]).join('\n'),i.notes,i.basis,i.verification,i.measure,i.originalTitle||i.title,sourceDates,plan.id,i.id,plan.version
 ]);
 return '\uFEFF'+[headers,...rows].map(row=>row.map(cell).join(',')).join('\r\n')+'\r\n';
}
