import {engagementQuery} from './engagement.js';
import {sessionRows,metrics,counts} from './conversions.js';
export const PAGE_LIMIT=2500;
const states='alabama|alaska|arizona|arkansas|california|colorado|connecticut|delaware|florida|georgia|hawaii|idaho|illinois|indiana|iowa|kansas|kentucky|louisiana|maine|maryland|massachusetts|michigan|minnesota|mississippi|missouri|montana|nebraska|nevada|new-hampshire|new-jersey|new-mexico|new-york|north-carolina|north-dakota|ohio|oklahoma|oregon|pennsylvania|rhode-island|south-carolina|south-dakota|tennessee|texas|utah|vermont|virginia|washington|west-virginia|wisconsin|wyoming|district-of-columbia';
const local=new RegExp(`^/(?:medicare-by-state/[^/]+|medicare-supplement-plans/(?:medigap-by-state/[^/]+|(?:${states})(?:/|$)))`);
export const isLocalPage=path=>local.test(path);
export function performanceQueries(period){
 return [engagementQuery(period.start,period.end,period.granularity==='hour'?period.end:undefined,true),
 {kind:'HogQLQuery',query:`SELECT landing, ${metrics} FROM (${sessionRows(period.start,period.end,undefined,'America/New_York',true)}) GROUP BY landing ORDER BY sessions DESC, landing ASC LIMIT ${PAGE_LIMIT+1}`}];
}
export function parsePerformance(results){
 const rows=new Map(),unavailable=[];let truncated=false;
 for(let i=0;i<2;i++){
  try{
   const r=results[i];if(r?.status!=='fulfilled'||r.value.error||!Array.isArray(r.value.results)||r.value.query_status?.complete===false)throw Error();
   const parsed=r.value.results.slice(0,PAGE_LIMIT).map(row=>{
    if(!Array.isArray(row)||typeof row[0]!=='string'||!row[0].startsWith('/'))throw Error();
    const path=row[0];
    if(i===1)return {path,conversions:counts(row.slice(1))};
    if(row.length!==8)throw Error();
    const [,sessions,measured,seconds,single,bounces,scrollSessions,rawScrollSum]=row;
    // An empty nullable aggregate is valid only when there are no measured samples.
    const scrollSum=scrollSessions===0&&rawScrollSum===null?0:rawScrollSum;
    if(![sessions,measured,single,bounces,scrollSessions].every(n=>Number.isSafeInteger(n)&&n>=0)||!Number.isFinite(seconds)||seconds<0||!Number.isFinite(scrollSum)||scrollSum<0||measured>sessions||single>sessions||bounces>Math.min(measured,single)||scrollSessions>sessions||scrollSum>scrollSessions||(!measured&&seconds!==0))throw Error();
    return {path,engagement:{sessions,measured,duration:measured?seconds/measured:null,bounceRate:measured?100*bounces/measured:null,scrollSessions,scroll:scrollSessions?100*scrollSum/scrollSessions:null}};
   });
   if(new Set(parsed.map(r=>r.path)).size!==parsed.length)throw Error();
   truncated ||=r.value.results.length>PAGE_LIMIT;
   for(const row of parsed)rows.set(row.path,{...rows.get(row.path),...row,local:isLocalPage(row.path)});
  }catch{unavailable.push(i===0?'engagement':'conversions');}
 }
 if(unavailable.length===2)throw Error('Page performance could not be loaded. Please retry.');
 return {rows:[...rows.values()],unavailable,truncated,limit:PAGE_LIMIT,status:unavailable.length?'partial':'complete'};
}
