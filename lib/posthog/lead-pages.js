import {sessionRows,metrics,counts} from './conversions.js';
export const LEAD_PAGE_LIMIT=2500;
export const LEAD_TIMEZONE='America/Los_Angeles';
export function leadPageQueries(period){
 return [[period.start,period.end],[period.priorStart,period.priorEnd]].map(([start,end])=>({
  kind:'HogQLQuery',
  query:`SELECT entry_host, landing, ${metrics} FROM (${sessionRows(start,end,undefined,LEAD_TIMEZONE,true)}) GROUP BY entry_host, landing ORDER BY contact_sessions DESC, sessions DESC, entry_host ASC, landing ASC LIMIT ${LEAD_PAGE_LIMIT+1}`
 }));
}
export function parseLeadPages(response){
 if(response?.error||!Array.isArray(response?.results))throw new Error('Landing-page conversions unavailable.');
 const seen=new Set();
 const rows=response.results.slice(0,LEAD_PAGE_LIMIT).map(row=>{
  if(!Array.isArray(row)||row.length!==9||!['www.medicarefaq.com','medicarefaq.com'].includes(row[0])||typeof row[1]!=='string'||!row[1].startsWith('/'))throw new Error('Invalid landing-page conversion row.');
  const key=row[0]+row[1];
  if(seen.has(key))throw new Error('Duplicate landing-page conversion row.');
  seen.add(key);
  return {host:row[0],path:row[1],...counts(row.slice(2))};
 });
 return {rows,truncated:response.results.length>LEAD_PAGE_LIMIT,limit:LEAD_PAGE_LIMIT};
}
