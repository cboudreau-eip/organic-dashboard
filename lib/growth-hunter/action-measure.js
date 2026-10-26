import 'server-only';
import {DateRangeError} from '../gsc/dates';
import {searchPerformance} from '../gsc/server';
import {organicOverview} from '../posthog/server';
import {pageIndex} from '../semrush/gsc-pages';
import {landingKey} from '../semrush/lead-impact';
import {validateSnapshot,sameScope} from '../semrush/import';
import {rankEvidence,ActionError} from './actions';
async function rankings(client,action,selection){
 if(!action.source_snapshot)return {available:false,note:'No source Semrush snapshot was attached to this action.'};
 const seedResult=await client.from('semrush_snapshots').select('input').eq('id',action.source_snapshot).maybeSingle();
 if(seedResult.error||!seedResult.data)return {available:false,note:'Source Semrush snapshot unavailable.'};
 const seed=validateSnapshot(seedResult.data.input);
 async function pick(start,end){
  const r=await client.from('semrush_snapshots').select('id,summary,created_at').eq('summary->>campaignId',seed.campaignId).gte('summary->>end',start).lte('summary->>end',end).order('summary->>end',{ascending:false}).order('created_at',{ascending:false}).limit(100);
  if(r.error)throw Error('Snapshot history unavailable.');
  const item=r.data.find(s=>sameScope(seed,{...s.summary,domain:'medicarefaq.com'}));
  if(!item)return null;
  const saved=await client.from('semrush_snapshots').select('input').eq('id',item.id).single();
  if(saved.error)throw Error('Snapshot unavailable.');
  const snapshot=validateSnapshot(saved.data.input);
  if(!sameScope(seed,snapshot)||snapshot.end<start||snapshot.end>end)throw Error('Snapshot scope mismatch.');
  return {id:item.id,snapshot};
 }
 const [before,after]=await Promise.all([pick(selection.priorStart,selection.priorEnd),pick(selection.start,selection.end)]);
 return {available:!!before&&!!after,scope:seed.scope,beforeId:before?.id||null,afterId:after?.id||null,
  ...rankEvidence(action.page,before?.snapshot,after?.snapshot),
  note:'Latest compatible saved snapshot within each window, checking up to 100 reports per window. Only keywords ranking on this exact page in both snapshots with numeric ranks are compared; missing or moved keywords are not assumed lost. Snapshot observations are not period averages.'};
}
export async function measureAction(client,action,selection){
 let gsc;
 try{gsc=await searchPerformance(selection);}catch(e){throw new ActionError(e instanceof DateRangeError?e.message:'GSC data is unavailable. No result was saved; retry later.',409);}
 const [leads,ranks]=await Promise.allSettled([organicOverview(selection,'lead-pages'),rankings(client,action,selection)]);
 if(leads.status!=='fulfilled')throw new ActionError('PostHog data is unavailable. No result was saved; retry later.',503);
 const lead=leads.value,key=landingKey(action.page);
 const find=r=>r.rows.find(p=>p.host+p.path===key)||null;
 return {version:1,period:gsc.period,timezone:'America/Los_Angeles',gsc:{row:pageIndex(gsc.comparisons.pages).get(action.page)||null,coverage:gsc.coverage.pages,limit:gsc.coverage.limit,fetchedAt:gsc.fetchedAt},
  leads:{before:find(lead.previous),after:find(lead.current),beforeTruncated:lead.previous.truncated,afterTruncated:lead.current.truncated,limit:lead.current.limit,fetchedAt:lead.fetchedAt},
  rankings:ranks.status==='fulfilled'?ranks.value:{available:false,note:'Semrush comparison unavailable. Re-run after checking saved snapshots.'},
  disclaimer:'Observed before/after results, not proof of causation. Publication day is excluded. Seasonality, algorithm changes, other edits and tracking changes can affect performance. GSC is Google web search; PostHog covers all organic search engines and CDN-qualified landing sessions with tracked contact submissions, not verified sales.'};
}
