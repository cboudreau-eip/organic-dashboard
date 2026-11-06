import {completeThrough,reportingPeriod} from './period.js';

export function executiveDefaults(now=new Date()){
 const through=completeThrough(now),today=new Date(Date.parse(through+'T12:00:00Z')+86400000);
 const year=today.getUTCFullYear(),month=today.getUTCMonth();
 const previousMonth=new Date(Date.UTC(year,month-1,1)).toISOString().slice(0,7);
 const quarter=Math.floor(month/3);
 return {mode:'month',month:previousMonth,quarter:String(quarter||4),year:String(quarter?year:year-1)};
}
export function executivePeriod(draft,now=new Date()){
 let selection;
 if(draft.mode==='month')selection={mode:'month',month:draft.month,compare:'year'};
 else if(draft.mode==='ytd')selection={mode:'ytd',compare:'year'};
 else if(draft.mode==='quarter'){
  if(!/^\d{4}$/.test(draft.year)||! /^[1-4]$/.test(draft.quarter))throw Error('Choose a valid year and quarter.');
  const y=Number(draft.year),q=Number(draft.quarter);
  selection={mode:'custom',compare:'year',start:new Date(Date.UTC(y,(q-1)*3,1)).toISOString().slice(0,10),end:new Date(Date.UTC(y,q*3,0)).toISOString().slice(0,10)};
 }else throw Error('Choose a reporting period.');
 return {selection,period:reportingPeriod(selection,now)};
}
export function executiveChange(current,prior,complete=true){
 if(!complete||current==null||prior==null)return {text:'Comparison unavailable',tone:'neutral'};
 if(prior===0)return {text:current===0?'No recorded change':'No prior baseline',tone:'neutral'};
 const percent=(current-prior)/prior*100;
 return {text:`${percent>0?'↑ +':percent<0?'↓ ':''}${percent.toFixed(1)}%`,tone:percent>0?'positive':percent<0?'negative':'neutral'};
}
export function leadCoverage(meta,period){
 if(period.start<meta.available.start||period.priorStart<meta.available.start)return 'The selected comparison extends before the imported lead history.';
 if(period.end>meta.leadDataThrough||period.priorEnd>meta.leadDataThrough)return `Lead data is available only through ${meta.leadDataThrough}; this selection extends beyond it.`;
 return null;
}
