import {hash,tokens,normalizedTopic,entities} from './topics.js';
import {pageKey,inventoryEntry} from './inventory.js';
import {readPublicPage,safePage,rankPages} from '../otterly/content-sources.js';
const query=i=>i.titleEdited?i.title:i.terms?.[0]||i.title;
export const targetFingerprint=i=>hash(JSON.stringify(['targets-v1',i.title,i.action,i.terms,i.notes||'']));
const normalized=t=>normalizedTopic(t).replace(/\b(costs?|pricing|prices?|rates?|premiums?)\b/g,'cost').replace(/\b(apply|applying|enrollment|enroll|signing up|sign up)\b/g,'enrollment');
const meaningful=t=>tokens(normalized(t)).filter(w=>!['medicare','plan','insurance','what','much','does','monthly','average'].includes(w));
const factsFit=(term,text)=>{const a=entities(term),b=entities(text);return ['carriers','states','plans','parts'].every(k=>a[k].every(x=>b[k].includes(x)));};
export function verifyTarget(item,page){
 if(page.status!=='read'||!safePage(page.url)||new URL(page.url).pathname==='/'||page.text?.length<300)return null;
 if(page.canonical&&pageKey(page.canonical)!==pageKey(page.url))return null;
 const term=query(item),words=meaningful(term);if(!words.length||words.length===1&&['medigap','enrollment','cost','coverage','benefits','advantage'].includes(words[0]))return null;
 const identity=entities(term),pageIdentity=entities(page.title+' '+new URL(page.url).pathname.replaceAll('-',' '));
 if(['plans','parts','states','carriers'].some(k=>pageIdentity[k].some(v=>!identity[k].includes(v))))return null;
 if(/high.deductible/i.test(page.title+' '+page.url)&&!/high.deductible/i.test(term))return null;
 const candidates=[...(page.headings||[]).map(h=>({heading:h,excerpt:page.text.slice(Math.max(0,page.text.toLowerCase().indexOf(h.toLowerCase())-60),Math.max(0,page.text.toLowerCase().indexOf(h.toLowerCase())-60)+1100)})),...Array.from({length:Math.ceil(page.text.length/700)},(_,n)=>({heading:'Content passage',excerpt:page.text.slice(n*700,n*700+1100)}))];
 const ranked=candidates.map(p=>{const content=p.heading+' '+p.excerpt,found=new Set(meaningful(content));const coverage=words.filter(w=>found.has(w)).length/words.length;
  // Age, year and geographic qualifiers must occur in the same evidence passage.
  const qualifiers=term.match(/\b(?:20\d{2}|[6-9]0|online|underwriting|employer|state|age)\b/gi)||[];
  const directional=/\b(switch|change|switching|changing)\b/i.test(term)&&/\bfrom\b/i.test(term);
  const directionText=t=>normalized(t).replace(/\b(a|an|the)\b/g,'').replace(/\s+/g,' ');
  const directionFit=!directional||directionText(content).includes(directionText(term).match(/from (.+?) to ([^?]+)/i)?.[0]?.replace(/ without.*$/,'')||'__no_direction__');
  const fit=directionFit&&factsFit(term,content)&&qualifiers.every(q=>new RegExp('\\b'+q+'\\b','i').test(content));
  return {...p,coverage,fit};}).filter(p=>p.fit&&p.coverage>=.85).sort((a,b)=>b.coverage-a.coverage);
 const best=ranked[0];if(!best)return null;
 return {url:page.url,title:page.title,heading:best.heading,excerpt:best.excerpt,coverage:Math.round(best.coverage*100),fetchedAt:page.fetchedAt,canonical:page.canonical||page.url};
}
export function currentResolution(item,record,now=Date.now()){
 const r=record?.result,t=Date.parse(r?.checkedAt);return r&&record.fingerprint===targetFingerprint(item)&&Number.isFinite(t)&&t<=now+60000&&now-t<7*86400000&&(r.inputTarget===(item.targetUrl||'')||pageKey(r.recommendation?.url)&&pageKey(r.recommendation.url)===pageKey(item.targetUrl))?r:null;
}
export async function resolveTarget(item,inventory=[],read=readPublicPage,now=new Date()){
 const urls=[...new Set([item.targetUrl,...(item.quality?.candidates||[]).map(p=>p.url),...rankPages(query(item),inventory.map(p=>p.url).filter(safePage))].map(safePage).filter(Boolean))].slice(0,4);
 const results=await Promise.all(urls.map(async url=>{try{const page=inventoryEntry(url,await read(url),now);const evidence=verifyTarget(item,page);return {requested:url,status:evidence?'Supported match':'No sufficient match',page:{url:page.url,title:page.title,status:page.status,fetchedAt:page.fetchedAt},evidence};}catch{return {requested:url,status:'Could not retrieve page'};}}));
 const supported=results.flatMap(r=>r.evidence?[r.evidence]:[]),assigned=supported.find(p=>pageKey(p.url)===pageKey(item.targetUrl));
 const unique=[...new Map(supported.map(p=>[pageKey(p.url),p])).values()];
 const recommendation=assigned|| (unique.length===1?unique[0]:null);
 return {checkedAt:now.toISOString(),inputTarget:item.targetUrl||'',query:query(item),status:assigned?'Current target supported':recommendation?'Recommended target ready':unique.length>1?'Multiple supported pages — choose scope':'More research needed',recommendation,alternatives:unique,checks:results,
  proposedWork:recommendation?`Review and improve ${recommendation.heading==='Content passage'?'the matching passage':'the section “'+recommendation.heading+'”'} on the recommended page for “${query(item)}”. Retain the assignment’s existing work instructions; verify the specific gap before drafting.`:'No page change recommended yet. Broaden research or inspect the content manually; unsuccessful matching does not prove that a new page is needed.',
  limitation:'Up to four candidate pages were checked live. Matching supports page relevance, not a proven content gap or publishing approval. Evidence expires after seven days or a scope edit. No article was written.'};
}
export function applyTargetResolutions(plan,records=[],now=Date.now()){
 if(!plan)return plan;let processed=0,recommended=0,verified=0;
 const items=plan.payload.items.map(i=>{const record=records.find(r=>r.item_id===i.id),r=currentResolution(i,record,now);if(!r)return {...i,targetResolution:record?{status:'Recheck needed',limitation:'Assignment scope, target or evidence freshness changed. Run page targeting again.'}:null};
  processed++;if(r.recommendation)recommended++;
  const evidence=r.checks?.map(c=>c.evidence).find(p=>p&&pageKey(p.url)===pageKey(i.targetUrl));
  const canClear=evidence&&factsFit(query(i),evidence.heading+' '+evidence.excerpt)&&evidence.coverage>=85&&pageKey(evidence.canonical)===pageKey(i.targetUrl);
  const clearable=['target-scope','target-weak-match','target-unreadable','target-not-in-inventory'];
  const cleared=canClear?i.quality.flags.filter(f=>clearable.includes(f.code)):[];if(canClear)verified++;
  const flags=i.quality.flags.filter(f=>!cleared.includes(f));
  return {...i,targetResolution:{...r,status:canClear?'Current target supported':r.status,clearedFlags:cleared},quality:{...i.quality,flags,status:flags.length?'Needs attention':canClear?'Target verified; no other issue detected':'No issue detected'}};
 });
 const count=fn=>items.filter(i=>i.quality.flags.some(fn)).length;
 return {...plan,payload:{...plan.payload,items},qualityAudit:{...plan.qualityAudit,flagged:count(()=>true),noIssueDetected:items.filter(i=>!i.quality.flags.length).length,overlap:count(f=>f.code==='intent-overlap'),sharedPage:count(f=>f.code==='shared-page'),targeting:count(f=>f.code.startsWith('target-')||f.code==='inventory-unavailable')},targetResolutionSummary:{processed,recommended,verified,remaining:items.filter(i=>i.quality.flags.length&&!currentResolution(i,records.find(r=>r.item_id===i.id),now)).length}};
}
