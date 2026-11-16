import {entities,normalizedTopic,tokens,productFor} from './topics.js';
import {pageKey} from './inventory.js';
import {prepareInventory,matchPages} from './page-matching.js';

const scope=text=>entities(text);
const sameScope=(a,b)=>['plans','parts','states','carriers'].every(k=>[...a[k]].sort().join('|')===[...b[k]].sort().join('|'));
const words=text=>new Set(tokens(normalizedTopic(text).replace(/\b(costs?|prices?|pricing|premiums?|rates?)\b/g,'cost').replace(/\b(enroll|enrollment|apply|applying|sign up)\b/g,'enroll').replace(/\b(comparison|compare|comparing)\b/g,'compare').replace(/\b(open|period|insurance)\b/g,'')));
const query=i=>i.titleEdited?i.title:i.terms?.[0]||i.originalTitle||i.title;
const overlap=(a,b)=>{const intersection=[...a].filter(t=>b.has(t)).length;return intersection/Math.max(a.size,b.size,1);};
const qualifiers=text=>(normalizedTopic(text).match(/\b(?:state|age|online|high deductible|underwriting|employer|[0-9]+)\b/g)||[]).sort().join('|');
const titleScope=p=>scope((p.title||'')+' '+new URL(p.url).pathname.replaceAll('-',' '));

// An annotation only: never rewrites assignment fields, edits or calendar slots.
export function auditProposalPlan(plan,inventory=[],source={}){
 if(!plan)return plan;
 const pages=inventory.filter(p=>pageKey(p.url)),prepared=prepareInventory(pages),index=new Map();
 for(const p of pages)for(const u of [p.url,p.requested,p.canonical].filter(Boolean))index.set(pageKey(u),p);
 const items=plan.payload.items.map(item=>({...item,quality:{flags:[],candidates:[]}}));
 const add=(item,code,message,related=[])=>{if(!item.quality.flags.some(f=>f.code===code&&f.related.join('|')===related.join('|')))item.quality.flags.push({code,message,related});};
 const canonical=i=>{const k=pageKey(i.targetUrl);return k?pageKey(index.get(k)?.canonical)||k:null;};
 for(const item of items){
  const term=query(item),id=scope(term),page=index.get(pageKey(item.targetUrl)),e=item.titleEdited?{}:item.evidence||{};
  const matches=matchPages({term,product:productFor(term),gsc:e.gsc||[],semrush:e.semrush||[]},prepared);
  item.quality.candidates=matches.matches.filter(p=>p.relevant&&p.status==='read').slice(0,3).map(p=>({url:p.url,title:p.title,primaryMatch:p.primaryMatch}));
  if(!pages.length)add(item,'inventory-unavailable','Page inventory is unavailable. Page targeting has not been verified.');
  if(!item.targetUrl)add(item,'target-unassigned',item.quality.candidates.length?'Choose an existing page or document why a separate page is needed. Saved inventory contains related candidates.':'Target page is unconfirmed. Check existing coverage before proposing a new page.');
  else if(!page)add(item,'target-not-in-inventory','The assigned URL is absent from the saved page inventory. Verify its current URL and coverage; absence does not prove it is missing.');
  else {
   if(page.status!=='read')add(item,'target-unreadable','The saved crawl could not read the target page. Verify its availability and content.');
   const pscope=titleScope(page),missing=['plans','parts','states','carriers'].filter(k=>id[k].some(v=>!pscope[k].includes(v)));
   if(missing.length)add(item,'target-scope','The assigned page title/URL does not establish the requested '+missing.join(', ')+'. Verify a dedicated section or choose a closer page.');
   const scored=matchPages({term,product:productFor(term),gsc:e.gsc||[],semrush:e.semrush||[]},{...prepared,pages:prepared.pages.filter(p=>pageKey(p.url)===pageKey(page.url))}).matches[0];
   if(page.status==='read'&&!missing.length&&(!scored?.relevant||scored.primaryMatch<55&&scored.match<65))add(item,'target-weak-match','The saved title and headings do not establish a close match for this query. Inspect the relevant section before retaining this target.');
   if(new URL(page.url).pathname==='/')add(item,'target-homepage','The homepage is assigned. Choose the specific guide or landing page for this work.');
   if(page.canonical&&pageKey(page.canonical)!==pageKey(item.targetUrl))add(item,'target-canonical','The saved canonical URL differs from the assigned URL. Confirm which page should receive the update.');
  }
 }
 for(let a=0;a<items.length;a++)for(let b=a+1;b<items.length;b++){
  const x=items[a],y=items[b],qx=query(x),qy=query(y),samePage=canonical(x)&&canonical(x)===canonical(y);
  // Direction matters for switching; a broad product or shared carrier alone is insufficient.
  const directional=/\b(switch|change|switching|changing)\b/i.test(qx+' '+qy);
  const similar=!directional&&qualifiers(qx)===qualifiers(qy)&&sameScope(scope(qx),scope(qy))&&words(qx).size>=2&&words(qy).size>=2&&overlap(words(qx),words(qy))>=.8;
  if(similar){for(const [i,other] of [[x,y],[y,x]])add(i,'intent-overlap',`Potential overlapping search intent with “${other.title}”. Define distinct sections or consolidate the work; this is not a confirmed duplicate.`,[other.id]);}
  else if(samePage){for(const [i,other] of [[x,y],[y,x]])add(i,'shared-page',`Shares a target page with “${other.title}”. Coordinate the updates and define separate deliverables; a shared page alone is not duplication.`,[other.id]);}
 }
 for(const i of items)i.quality.status=i.quality.flags.length?'Needs attention':'No issue detected';
 const flagged=items.filter(i=>i.quality.flags.length),withCode=code=>items.filter(i=>i.quality.flags.some(f=>f.code===code)).length;
 return {...plan,payload:{...plan.payload,items},qualityAudit:{version:'assignment-audit-v1',planVersion:plan.version,checked:items.length,flagged:flagged.length,noIssueDetected:items.length-flagged.length,overlap:withCode('intent-overlap'),sharedPage:withCode('shared-page'),targeting:items.filter(i=>i.quality.flags.some(f=>f.code.startsWith('target-')||f.code==='inventory-unavailable')).length,inventoryPages:pages.length,inventoryDate:source.created_at||null,scope:'Screened against saved queries, current assignment edits, page titles, headings and canonical URLs. This is a review flag, not proof of duplicate content, a live crawl, or publishing approval. Counts overlap. Recomputed when assignments are loaded.'}};
}
