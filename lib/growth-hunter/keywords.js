import { GrowthError, validDate, validateWindow } from './contracts.js';
import { SITE, TIMEZONE, shiftDate } from '../gsc/report.js';
export const QUERY_VERSION='query-v1';
export const QUERY_LIMIT=2000;
const bad=message=>{throw new GrowthError(message,422,'invalid_query_evidence');};
export function validateQueryTarget({page,priorPeriod,currentPeriod},now=new Date()) {
 if(typeof page!=='string'||!page.startsWith(SITE)||new TextEncoder().encode(page).length>2000||/[?#\s\\]/.test(page))bad('Choose a MedicareFAQ page from the saved analysis.');
 for(const period of [priorPeriod,currentPeriod]) {
  if(!period||!validDate(period.start)||!validDate(period.end))bad('Saved reporting dates are invalid.');
  validateWindow(period.start,period.end,now);
 }
 const days=(Date.parse(currentPeriod.end)-Date.parse(currentPeriod.start))/86400000+1;
 if(![7,28,56,84].includes(days)||shiftDate(priorPeriod.end,1)!==currentPeriod.start||Date.parse(priorPeriod.end)-Date.parse(priorPeriod.start)!==Date.parse(currentPeriod.end)-Date.parse(currentPeriod.start))bad('Saved comparison periods must be adjacent and equal.');
}
export async function loadQueryEvidence(query,target,now=new Date()) {
 validateQueryTarget(target,now);
 const filters=[{dimension:'page',operator:'equals',expression:target.page}];
 async function periodEvidence(period) {
  const rows=[],seen=new Set();
  for(let offset=0;;offset+=1000) {
   const batch=await query(period.start,period.end,['query'],1000,filters,offset);
   if(!Array.isArray(batch)||batch.length>1000)bad('GSC returned invalid keyword data. Please retry.');
   if(rows.length+batch.length>QUERY_LIMIT)bad('This page exceeds the 2,000-query limit for a reporting period. No partial investigation was saved.');
   for(const row of batch) {
    const keyword=row.keys?.[0];
    const {clicks,impressions,ctr,position}=row;
    if(row.keys?.length!==1||typeof keyword!=='string'||!keyword.trim()||keyword.length>2048||/[\u0000-\u001f\u007f]/.test(keyword)||seen.has(keyword))bad('GSC returned invalid or duplicate keywords. Please retry.');
    if(!Number.isSafeInteger(clicks)||clicks<0||!Number.isSafeInteger(impressions)||impressions<=0||clicks>impressions||!Number.isFinite(ctr)||Math.abs(ctr-clicks/impressions)>1e-9||!Number.isFinite(position)||position<1||position>Number.MAX_SAFE_INTEGER)bad('GSC returned invalid keyword metrics. Please retry.');
    seen.add(keyword);rows.push({query:keyword,clicks,impressions,ctr:clicks/impressions,position});
   }
   if(batch.length<1000)break;
  }
  rows.sort((a,b)=>a.query<b.query?-1:a.query>b.query?1:0);
  return {...period,rows};
 }
 const [prior,current]=await Promise.all([periodEvidence(target.priorPeriod),periodEvidence(target.currentPeriod)]);
 const payload={version:QUERY_VERSION,source:'gsc',property:SITE,timezone:TIMEZONE,page:target.page,prior,current,fetchedAt:now.toISOString()};
 if(new TextEncoder().encode(JSON.stringify(payload)).length>1_500_000)bad('Keyword evidence exceeds the storage limit. No partial investigation was saved.');
 return payload;
}
const round=value=>Math.round(value*100)/100;
export function queryPatterns(prior,current) {
 if(prior.clicks<=current.clicks)return [];
 if(prior.impressions<20||current.impressions<20)return ['Too few impressions for pattern labels'];
 const delta=current.position-prior.position,stable=Math.abs(delta)<=.5,patterns=[];
 if(delta>=1)patterns.push('Position worsened: inspect rankings and search results');
 if(stable&&current.impressions<=prior.impressions*.8)patterns.push('Fewer impressions, similar position: inspect demand and visibility');
 if(stable&&prior.ctr-current.ctr>=.005)patterns.push('Lower CTR, similar position: inspect search appearance');
 return patterns.length?patterns:['Mixed movement: inspect query context'];
}
export function compareQueryEvidence(payload) {
 const earlier=new Map(payload.prior.rows.map(row=>[row.query,row]));
 const later=new Map(payload.current.rows.map(row=>[row.query,row]));
 const matched=[],priorOnly=[],currentOnly=[];
 for(const prior of earlier.values()) {
  const current=later.get(prior.query);
  if(!current){priorOnly.push(prior);continue;}
  matched.push({query:prior.query,prior,current,lostClicks:prior.clicks-current.clicks,declinePercent:prior.clicks?round(100*(prior.clicks-current.clicks)/prior.clicks):null,patterns:queryPatterns(prior,current)});
 }
 for(const current of later.values())if(!earlier.has(current.query))currentOnly.push(current);
 matched.sort((a,b)=>b.lostClicks-a.lostClicks||(a.query<b.query?-1:a.query>b.query?1:0));
 const sortMissing=(a,b)=>b.clicks-a.clicks||(a.query<b.query?-1:1);
 return {matched,priorOnly:priorOnly.sort(sortMissing),currentOnly:currentOnly.sort(sortMissing),decliningQueries:matched.filter(row=>row.lostClicks>0).length};
}
