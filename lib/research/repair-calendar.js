import {groupingKey,intentFor,productFor,tokens,normalizedTopic} from './topics.js';
import {isLongTail} from './discovery.js';
import {prepareInventory,matchPages} from './page-matching.js';
import {pageKey,inventoryEntry} from './inventory.js';
import {verifyTarget,targetFingerprint} from './target-resolution.js';
import {readPublicPage} from '../otterly/content-sources.js';
import {publicProposalPlan} from './proposals.js';
import {proposalIntentOverlap} from './proposal-audit.js';
import {assignmentTitle,assignmentPresentation} from './proposal-presentation.js';

const norm=t=>groupingKey(String(t).replace(/\b20\d{2}\b/g,''));
const topic=i=>i.terms?.[0]||i.title;
export function repairPageFocus(term,title){
 const core=t=>tokens(normalizedTopic(t).replace(/\b(costs?|prices?|premiums?|rates?|pricing)\b/g,'cost').replace(/\b(apply|enroll|enrollment|sign up)\b/g,'enrollment')).filter(w=>!['medicarefaq','medicare','medigap','plan','insurance','guide','coverage','benefit','benefits','cost','enrollment','review','explained','complete','need','know','updated','step','steps','simple','2026','2027'].includes(w));
 const desired=new Set(core(term)),focus=core(title);
 return !focus.length||focus.filter(w=>desired.has(w)).length/focus.length>=.7;
}
const strength=i=>(i.evidence?.gsc||[]).reduce((n,r)=>Math.max(n,Number(r.impressions)||0),0)+(i.evidence?.semrush||[]).reduce((n,r)=>Math.max(n,Number(r.volume)||0),0);
export function repairCandidates(source,paid,settings={}){
 const pool=new Map();
 const add=(term,kind,row)=>{if(typeof term!=='string'||term.length<8||term.length>250)return;const intent=intentFor(term,[],2027);if(/coverage gap discount program/i.test(term)||intent.value<2||(settings.excluded||[]).some(x=>term.toLowerCase().includes(x.toLowerCase())))return;
  if(settings.products?.length&&productFor(term)!=='General Medicare'&&!settings.products.includes(productFor(term)))return;
  const key=norm(term),c=pool.get(key)||{term,intent:intent.value,evidence:{gsc:[],semrush:[],otterly:[],paidSearch:[]}};if(c.evidence[kind].length<5)c.evidence[kind].push(row);pool.set(key,c);
 };
 for(const r of source.evidence?.gsc?.rows||[])if(r.impressions>=20)add(r.keys?.[0],'gsc',r);
 for(const r of source.evidence?.semrush?.rows||[])if(r.volume>0)add(r.keyword,'semrush',r);
 for(const r of source.evidence?.otterly?.prompts||[])add(r.prompt,'otterly',{id:r.id,prompt:r.prompt,mentions:r.mentions??null,citations:r.domainMentions??null});
 for(const r of paid?.payload?.rows||[])if(['MFAQ','MC+MFAQ'].includes(r.account)&&!r.qualityIssue&&r.clicks>=20&&r.leads>=5&&r.sales>0)add(r.term,'paidSearch',r);
 return [...pool.values()].map(c=>({...c,score:c.intent*100+(isLongTail(c.term)?20:0)+Math.log1p(strength(c))+Math.log1p(c.evidence.paidSearch.reduce((n,r)=>Math.max(n,r.sales),0))*2})).sort((a,b)=>b.score-a.score||a.term.localeCompare(b.term));
}
const categoryFit=(i,c)=>i.category==='AI citations'?c.evidence.otterly.length>0:i.category==='Long-tail'?isLongTail(c.term)&&c.intent>=4:i.category==='Evergreen'?c.intent===2&&!/\b20\d{2}\b/.test(c.term):c.intent>=4;
const work=(term,evidence,category)=>`Update ${evidence.heading==='Content passage'?'the matching answer passage':'the “'+evidence.heading+'” section'} on the assigned page to address “${term}”. ${category==='AI citations'?'Make the answer directly usable for the monitored question and support factual statements with authoritative source links.':'Provide a direct answer, explain the decision factors relevant to this query, and link to the appropriate next step.'} Verify current facts and remove repetition with surrounding sections. This is an existing-page update, not a second article; confirm the specific edits needed before writing.`;
function evidenceRecord(item,e,now){return {item_id:item.id,fingerprint:targetFingerprint({...item,...assignmentPresentation(item)}),result:{checkedAt:now.toISOString(),inputTarget:item.targetUrl,query:topic(item),status:'Current target supported',recommendation:e,alternatives:[e],checks:[{requested:e.url,status:'Supported match',page:{url:e.url,title:e.title,status:'read',fetchedAt:e.fetchedAt},evidence:e}],proposedWork:item.action,limitation:'Current page content supports relevance, not a proven content gap or publishing approval. Recheck after seven days or scope changes.'}};}

