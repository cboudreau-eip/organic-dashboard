export const DEMO_DATES=Array.from({length:90},(_,i)=>new Date(Date.UTC(2027,0,1+i)).toISOString().slice(0,10));
const fail=message=>{throw Object.assign(Error(message),{status:422});};
export function generateCalendar(items,previous=null){
 if(items.length!==90||new Set(items.map(x=>x.id)).size!==90)fail('A calendar requires exactly 90 distinct saved assignments.');
 const locked=previous?.locked||[],dates=Object.fromEntries(locked.map(id=>[id,previous.dates[id]])),remaining=items.filter(x=>!locked.includes(x.id));
 const categories=['Evergreen','High intent','Long-tail','AI citations'],counts=Object.fromEntries(categories.map(c=>[c,0])),totals=Object.fromEntries(categories.map(c=>[c,items.filter(x=>x.category===c).length]));let lastPage=null;
 for(const [index,date] of DEMO_DATES.entries()){
  const fixed=items.find(x=>dates[x.id]===date);if(fixed){counts[fixed.category]++;lastPage=fixed.targetUrl;continue;}
  const candidates=[...remaining].sort((a,b)=>{
   const score=x=>totals[x.category]*(index+1)/90-counts[x.category]+(index===0&&x.category==='Evergreen'?2:0)-(lastPage&&x.targetUrl===lastPage?2:0);
   return score(b)-score(a)||categories.indexOf(a.category)-categories.indexOf(b.category);
  });
  const chosen=candidates[0];dates[chosen.id]=date;counts[chosen.category]++;lastPage=chosen.targetUrl;remaining.splice(remaining.findIndex(x=>x.id===chosen.id),1);
 }
 return {status:'Tentative',dates,locked:[...locked]};
}
export function changeCalendar(calendar,items,input){
 if(!calendar)fail('Generate the tentative calendar first.');
 if(!items.some(x=>x.id===input.itemId))fail('Choose a saved assignment.');
 const next=structuredClone(calendar),locked=new Set(next.locked);
 if(input.action==='calendar-lock'){
  if(typeof input.locked!=='boolean')fail('Choose whether to fix the date.');
  input.locked?locked.add(input.itemId):locked.delete(input.itemId);
 }else{
  if(!DEMO_DATES.includes(input.date))fail('Choose a date from January 1 through March 31, 2027.');
  const old=next.dates[input.itemId],other=Object.keys(next.dates).find(id=>next.dates[id]===input.date);
  if(old===input.date)return next;
  if(locked.has(input.itemId)||locked.has(other))fail('Unfix both affected dates before moving them.');
  next.dates[input.itemId]=input.date;next.dates[other]=old;
  // Both sides of an explicit date swap are manual edits and survive regeneration.
  locked.add(input.itemId);locked.add(other);
 }
 next.locked=[...locked];return next;
}
