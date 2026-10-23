import {shiftDate} from './report.js';
export class DateRangeError extends Error {}
const fail = message => { throw new DateRangeError(message); };
export function validDate(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(value+'T12:00:00Z')) && new Date(value+'T12:00:00Z').toISOString().slice(0,10)===value;
}
export function dayCount(start,end) { return Math.round((Date.parse(end+'T12:00:00Z')-Date.parse(start+'T12:00:00Z'))/86400000)+1; }
export function shiftMonths(date,months) {
  const d=new Date(date+'T12:00:00Z'), day=d.getUTCDate();
  d.setUTCDate(1);d.setUTCMonth(d.getUTCMonth()+months);
  const last=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,0)).getUTCDate();
  d.setUTCDate(Math.min(day,last));return d.toISOString().slice(0,10);
}
export function monthRange(month) {
  if(typeof month!=='string'||!/^\d{4}-\d{2}$/.test(month)||!validDate(month+'-01')) fail('Choose a valid calendar month.');
  const start=month+'-01';
  return {start,end:shiftDate(shiftMonths(start,1),-1)};
}
export function normalizeSelection(input) {
  const value=typeof input==='number'?{mode:'rolling',days:input}:input;
  if(!value||!['rolling','month','custom'].includes(value.mode)) fail('Choose a reporting period.');
  const compare=value.compare||'previous';
  if(!['previous','year','custom'].includes(compare)) fail('Choose a comparison period.');
  const selection={mode:value.mode,compare};
  if(value.mode==='rolling') {
    selection.days=Number(value.days);
    if(![7,28,30].includes(selection.days)) fail('Choose 7, 28, or 30 finalized days.');
  } else if(value.mode==='month') {monthRange(value.month);selection.month=value.month;}
  else {selection.start=value.start;selection.end=value.end;validateSpan(selection.start,selection.end);}
  if(compare==='custom'){selection.priorStart=value.priorStart;selection.priorEnd=value.priorEnd;validateSpan(selection.priorStart,selection.priorEnd);}
  return selection;
}
function validateSpan(start,end) {
  if(!validDate(start)||!validDate(end)) fail('Enter valid start and end dates.');
  if(start>end) fail('Start date must be on or before end date.');
  if(dayCount(start,end)>366) fail('Choose no more than 366 days per period.');
}
export function resolvePeriod(input,latest,today) {
  const s=normalizeSelection(input);
  let start,end;
  if(s.mode==='rolling'){end=latest;start=shiftDate(end,1-s.days);}
  else if(s.mode==='month')({start,end}=monthRange(s.month));
  else ({start,end}=s);
  let priorStart,priorEnd;
  if(s.compare==='custom')({priorStart,priorEnd}=s);
  else if(s.compare==='year') {
    if(s.mode==='month') ({start:priorStart,end:priorEnd}=monthRange(shiftMonths(start,-12).slice(0,7)));
    else {priorStart=shiftMonths(start,-12);priorEnd=shiftMonths(end,-12);}
  } else if(s.mode==='month') ({start:priorStart,end:priorEnd}=monthRange(shiftMonths(start,-1).slice(0,7)));
  else {priorEnd=shiftDate(start,-1);priorStart=shiftDate(start,-dayCount(start,end));}
  const earliest=shiftMonths(today,-16);
  for(const [a,b] of [[start,end],[priorStart,priorEnd]]) {
    validateSpan(a,b);
    if(b>latest) fail('Finalized GSC data is available only through '+latest+'. Choose an earlier end date.');
    if(a<earliest) fail('This comparison falls outside the 16-month GSC history window. Choose dates on or after '+earliest+'.');
  }
  const days=dayCount(start,end),priorDays=dayCount(priorStart,priorEnd);
  const warnings=[];
  if(days!==priorDays) warnings.push('Periods have different lengths ('+days+' vs '+priorDays+' days). Cards compare totals, not daily averages.');
  if(start<=priorEnd&&priorStart<=end) warnings.push('These reporting periods overlap.');
  if(s.compare==='year'&&s.mode!=='month'&&(start.endsWith('-02-29')||end.endsWith('-02-29'))) warnings.push('February 29 is matched to February 28 in the previous year.');
  return {start,end,priorStart,priorEnd,days,priorDays,compare:s.compare,warnings};
}
export function trendRows(result) {
  const p=result.period, a=new Map(result.daily.map(r=>[r.keys[0],r.clicks]));
  return Array.from({length:Math.max(dayCount(p.start,p.end),dayCount(p.priorStart,p.priorEnd))},(_,i)=>{
    const date=shiftDate(p.start,i),previousDate=shiftDate(p.priorStart,i);
    return {day:i+1,date:date<=p.end?date:null,previousDate:previousDate<=p.priorEnd?previousDate:null,
      current:date<=p.end?(a.get(date)??0):null,previous:previousDate<=p.priorEnd?(a.get(previousDate)??0):null};
  });
}
