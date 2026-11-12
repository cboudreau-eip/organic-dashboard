export const PLAN_STATUSES=['Needs review','Approved','In progress','Ready','Published','Deferred'];
export class PlanError extends Error{constructor(message,status=422){super(message);this.status=status;}}
export function planInput(input,ids){
 if(!input||!ids.includes(input.id))throw new PlanError('Choose an existing opportunity.');
 if(!Number.isSafeInteger(input.version)||input.version<0)throw new PlanError('Reload this opportunity before saving.');
 if(!PLAN_STATUSES.includes(input.status))throw new PlanError('Choose a valid status.');
 if(typeof input.owner!=='string'||input.owner.length>120||typeof input.brief!=='string'||input.brief.length>12000)throw new PlanError('Use an owner of up to 120 characters and a brief of up to 12,000 characters.');
 const scheduledDate=input.scheduledDate||null;
 if(scheduledDate&&(!/^2027-\d{2}-\d{2}$/.test(scheduledDate)||!Number.isFinite(Date.parse(scheduledDate))||new Date(scheduledDate).toISOString().slice(0,10)!==scheduledDate||scheduledDate<'2027-01-01'||scheduledDate>'2027-03-31'))throw new PlanError('Choose a valid date from January 1 through March 31, 2027.');
 if(typeof input.approved!=='boolean')throw new PlanError('Specify whether this opportunity has been reviewed and approved.');
 if((scheduledDate||['Approved','In progress','Ready','Published'].includes(input.status))&&!input.approved)throw new PlanError('Approve the opportunity before scheduling or moving it into production.');
 if(input.status==='Published'&&!scheduledDate)throw new PlanError('A published item needs a date.');
 return {id:input.id,version:input.version,status:input.status,owner:input.owner.trim(),brief:input.brief.trim(),scheduled_date:scheduledDate,approved:input.approved};
}
export function mergePlan(shortlist,rows){
 const saved=new Map(rows.map(row=>[row.id,row]));
 return {...shortlist,items:shortlist.items.map(item=>{const row=saved.get(item.id);return {...item,version:row?.version||0,status:row?.status||'Needs review',owner:row?.owner||'',brief:row?.brief||'',scheduledDate:row?.scheduled_date||null,approved:row?.approved||false,updatedAt:row?.updated_at||null};})};
}
