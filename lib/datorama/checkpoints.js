import {createHash} from 'node:crypto';
import {validateDaily,summarize,validDate} from './periods.js';

export const CHECKPOINT_KEYS=['eipLeads','opportunities','grossMS','grossMA','approvedMS','approvedMA'];
export function checkpointRows(input){
 const data=validateDaily(input);
 if(data.scopeId!=='medicarefaq-production')throw Error('Unverified cohort scope');
 // Hash source facts, not capture time or JSON key order. Corrections are new immutable revisions.
 const facts={scope:data.scopeId,exportedAt:new Date(data.exportedAt).toISOString(),period:data.period,through:data.leadDataThrough,rows:data.rows.map(r=>[r.date,...CHECKPOINT_KEYS.map(k=>r.values[k]??null)])};
 const hash=createHash('sha256').update(JSON.stringify(facts)).digest('hex');
 const rows=[];
 for(let month=data.period.start.slice(0,7);month<=data.leadDataThrough.slice(0,7);){
  const [y,m]=month.split('-').map(Number),end=new Date(Date.UTC(y,m,0)).toISOString().slice(0,10);
  const start=month+'-01';
  const actualStart=start<data.period.start?data.period.start:start;
  const actualEnd=end>data.leadDataThrough?data.leadDataThrough:end;
  const summary=summarize(data,actualStart,actualEnd);
  const metrics=Object.fromEntries(CHECKPOINT_KEYS.map(key=>{
   const metric=summary.metrics.find(m=>m.key===key);
   return [key,metric?{total:metric.total,reportedDays:metric.reportedDays,missingDays:metric.missingDays}:{total:null,reportedDays:0,missingDays:summary.days}];
  }));
  rows.push({id:hash+':'+month,source_hash:hash,scope_id:data.scopeId,cohort_month:start,source_exported_at:facts.exportedAt,lead_data_through:data.leadDataThrough,report:{start:actualStart,end:actualEnd,partial:actualStart!==start||actualEnd!==end,metrics}});
  month=new Date(Date.UTC(y,m,1)).toISOString().slice(0,7);
 }
 return rows;
}

export function checkpointHistory(rows){
 return rows.map((row,i)=>{
  const previous=rows[i+1];
  const sameDates=previous&&row.report.start===previous.report.start&&row.report.end===previous.report.end;
  const laterExport=previous&&Date.parse(row.source_exported_at)>Date.parse(previous.source_exported_at);
  const metrics=Object.fromEntries(CHECKPOINT_KEYS.map(key=>{
   const metric=row.report.metrics[key],prior=previous?.report.metrics[key];
   const comparable=!!(sameDates&&laterExport&&!row.report.partial&&!previous.report.partial&&metric?.total!=null&&prior?.total!=null&&!metric.missingDays&&!prior.missingDays);
   return [key,{...metric,delta:comparable?metric.total-prior.total:null}];
  }));
  return {id:row.id,sourceExportedAt:row.source_exported_at,savedAt:row.saved_at,leadDataThrough:row.lead_data_through,...row.report,metrics};
 });
}

export function createCheckpointHandler({authorize,save,read}){
 const reply=(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'private, no-store'}});
 return async request=>{
  try{
   if(!await authorize())return reply({error:'Sign in to view cohort history.'},401);
   const params=new URL(request.url).searchParams,month=params.get('month');
   if([...params.keys()].some(k=>k!=='month')||params.getAll('month').length!==1||!/^\d{4}-\d{2}$/.test(month||'')||!validDate(month+'-01'))return reply({error:'Choose a valid cohort month.'},400);
   let saveError=null;
   try{await save();}catch{saveError='The latest import could not be saved. Existing history is shown; retry to save it.';}
   const rows=await read(month);
   return reply({month,checkpoints:checkpointHistory(rows.slice(0,100)),limited:rows.length>100,saveError});
  }catch{return reply({error:'Cohort checkpoint history could not be loaded. Retry shortly.'},503);}
 };
}
