import {hash,intentFor,tokens} from './topics.js';
import {pageKey} from './inventory.js';
export const POOL_LIMIT=60;
// Reserve discovery space instead of allowing high-volume existing pages to take
// every slot. Ordering within each lane retains the saved research ranking.
export function selectPool(items,year){
 const eligible=items.map((item,i)=>({...item,originalRank:i+1})).filter(item=>{
  if(/\b(?:doctors?|physicians?|hospitals?|equipment suppliers?)\b.*\b(?:near me|take medicare|in network|accept)\b/i.test(item.title))return false;
  const intent=intentFor(item.title,[],year);
  if(['Service / navigation','Historical query'].includes(intent.label))return false;
  return intent.value>=4||/Commercial|Transactional/i.test(item.intent||'');
 });
 const main=eligible.filter(i=>i.type!=='New content candidate').slice(0,40);
 const discovery=eligible.filter(i=>i.type==='New content candidate').slice(0,20);
 return {items:[...main,...discovery].sort((a,b)=>a.originalRank-b.originalRank),counts:{eligible:eligible.length,existing:main.length,discovery:discovery.length,limit:POOL_LIMIT},note:'Up to 40 ranked existing-page opportunities and 20 new-page candidates. No minimum quota is filled with weak or service-only searches.'};
}
export function enrichCandidates(assignments,inventory,complete){
 const pages=(inventory||[]).filter(p=>pageKey(p.url));
 for(const a of assignments){
  const terms=new Set(tokens(a.topics.map(t=>t.title).join(' ')));
  const related=pages.map(p=>({p,score:tokens([p.title,...(p.headings||[]),new URL(p.url).pathname].join(' ')).filter(t=>terms.has(t)).length})).filter(p=>p.score>1).sort((a,b)=>b.score-a.score);
  const candidates=[...new Set([a.targetUrl,...a.candidateUrls,...related.map(x=>pageKey(x.p.canonical||x.p.url))].filter(Boolean))];
  a.candidateUrls=candidates.slice(0,3);
  a.coverage={inventoryComplete:complete,inventoryPages:pages.length,relatedCount:related.length,inspectedLimit:3,related:related.slice(0,8).map(({p})=>({url:p.url,title:p.title,status:p.status}))};
  a.lane=a.targetUrl?'Existing page':'New-page investigation';
  a.businessReason=[...new Set(a.topics.map(t=>t.intent))].join(' / ')+'. Priority comes from the saved research score; it is not a lead or revenue forecast.';
 }
 return assignments;
}
// Retain decisions with their old evidence. A changed proposal is never silently
// promoted to an approved assignment, even when its URL/key is unchanged.
export function assignmentFingerprint(a,dates={}){
 const stable=v=>Array.isArray(v)?v.map(stable):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().filter(k=>!['validatedAt','fetchedAt','checkedAt','rank'].includes(k)).map(k=>[k,stable(v[k])])):v;
 return hash(JSON.stringify(stable({target:a.targetUrl,topics:a.topics,dates,result:{findings:a.result?.findings,readiness:a.result?.readiness,verification:a.result?.verification}})));
}
export function priorDecision(previous,assignment,dates){
 if(!previous)return null;
 return {...previous,changed:previous.fingerprint!==assignmentFingerprint(assignment,dates)};
}
