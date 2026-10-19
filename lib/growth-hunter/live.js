import { SITE, TIMEZONE, shiftDate, reportingPeriod } from '../gsc/report.js';
import { GrowthError, MAX_ROWS, MAX_IMPORT_BYTES, validDate } from './contracts.js';
export const API_COVERAGE = 'gsc_api_final_pages_no_parameters_not_exhaustive';
const unavailable = message => new GrowthError(message, 422, 'insufficient_gsc_data');
// Transport always requests finalized Web data. Never use the dashboard's top-100 summary.
export async function loadGrowthEvidence(query, days, now = new Date()) {
  if (![7, 28].includes(days)) throw new GrowthError('Choose 7 or 28 days.');
  const today = new Intl.DateTimeFormat('en-CA', {timeZone:TIMEZONE,year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
  const available = await query(shiftDate(today,-14),shiftDate(today,-1),['date'],100);
  const end = available.map(row=>row.keys?.[0]).filter(date=>validDate(date)&&date<today).sort().at(-1);
  if (!end || end < shiftDate(today,-14)) throw unavailable('No recent finalized GSC data is available.');
  const period = reportingPeriod(end,days);
  const daily = await query(period.priorStart,period.end,['date'],100);
  const dates = new Set(daily.map(row=>row.keys?.[0]));
  for (let i=0;i<days*2;i++) if(!dates.has(shiftDate(period.priorStart,i))) throw unavailable('GSC has missing reporting dates in this comparison. Try a shorter period or retry after the sync completes.');
  async function snapshot(start,end) {
    const rows=[], seen=new Set();
    for(let offset=0;;offset+=1000) {
      const batch=await query(start,end,['page'],1000,[{dimension:'page',operator:'excludingRegex',expression:'[?#]'}],offset);
      if (!Array.isArray(batch)||batch.length>1000) throw unavailable('GSC returned an invalid page response.');
      if(rows.length+batch.length>MAX_ROWS) throw unavailable('This comparison exceeds the 2,000-page pilot limit. No partial analysis was saved.');
      for(const row of batch) {
        const url=row.keys?.[0];
        if(typeof url!=='string'||(!url.startsWith(SITE)||/[?#\s\\]/.test(url))||url.length>2000||seen.has(url)) throw unavailable('GSC returned an invalid or duplicate page. No analysis was saved.');
        const {clicks,impressions,position,ctr}=row;
        if(!Number.isSafeInteger(clicks)||clicks<0||!Number.isSafeInteger(impressions)||impressions<=0||clicks>impressions||!Number.isFinite(position)||position<1||position>Number.MAX_SAFE_INTEGER||!Number.isFinite(ctr)||Math.abs(ctr-clicks/impressions)>1e-9) throw unavailable('GSC returned invalid page metrics. No analysis was saved.');
        seen.add(url); rows.push({url,clicks,impressions,ctr:clicks/impressions,position});
      }
      if(batch.length<1000) break;
    }
    if(!rows.length) throw unavailable('GSC returned no pages for one comparison period. Missing pages cannot be treated as zero traffic.');
    rows.sort((a,b)=>a.url<b.url?-1:a.url>b.url?1:0);
    const payload={schemaVersion:1,source:'gsc',property:SITE,timezone:TIMEZONE,start,end,coverage:API_COVERAGE,rows};
    if(new TextEncoder().encode(JSON.stringify(payload)).length>MAX_IMPORT_BYTES) throw unavailable('GSC evidence exceeds the storage limit. No partial analysis was saved.');
    return payload;
  }
  const [prior,current]=await Promise.all([snapshot(period.priorStart,period.priorEnd),snapshot(period.start,period.end)]);
  return {prior,current};
}