// Produces actual item replacements. Database commits the immutable fork and
// before/after history together; dates and manual edits never enter this output.
export async function repairCalendar(original,reviewed,source,paid,settings={},reader=readPublicPage,now=new Date()){
 const inventory=source.inventory?.pages||[],prepared=prepareInventory(inventory),items=structuredClone(original.payload.items),visible=reviewed.payload.items;
 const protectedIds=new Set(Object.keys(original.edits||{})),changes=new Map(),records=[],cache=new Map();let fetched=0;const started=Date.now();
 const read=async url=>{const key=pageKey(url);if(!key)return null;if(!cache.has(key)){if(fetched>=16||Date.now()-started>120000)return null;fetched++;cache.set(key,reader(key).then(r=>inventoryEntry(key,r,now)).catch(()=>null));}return cache.get(key);};
 const set=(old,next,reason,e)=>{items[items.findIndex(i=>i.id===old.id)]=next;changes.set(old.id,{id:old.id,item:next,reason,evidence:{page:e,sourceDates:source.results?.sourceDates||original.payload.sourceDates}});records.push(evidenceRecord(next,e,now));};
 // Apply supported alternatives only after refreshing the actual page content.
 for(const i of visible){if(protectedIds.has(i.id))continue;const r=i.targetResolution?.recommendation;
  if(!r||pageKey(r.url)===pageKey(i.targetUrl)||items.some(x=>x.id!==i.id&&pageKey(x.targetUrl)===pageKey(r.url)))continue;
  const old=items.find(x=>x.id===i.id),page=await read(r.url),e=page&&repairPageFocus(topic(i),page.title)&&verifyTarget(i,{...page,headings:[]});if(!e)continue;
  const next={...old,targetUrl:e.url,action:work(topic(old),e,old.category),type:'Existing-page investigation'};
  set(old,next,'Assigned a live-verified, more relevant page and specified the update on that page.',e);
 }
 const victims=new Set();
 // Keep protected or stronger members. Replacements keep the weaker slot/date.
 for(const i of visible)for(const f of i.quality?.flags||[])if(['shared-page','intent-overlap'].includes(f.code))for(const id of f.related||[]){
  const other=visible.find(x=>x.id===id);if(!other||victims.has(i.id)||victims.has(other.id))continue;
  const eligible=[i,other].filter(x=>!protectedIds.has(x.id)&&!changes.has(x.id));
  eligible.sort((a,b)=>strength(a)-strength(b)||a.id.localeCompare(b.id));if(eligible[0])victims.add(eligible[0].id);
 }
 for(const i of visible)if(i.quality?.flags.some(f=>f.code.startsWith('target-'))&&!protectedIds.has(i.id)&&!changes.has(i.id)&&!i.targetResolution?.recommendation)victims.add(i.id);
 const matchCache=new Map();
 const used=new Set(visible.flatMap(i=>(i.terms||[i.title]).map(norm))),candidates=repairCandidates(source,paid,settings).filter(c=>!used.has(norm(c.term)));
 let considered=0;
 for(const id of victims){
  if(changes.size>=16||fetched>=16||Date.now()-started>120000)break;
  const old=items.find(i=>i.id===id);if(!old)continue;
  for(const c of candidates){
   if(!categoryFit(old,c)||used.has(norm(c.term)))continue;
   if(++considered>600||Date.now()-started>120000)break;
   if(!matchCache.has(c.term))matchCache.set(c.term,matchPages({term:c.term,product:productFor(c.term),gsc:c.evidence.gsc,semrush:c.evidence.semrush},prepared).matches);
   const matches=matchCache.get(c.term);
   const target=matches.find(p=>p.relevant&&p.status==='read'&&p.sameScope&&p.primaryMatch>=70&&repairPageFocus(c.term,p.title)&&!items.some(i=>i.id!==id&&pageKey(i.targetUrl)===pageKey(p.canonical||p.url)));
   if(!target)continue;
   const proposed={...old,title:assignmentTitle(c.term).replace(/: (topic review|cost questions to address)$/,''),editorialTitle:true,terms:[c.term],targetUrl:target.canonical||target.url,evidence:{...c.evidence,posthog:null},sourceKey:null,priority:null,basis:'Observed opportunity',type:'Existing-page investigation'};
   delete proposed.revision; // Old-topic evidence must not justify the replacement.
   const effective=publicProposalPlan({...original,payload:{...original.payload,items}}).payload.items;
   if(new URL(proposed.targetUrl).pathname==='/'||effective.some(i=>i.id!==id&&proposalIntentOverlap(i,proposed)))continue;
   const page=await read(proposed.targetUrl),e=page&&repairPageFocus(c.term,page.title)&&verifyTarget(proposed,{...page,headings:[]});if(!e)continue;
   proposed.targetUrl=e.url;proposed.action=work(c.term,e,old.category);
   proposed.verification='Tentative existing-page update. Verify the specific content gap, current facts and 2027 applicability before implementation. Source presence does not prove missing coverage; paid attribution is not organic demand.';
   const reason='Replaced a conflicting or unverified assignment with an unused, source-backed '+(isLongTail(c.term)?'long-tail ':'')+'opportunity on a distinct live-verified page. The original calendar slot and category are preserved.';
   proposed.repairBasis={reason,term:c.term,sources:Object.entries(c.evidence).filter(([,v])=>v.length).map(([k])=>k),paidPeriod:paid?.payload?.period||null};
   set(old,proposed,reason,e);used.add(norm(c.term));break;
  }
 }
 return {changes:[...changes.values()],records,protectedCount:protectedIds.size,checkedPages:fetched,remaining:visible.filter(i=>i.quality?.flags.length&&!changes.has(i.id)).length};
}
