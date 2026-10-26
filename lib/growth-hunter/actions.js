import {validDate} from '../gsc/dates.js';
import {shiftDate} from '../gsc/report.js';
import {pageKey} from '../semrush/gsc-pages.js';
export const ACTION_STATUSES=['planned','in_progress','published','monitoring','archived'];
export const uuid=s=>typeof s==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
export class ActionError extends Error {constructor(message,status=422){super(message);this.status=status;}}
export const todayPacific=(now=new Date())=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Los_Angeles',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
export function actionInput(input,update=false,now=new Date()){
 if(!input||typeof input!=='object'||Array.isArray(input))throw new ActionError('Invalid action.');
 const title=typeof input.title==='string'?input.title.trim():'';
 const notes=typeof input.notes==='string'?input.notes:'';
 if(!title||title.length>160||notes.length>4000)throw new ActionError('Use a title of 1–160 characters and notes up to 4,000 characters.');
 if(update){
  if(!uuid(input.id)||!Number.isSafeInteger(input.version)||input.version<1)throw new ActionError('Reload this action before editing.');
  if(!ACTION_STATUSES.includes(input.status))throw new ActionError('Choose a valid status.');
  const published_on=input.published_on||null;
  if(published_on&&(!validDate(published_on)||published_on<'2000-01-01'||published_on>todayPacific(now)))throw new ActionError('Use a valid publication date on or before today (Pacific time).');
  if(['published','monitoring'].includes(input.status)&&!published_on)throw new ActionError('Enter the publication date to monitor this change.');
  return {title,notes,status:input.status,published_on};
 }
 const page=pageKey(input.page);
 if(!page||new URL(page).search||new URL(page).port||page.length>2048)throw new ActionError('Choose a MedicareFAQ page without query parameters.');
 if(input.source_snapshot!=null&&!uuid(input.source_snapshot))throw new ActionError('Invalid source snapshot.');
 return {page,title,notes,source_snapshot:input.source_snapshot||null};
}
export function actionWindow(published,days,now=new Date()){
 if(!validDate(published)||![7,28].includes(days))throw new ActionError('Choose a publication date and a 7-day or 28-day review.');
 const end=shiftDate(published,days);
 if(end>=todayPacific(now))throw new ActionError('Waiting for '+days+' complete days after publication. The window ends '+end+'; finalized GSC data may arrive later.',409);
 return {mode:'custom',compare:'custom',start:shiftDate(published,1),end,priorStart:shiftDate(published,-days),priorEnd:shiftDate(published,-1)};
}
export function rankEvidence(page,before,after){
 const pick=s=>(s?.rows||[]).filter(r=>pageKey(r.landing)===page);
 const a=pick(before),b=pick(after),prior=new Map(a.map(r=>[r.keyword.toLowerCase(),r]));
 const comparable=b.filter(r=>r.position!=null&&prior.get(r.keyword.toLowerCase())?.position!=null);
 return {beforeDate:before?.end||null,afterDate:after?.end||null,beforeCount:before?a.length:null,afterCount:after?b.length:null,
  comparable:before&&after?comparable.length:null,
  improved:before&&after?comparable.filter(r=>r.position<prior.get(r.keyword.toLowerCase()).position).length:null,
  declined:before&&after?comparable.filter(r=>r.position>prior.get(r.keyword.toLowerCase()).position).length:null,
  rows:comparable.slice(0,100).map(r=>({keyword:r.keyword,before:prior.get(r.keyword.toLowerCase()).position,after:r.position,change:prior.get(r.keyword.toLowerCase()).position-r.position})),
  detailLimit:100};
}
