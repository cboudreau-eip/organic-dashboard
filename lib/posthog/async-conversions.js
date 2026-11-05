import {createHash} from 'node:crypto';
import {conversionQueries,parseConversionResults} from './conversions.js';

export const FRESH_MS=15*60*1000;
const MAX_JOB_MS=10*60*1000;
export const reportKey=period=>createHash('sha256').update(JSON.stringify({version:1,project:452683,queries:conversionQueries(period)})).digest('hex');
export function newJob(now=Date.now()) {return {startedAt:now,sections:[{},{},{}]};}

// Query execution happens in PostHog; each call only submits or checks a job.
export async function queryStep(query,state,{key,fetchImpl=fetch}) {
 const id=state.id;
 if(id&&!/^[a-zA-Z0-9_-]{1,128}$/.test(id))throw Error('Invalid query reference');
 const response=await fetchImpl(`https://us.posthog.com/api/projects/452683/query/${id?`${id}/`:''}`,{
  method:id?'GET':'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},
  ...(!id?{body:JSON.stringify({query,refresh:'async',name:'Organic Dashboard conversion report'})}:{}),
  signal:AbortSignal.timeout(15000),cache:'no-store',redirect:'error'
 });
 if(!response.ok)throw Error('PostHog request failed');
 const body=await response.json(),status=body.query_status;
 if(body.error||status?.error)throw Error('PostHog query failed');
 if(status?.complete===false){
  if(!status.id)throw Error('Missing query reference');
  return {...state,id:status.id};
 }
 const result=status?.results??body;
 if(!Array.isArray(result.results))throw Error('Missing query results');
 return {result:{results:result.results},sourceUpdatedAt:result.last_refresh||null};
}

export async function advanceJob(job,period,options) {
 const now=options.now??Date.now();
 const sections=await Promise.all(job.sections.map(async(state,i)=>{
  if(state.result||state.failed)return state;
  if(now-job.startedAt>MAX_JOB_MS)return {...state,failed:true};
  try{return await queryStep(conversionQueries(period)[i],state,options);}
  catch{return {...state,attempts:(state.attempts||0)+1,failed:(state.attempts||0)>=2};}
 }));
 // Validation is applied before saving any successful result.
 const settled=sections.map(s=>s.result?{status:'fulfilled',value:s.result}:{status:'rejected'});
 let parsed;
 try{parsed=parseConversionResults(settled);}catch{parsed={current:null,previous:null,pages:null,unavailable:['current','previous','pages'],status:'partial'};}
 parsed.unavailable.forEach(name=>{const i=['current','previous','pages'].indexOf(name);if(sections[i].result)sections[i]={failed:true};});
 const done=sections.every(s=>s.result||s.failed);
 return {job:{...job,sections,done},report:{...parsed,period,timezone:'America/New_York',fetchedAt:new Date(now).toISOString(),sourceUpdatedAt:sections.map(s=>s.sourceUpdatedAt||null)}};
}

export function publicReport(row,period,now=Date.now()){
 const stale=!row?.report||now-Date.parse(row.report.fetchedAt)>FRESH_MS;
 const refreshing=(!!row?.job&&!row.job.done)||(stale&&(!row?.job||now-row.job.startedAt>=FRESH_MS));
 const report=row?.report||row?.partial||{period,timezone:'America/New_York',current:null,previous:null,pages:null,status:'partial',unavailable:['current','previous','pages'],fetchedAt:null};
 return {...report,refreshing,stale,hasSavedReport:!!row?.report,refreshFailed:!refreshing&&!!row?.job?.done&&row.job.sections.some(s=>s.failed)};
}
