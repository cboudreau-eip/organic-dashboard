import {hash,tokens,normalizedTopic,entities,productFor} from './topics.js';
import {pageKey,inventoryEntry} from './inventory.js';
import {readPublicPage} from '../otterly/content-sources.js';
import {assignmentPresentation} from './proposal-presentation.js';
import {publicProposalPlan} from './proposals.js';
import {proposalIntentOverlap} from './proposal-audit.js';
import {repairCalendar} from './repair-calendar.js';

const query=i=>i.titleEdited?i.title:i.terms?.[0]||i.title;
export const focusedFingerprint=i=>hash(JSON.stringify([i.title,i.action,i.targetUrl,i.terms,i.notes||'']));
const normalized=t=>normalizedTopic(t).replace(/\b(costs?|prices?|pricing|premiums?|rates?|affordable|budget)\b/g,'cost').replace(/\b(apply|applying|enroll|enrollment|sign up|signing up)\b/g,'enrollment').replace(/\b(comparing|comparisons?|compare|choosing|choose|best|options)\b/g,'compare').replace(/\b(medications?|prescriptions?|drugs?)\b/g,'drug').replace(/\b(health questions|medical questions)\b/g,'underwriting').replace(/\b(over|after) (\d+)\b/g,'age $2').replace(/\b(seniors? \d+) up\b/g,'age $1');
const filler=new Set('medicare medicarefaq insurance plan need separate have based who provides unbiased clearly resource explains confused about where review reviews current officially announced been has it fits work works affect affects do would will any most much per month monthly average seniors senior up for you should what benefits coverage guide explained updated know complete simple steps step if when insurers ask pass ll pay save confirmed far'.split(' '));
export const focusWords=t=>tokens(normalized(String(t).replace(/&#x27;|&#39;/gi,"'"))).filter(w=>!filler.has(w)&&!/^20\d{2}$/.test(w));
const ratio=(a,b)=>a.length?a.filter(w=>b.has(w)).length/a.length:0;
const idFit=(a,b)=>['plans','parts','states','carriers'].every(k=>a[k].every(x=>b[k].includes(x)));
const hasSignal=i=>{
 const terms=new Set((i.terms||[query(i)]).map(normalizedTopic)),matches=t=>terms.has(normalizedTopic(t||''));
 return (i.evidence?.gsc||[]).some(r=>matches(r.keys?.[0])&&r.impressions>0)||(i.evidence?.semrush||[]).some(r=>matches(r.keyword)&&r.volume>0)||(i.evidence?.otterly||[]).some(r=>matches(r.prompt))||(i.revision?.rows||[]).some(r=>matches(r.term)&&['MFAQ','MC+MFAQ'].includes(r.account)&&!r.qualityIssue&&r.clicks>=20&&r.leads>=5&&r.sales>0);
};
export function currentFocusedDecision(i,now=Date.now()){
 const d=i.targetDecision,t=Date.parse(d?.checkedAt);
 return d&&d.fingerprint===focusedFingerprint(i)&&Number.isFinite(t)&&t<=now+60000&&now-t<7*86400000?d:null;
}
export function focusedCandidates(item,inventory,source={}){
 const term=query(item),wanted=focusWords(term),identity=entities(term),observed=new Set();
 // Only observations for this assignment's actual queries influence ranking.
 const terms=new Set((item.terms||[term]).map(normalizedTopic));
 for(const r of source.evidence?.gsc?.rows||[])if(terms.has(normalizedTopic(r.keys?.[0]||'')))observed.add(pageKey(r.keys?.[1]));
 for(const r of source.evidence?.semrush?.rows||[])if(terms.has(normalizedTopic(r.keyword||'')))observed.add(pageKey(r.landing));
 const seen=new Set();
 return inventory.filter(p=>pageKey(p.url)&&new URL(p.url).pathname!=='/').map(p=>{
  const title=p.title+' '+new URL(p.url).pathname.replaceAll('-',' '),words=focusWords(p.title||title),head=focusWords((p.headings||[]).join(' ')),id=entities(title);
  const q=ratio(wanted,new Set(words)),reverse=ratio(words,new Set(wanted));
  const conflicts=['carriers','states','plans','parts'].some(k=>id[k].some(v=>!identity[k].includes(v)));
  const year=term.match(/\b20\d{2}\b/)?.[0];
  const score=q*60+reverse*20+ratio(wanted,new Set(head))*10+(observed.has(pageKey(p.url))?12:0)+(pageKey(p.url)===pageKey(item.targetUrl)?3:0)+(identity.carriers.length&&identity.carriers.every(c=>id.carriers.includes(c))?25:0)+(year&&title.includes(year)?20:0)-(conflicts?35:0);
  return {...p,focusScore:score,queryCoverage:q,direct:observed.has(pageKey(p.url))};
 }).filter(p=>p.focusScore>8).sort((a,b)=>b.focusScore-a.focusScore).filter(p=>{const k=pageKey(p.canonical||p.url);if(seen.has(k))return false;seen.add(k);return true;}).slice(0,6);
}
export function verifyFocusedTarget(item,page){
 if(page.status!=='read'||page.text?.length<300||!pageKey(page.url)||new URL(page.url).pathname==='/'||page.canonical&&pageKey(page.canonical)!==pageKey(page.url))return null;
 const term=query(item),wanted=focusWords(term),identity=entities(term),title=page.title+' '+new URL(page.url).pathname.replaceAll('-',' '),titleIdentity=entities(title);
 if(identity.carriers.includes('aarp')&&titleIdentity.carriers.includes('aarp'))titleIdentity.carriers=titleIdentity.carriers.filter(c=>c!=='unitedhealthcare');
 const titleWords=focusWords(page.title.split('|')[0].replace(/\b(methods?|community.rated|issue.age|attained.age)\b/gi,'age')).filter(w=>!(identity.carriers.length&&['cost','compare','eligibility','enrollment','unitedhealthcare'].includes(w)&&!wanted.includes(w)));
 if(!wanted.length||['carriers','states','plans','parts'].some(k=>titleIdentity[k].some(v=>!identity[k].includes(v))))return null;
 if(['carriers','states'].some(k=>identity[k].some(v=>!titleIdentity[k].includes(v))))return null;
 if(/high.deductible/i.test(title)&&!/high.deductible/i.test(term))return null;
 // An Advantage page cannot stand in for a Medigap page, or vice versa.
 if(productFor(term)==='Medigap'&&/advantage/i.test(title)&&!/medigap|supplement/i.test(title))return null;
 const titleOverlap=ratio(titleWords,new Set(wanted)),queryOverlap=ratio(wanted,new Set(titleWords));
 if(titleOverlap<.7||queryOverlap<.4)return null;
 const spans=Array.from({length:Math.ceil(page.text.length/600)},(_,n)=>page.text.slice(n*600,n*600+1600));
 const qualifiers=term.match(/\b(?:[6-9]0|online|underwriting|employer|pharmacy)\b/gi)||[];
 const candidates=spans.map(excerpt=>({excerpt,coverage:ratio(wanted,new Set(focusWords(excerpt)))})).filter(p=>p.coverage>=.75&&idFit(identity,entities(p.excerpt))&&qualifiers.every(w=>new RegExp('\\b'+w+'\\b','i').test(p.excerpt)));
 const best=candidates.sort((a,b)=>b.coverage-a.coverage)[0];if(!best)return null;
 return {url:page.url,canonical:page.canonical||page.url,title:page.title,heading:'Verified topic passage',excerpt:best.excerpt,coverage:Math.round(best.coverage*100),fetchedAt:page.fetchedAt};
}
export function newPageEvidence(item,inventory,checks){
 if(!hasSignal(item)||checks.length<3||checks.some(c=>c.status!=='read')||checks.some(c=>c.supported)||inventory.length<20)return null;
 // New-page direction requires a genuinely distinct entity absent from the
 // inventory's titles/URLs, not merely a failed lexical match or failed fetch.
 const identity=entities(query(item)),missing=['carriers','states'].flatMap(k=>identity[k].filter(v=>!inventory.some(p=>entities(p.title+' '+p.url.replaceAll('-',' '))[k].includes(v))));
 if(!missing.length)return null;
 return {missingEntities:missing,inventoryPages:inventory.length,limitation:'No suitable entity-specific page found in the saved inventory and checked related pages. This bounded review supports tentative planning, not proof that no page exists; recheck before creating a URL.'};
}
const targetFlag=i=>i.quality?.flags.some(f=>f.code.startsWith('target-')||f.code==='inventory-unavailable');
export function focusedPending(original,reviewed){return reviewed.payload.items.filter(i=>targetFlag(i)&&!Object.hasOwn(original.edits||{},i.id)&&!currentFocusedDecision(i));}

export async function focusTargets(original,reviewed,source,paid,settings={},reader=readPublicPage,now=new Date()){
 const inventory=source.inventory?.pages||[],pending=focusedPending(original,reviewed).slice(0,2),items=structuredClone(original.payload.items),cache=new Map(),rawCache=new Map(),changes=[],records=[];
 const cachedReader=url=>{const key=pageKey(url);if(!rawCache.has(key))rawCache.set(key,reader(key));return rawCache.get(key);};
 const read=async url=>{const key=pageKey(url);if(!key)return null;if(!cache.has(key))cache.set(key,cachedReader(key).then(r=>inventoryEntry(key,r,now)).catch(()=>null));return cache.get(key);};
 for(const visible of pending){
  const old=items.find(i=>i.id===visible.id),ranked=focusedCandidates(visible,inventory,source).slice(0,4);
  const checks=await Promise.all(ranked.map(async candidate=>{const p=await read(candidate.url),e=p&&verifyFocusedTarget(visible,p);return {url:candidate.url,title:p?.title||candidate.title,status:p?.status||'unavailable',fetchedAt:p?.fetchedAt||now.toISOString(),score:Math.round(candidate.focusScore),direct:candidate.direct,supported:!!e,evidence:e};}));
  for(const c of checks)c.assignedTo=items.filter(i=>i.id!==old.id&&pageKey(original.edits?.[i.id]?.targetUrl??i.targetUrl)===pageKey(c.evidence?.url||c.url)).map(i=>({id:i.id,title:original.edits?.[i.id]?.title||i.title}));
  const available=checks.filter(c=>c.supported&&!c.assignedTo.length);
  // Deterministic best fit: exact topic and observed query-to-page signals rank
  // before broad hub pages; retain all checked alternatives for review.
  const chosen=available[0]?.evidence;
  let next={...old},kind='Needs research',reason='No distinct, sufficiently supported target was found. The assignment remains flagged; no page is invented.',page=null,gap=null;
  if(checks.some(c=>c.supported&&c.assignedTo.length))reason='Supported pages already have calendar assignments. No separate target or safe replacement was found; coordinate the scope before scheduling additional work on those pages.';
  if(chosen){kind='Existing-page update';page=chosen;reason='Selected the strongest available live-verified topic match; retained the other checked pages and query-to-page signals as evidence.';
   next.targetUrl=chosen.url;next.type='Existing-page investigation';next.action=`Update the existing page “${chosen.title}” for “${query(visible)}”. Review the verified passage, answer the specific question directly, and improve the relevant decision guidance and authoritative references. Check what is already covered before drafting; do not create a competing article. Verify 2027 facts where applicable.`;
  }else if((gap=newPageEvidence(visible,inventory,checks))&&!reviewed.payload.items.some(i=>i.id!==old.id&&proposalIntentOverlap(i,visible))){
   kind='New-page proposal';reason='Observed demand addresses a distinct entity not represented in the screened inventory. Related pages were read successfully but did not establish a suitable target.';
   next.targetUrl='';next.type='New-page proposal';next.action=`Plan a distinct page answering “${query(visible)}”. Differentiate it from the checked related pages and link to the relevant existing guides. Reconfirm the site-wide coverage gap and current facts before choosing a URL or drafting. No article or URL has been created.`;
  }
  next.targetDecision={kind,reason,checkedAt:now.toISOString(),query:query(visible),checks,page,gap,inventoryPages:inventory.length,sourceDates:original.payload.sourceDates,tentative:true,limitation:'Evidence supports a planning direction, not publishing approval. Recheck after seven days or any assignment edit.'};
  if(kind==='Needs research'){
   // Replace only this unresolved slot, using the existing source-backed repair
   // rules. Other assignments remain visible to its overlap/target guards.
   const current={...original,payload:{...original.payload,items}},scoped={...reviewed,payload:{...reviewed.payload,items:publicProposalPlan(current).payload.items.map(i=>({...i,quality:{flags:i.id===old.id?[{code:'target-unassigned',related:[]}]:[]}}))}};
   const repair=await repairCalendar(current,scoped,source,paid,settings,cachedReader,now,{maxMs:45000,maxPages:8});
   const replacement=repair.changes.find(c=>c.id===old.id);
   if(replacement){next={...replacement.item,targetDecision:{...next.targetDecision,kind:'Replacement',reason:replacement.reason,page:replacement.evidence.page}};records.push(...repair.records);}
  }
  next.targetDecision.fingerprint=focusedFingerprint({...next,...assignmentPresentation(next)});
  items[items.findIndex(i=>i.id===old.id)]=next;
  changes.push({id:old.id,item:next,reason:next.targetDecision.reason,evidence:{...next.targetDecision,page:next.targetDecision.page}});
 }
 return {changes,records,protectedCount:Object.keys(original.edits||{}).length,remaining:Math.max(0,focusedPending(original,reviewed).length-pending.length)};
}

export function applyFocusedDecisions(plan,now=Date.now()){
 const items=plan.payload.items.map(i=>{
  const d=currentFocusedDecision(i,now);if(!d)return {...i,targetDecision:i.targetDecision?{...i.targetDecision,stale:true}:undefined};
  const supported=d.kind==='New-page proposal'?d.gap?.missingEntities?.length&&d.checks?.length>=3&&d.checks.every(c=>c.status==='read'&&!c.supported):['Existing-page update','Replacement'].includes(d.kind)&&d.page?.excerpt&&pageKey(d.page.url)===pageKey(i.targetUrl);
  const flags=supported?i.quality.flags.filter(f=>!f.code.startsWith('target-')&&f.code!=='inventory-unavailable'):i.quality.flags;
  return {...i,quality:{...i.quality,flags,status:flags.length?'Needs attention':'Target decision supported; tentative'}};
 });
 const count=fn=>items.filter(i=>i.quality.flags.some(fn)).length;
 return {...plan,payload:{...plan.payload,items},qualityAudit:{...plan.qualityAudit,flagged:count(()=>true),noIssueDetected:items.filter(i=>!i.quality.flags.length).length,targeting:count(f=>f.code.startsWith('target-')||f.code==='inventory-unavailable')},focusedSummary:{decided:items.filter(i=>currentFocusedDecision(i,now)).length,pending:items.filter(i=>targetFlag(i)&&!i.edited&&!currentFocusedDecision(i,now)).length,protected:items.filter(i=>targetFlag(i)&&i.edited).length}};
}
