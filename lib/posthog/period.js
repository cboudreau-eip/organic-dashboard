import {validDate,dayCount,shiftMonths,monthRange,DateRangeError} from '../gsc/dates.js';
export {DateRangeError};
export const REPORTING_TIMEZONE='America/New_York';
const shift=(date,n)=>new Date(Date.parse(date+'T12:00:00Z')+n*86400000).toISOString().slice(0,10);
const fail=message=>{throw new DateRangeError(message);};
function span(start,end) {
 if(!validDate(start)||!validDate(end)) fail('Enter valid start and end dates.');
 if(start>end) fail('Start date must be on or before end date.');
 if(dayCount(start,end)>366) fail('Choose no more than 366 days per period.');
 if(start<'2000-01-01') fail('Choose reporting dates on or after January 1, 2000.');
}
export function normalizePeriod(input) {
 const s=typeof input==='number'?{mode:'rolling',days:input,compare:'previous'}:input;
 if(!s||!['rolling','month','custom','ytd'].includes(s.mode)) fail('Choose a reporting period.');
 const result={mode:s.mode,compare:s.compare||'previous'};
 if(!['previous','year','custom'].includes(result.compare)) fail('Choose a comparison period.');
 if(s.mode==='rolling') {result.days=Number(s.days);if(![7,28,30,90].includes(result.days)) fail('Choose 7, 28, 30, or 90 complete days.');}
 if(s.mode==='month'){monthRange(s.month);result.month=s.month;}
 if(s.mode==='custom'){span(s.start,s.end);result.start=s.start;result.end=s.end;}
 if(result.compare==='custom'){span(s.priorStart,s.priorEnd);result.priorStart=s.priorStart;result.priorEnd=s.priorEnd;}
 return result;
}
export function completeThrough(now=new Date()) {
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:REPORTING_TIMEZONE,year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
 return shift(today,-1);
}
export function reportingPeriod(input,now=new Date()) {
 const s=normalizePeriod(input),latest=completeThrough(now);
 let start,end,priorStart,priorEnd;
 if(s.mode==='rolling'){end=latest;start=shift(end,1-s.days);}
 else if(s.mode==='month')({start,end}=monthRange(s.month));
 else if(s.mode==='ytd'){
   const today=shift(latest,1);
   start=today.slice(0,4)+'-01-01';end=latest;
   if(start>end) fail('Year to date has no complete days yet. Choose a calendar month instead.');
 } else ({start,end}=s);
 if(s.compare==='custom')({priorStart,priorEnd}=s);
 else if(s.compare==='year'){
   if(s.mode==='month')({start:priorStart,end:priorEnd}=monthRange(shiftMonths(start,-12).slice(0,7)));
   else {priorStart=shiftMonths(start,-12);priorEnd=shiftMonths(end,-12);}
 } else if(s.mode==='month')({start:priorStart,end:priorEnd}=monthRange(shiftMonths(start,-1).slice(0,7)));
 else {priorEnd=shift(start,-1);priorStart=shift(start,-dayCount(start,end));}
 for(const [a,b] of [[start,end],[priorStart,priorEnd]]){span(a,b);if(b>latest)fail('Use complete days only. The latest reporting date is '+latest+'.');}
 const days=dayCount(start,end),priorDays=dayCount(priorStart,priorEnd),warnings=[];
 if(days!==priorDays)warnings.push('Periods have different lengths ('+days+' vs '+priorDays+' days). Counts compare totals, not daily averages.');
 if(start<=priorEnd&&priorStart<=end)warnings.push('These reporting periods overlap.');
 if(s.compare==='year'&&s.mode!=='month'&&(start.endsWith('-02-29')||end.endsWith('-02-29')))warnings.push('February 29 is matched to February 28 in the previous year.');
 return {start,end,priorStart,priorEnd,days,priorDays,compare:s.compare,warnings};
}
export function periodParams(input) {return new URLSearchParams(normalizePeriod(input)).toString();}
export function periodFromParams(params) {
 return normalizePeriod({mode:params.get('mode')||'rolling',days:Number(params.get('days')||7),compare:params.get('compare')||'previous',
 month:params.get('month'),start:params.get('start'),end:params.get('end'),priorStart:params.get('priorStart'),priorEnd:params.get('priorEnd')});
}
export function alignedDays(current,previous) {
 return Array.from({length:Math.max(current.length,previous.length)},(_,i)=>({day:i+1,current:current[i]||null,previous:previous[i]||null}));
}
