// Calendar-date arithmetic only: source days are not reinterpreted as UTC events.
const DAY = 86400000;
export class PeriodError extends Error {}
export function validDate(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value+'T00:00:00Z').toISOString().slice(0,10) === value;
}
const shift = (date, days) => new Date(Date.parse(date+'T00:00:00Z')+days*DAY).toISOString().slice(0,10);
const dayCount = (start,end) => Math.round((Date.parse(end)-Date.parse(start))/DAY)+1;
function monthEnd(month) { const [y,m]=month.split('-').map(Number); return new Date(Date.UTC(y,m,0)).toISOString().slice(0,10); }
function moveMonth(month, delta) { const [y,m]=month.split('-').map(Number); return new Date(Date.UTC(y,m-1+delta,1)).toISOString().slice(0,7); }
function sameDay(date, delta) { const month=moveMonth(date.slice(0,7),delta); return month+'-'+String(Math.min(Number(date.slice(8)),Number(monthEnd(month).slice(8)))).padStart(2,'0'); }
export function validateDaily(data) {
  if (!data || data.version!==1 || !validDate(data.period?.start) || !validDate(data.period?.end) || !validDate(data.leadDataThrough) || data.leadDataThrough<data.period.start || data.leadDataThrough>data.period.end || !Number.isFinite(Date.parse(data.exportedAt)) || !Array.isArray(data.metrics) || data.metrics.length!==8 || !Array.isArray(data.rows) || data.rows.length>4000 || data.rows.length!==dayCount(data.period.start,data.period.end)) throw new Error('Invalid daily report');
  const keys=['allLeads','filteredLeads','soldLeads','eipLeads','grossMS','grossMA','approvedMS','approvedMA'];
  if(data.metrics.some((m,i)=>m.key!==keys[i] || typeof m.label!=='string' || m.label.length>100)) throw new Error('Invalid metric definitions');
  data.rows.forEach((row,i)=>{if(row.date!==shift(data.period.start,i) || keys.some(k=>row.values?.[k]!==null && (!Number.isSafeInteger(row.values?.[k]) || row.values[k]<0))) throw new Error('Invalid daily rows');});
  for(const key of keys) if(!Number.isSafeInteger(data.totals?.[key]) || data.rows.reduce((sum,row)=>sum+(row.values[key]??0),0)!==data.totals[key]) throw new Error('Daily totals do not reconcile');
  return data;
}
export function resolvePeriods(data, input={}) {
  const allowed=['mode','month','compare','start','end','priorStart','priorEnd'];
  if(Object.keys(input).some(k=>!allowed.includes(k) || typeof input[k]!=='string' || input[k].length>20)) throw new PeriodError('Invalid comparison options.');
  const mode=input.mode||'month', compare=input.compare||'previous';
  if(!['month','mtd','custom'].includes(mode) || !['previous','year','custom'].includes(compare)) throw new PeriodError('Choose a supported comparison.');
  const month=input.month||moveMonth(data.leadDataThrough.slice(0,7),-1);
  if(!/^\d{4}-\d{2}$/.test(month) || !validDate(month+'-01')) throw new PeriodError('Choose a valid month.');
  let start,end,priorStart,priorEnd;
  if(mode==='month'){start=month+'-01';end=monthEnd(month);}
  else if(mode==='mtd'){start=data.leadDataThrough.slice(0,7)+'-01';end=data.leadDataThrough;}
  else {start=input.start;end=input.end;}
  if(!validDate(start)||!validDate(end)||start>end) throw new PeriodError('Choose valid start and end dates.');
  if(compare==='custom'){priorStart=input.priorStart;priorEnd=input.priorEnd;}
  else if(compare==='year'){priorStart=sameDay(start,-12);priorEnd=sameDay(end,-12);}
  else if(mode==='month'){priorStart=moveMonth(month,-1)+'-01';priorEnd=monthEnd(priorStart.slice(0,7));}
  else if(mode==='mtd'){priorStart=moveMonth(start.slice(0,7),-1)+'-01';priorEnd=sameDay(end,-1);}
  else {priorEnd=shift(start,-1);priorStart=shift(start,-dayCount(start,end));}
  if(!validDate(priorStart)||!validDate(priorEnd)||priorStart>priorEnd) throw new PeriodError('Choose valid comparison dates.');
  for(const [a,b] of [[start,end],[priorStart,priorEnd]]) if(a<data.period.start || b>data.period.end || dayCount(a,b)>366) throw new PeriodError('Choose up to 366 days within imported history ('+data.period.start+' to '+data.period.end+').');
  return {mode,compare,month,start,end,priorStart,priorEnd};
}
export function summarize(data,start,end) {
  const rows=data.rows.filter(r=>r.date>=start&&r.date<=end),days=dayCount(start,end);
  return {start,end,days,metrics:data.metrics.map(m=>{const values=rows.map(r=>r.values[m.key]).filter(v=>v!==null);const total=values.length?values.reduce((a,b)=>a+b,0):null;return {...m,total,reportedDays:values.length,missingDays:days-values.length,dailyAverage:values.length===days?total/days:null};})};
}
export function compareDaily(data,input={}) {
  const selection=resolvePeriods(data,input),current=summarize(data,selection.start,selection.end),previous=summarize(data,selection.priorStart,selection.priorEnd);
  const metrics=current.metrics.map((m,i)=>{const prior=previous.metrics[i],complete=!m.missingDays&&!prior.missingDays;const delta=complete?m.total-prior.total:null;return {...m,previous:prior,delta,percentChange:complete&&prior.total!==0?delta/prior.total*100:null,comparisonStatus:!complete?'Incomplete daily values':prior.total===0?(m.total===0?'No change':'No prior baseline'):'complete'};});
  const months=[]; for(let month=data.period.start.slice(0,7);month<=data.period.end.slice(0,7);month=moveMonth(month,1)){const start=month+'-01',end=monthEnd(month);const actualStart=start<data.period.start?data.period.start:start,actualEnd=end>data.period.end?data.period.end:end;months.push({month,partial:actualStart!==start||actualEnd!==end,...summarize(data,actualStart,actualEnd)});}
  return {selection,current:{start:current.start,end:current.end,days:current.days},previous:{start:previous.start,end:previous.end,days:previous.days},metrics,months,source:'Datorama',url:data.url,scope:data.scope,dateBasis:data.dateBasis,timezone:data.timezone,exportedAt:data.exportedAt,available:data.period,leadDataThrough:data.leadDataThrough,overlapping:selection.start<=selection.priorEnd&&selection.priorStart<=selection.end};
}
export function createPeriodsHandler({authorize,load}) {
  const reply=(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'private, no-store'}});
  return async request=>{
    try {
      if(!await authorize())return reply({error:'Sign in to view imported reports.'},401);
      const params=new URL(request.url).searchParams;
      if([...params.keys()].some(k=>params.getAll(k).length>1))throw new PeriodError('Repeated comparison options are not supported.');
      const data=await load();if(!data)return reply({error:'Daily Datorama data has not been imported.'},404);
      return reply(compareDaily(validateDaily(data),Object.fromEntries(params)));
    } catch(error){return reply({error:error instanceof PeriodError?error.message:'The daily Datorama report could not be loaded.'},error instanceof PeriodError?400:503);}
  };
}
