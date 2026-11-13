import 'server-only';
import {searchResearchEvidence} from '../gsc/server.js';
import {organicOverview} from '../posthog/server.js';
import {validateSnapshot} from '../semrush/import.js';
import {REPORT_ID,WORKSPACE_ID,ownDomain} from '../otterly/report.js';
const stale=end=>!end||Date.now()-Date.parse(end+'T00:00:00Z')>14*86400000;
export function sourceAdapters(client){return {
 async gsc(previous){
  const chunk=await searchResearchEvidence(previous?.period,previous?.rows?.length||0),rows=[...(previous?.rows||[]),...chunk.rows];
  const capped=chunk.more&&rows.length>=100000;
  return {...chunk,rows,more:chunk.more&&!capped,status:capped?'partial':stale(chunk.period.end)?'stale':'available',note:'Google web query + page rows, last 90 finalized days. Privacy omissions and Search Console limits apply. Up to 100,000 rows; not all search demand.',capped};
 },
 async posthog(){const d=await organicOverview({mode:'rolling',days:90,compare:'previous'},'page-performance');return {...d,status:d.status==='partial'?'partial':'available',note:'Organic landing-page sessions and quote starts over 90 complete days. Page-level context only; completion counts are not used in research ranking.'};},
 async semrush(){
  const r=await client.from('semrush_snapshots').select('id,created_at,input,summary').order('summary->>end',{ascending:false}).limit(20);
  if(r.error)throw Error();
  const valid=(r.data||[]).flatMap(row=>{try{return [{...validateSnapshot(row.input),snapshotId:row.id,fetchedAt:row.created_at}];}catch{return [];}}).sort((a,b)=>b.end.localeCompare(a.end));
  if(!valid.length)throw Error();const d=valid[0];
  return {...d,status:stale(d.end)?'stale':'available',period:{start:d.start,end:d.end},note:'Latest valid saved campaign export. One location/device/engine scope; no live competitor discovery or API refresh.'};
 },
 async otterly(){
  const r=await client.from('otterly_snapshots').select('id,created_at,payload').order('period_end',{ascending:false}).limit(1);
  if(r.error||!r.data?.length)throw Error();const row=r.data[0],d=row.payload;
  if(!ownDomain(d.domain)||d.reportId!==REPORT_ID||d.workspaceId!==WORKSPACE_ID)throw Error('Invalid report scope');
  return {snapshotId:row.id,period:d.period,fetchedAt:d.fetchedAt||row.created_at,prompts:d.prompts||[],status:stale(d.period?.end)?'stale':'available',note:'Saved monitored MedicareFAQ prompts. Mentions and citations are visibility evidence, not search volume.'};
 }
};}
