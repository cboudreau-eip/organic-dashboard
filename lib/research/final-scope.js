import {focusedCandidates,verifyFocusedTarget,focusedFingerprint,focusWords} from './focused-targets.js';
import {repairCandidates} from './repair-calendar.js';
import {verifyTarget} from './target-resolution.js';
import {pageKey,inventoryEntry} from './inventory.js';
import {readPublicPage,pageText} from '../otterly/content-sources.js';
import {assignmentPresentation,assignmentTitle} from './proposal-presentation.js';

import {proposalIntentOverlap} from './proposal-audit.js';
import {groupingKey,intentFor,productFor,normalizedTopic} from './topics.js';

const term=i=>i.titleEdited?i.title:i.terms?.[0]||i.title;
const flagged=i=>i.category==='AI citations'&&i.quality?.flags.some(f=>f.code.startsWith('target-')||f.code==='inventory-unavailable');
const fresh=i=>i.scopePass?.role==='slot'&&i.scopePass.fingerprint===focusedFingerprint(i)&&Date.now()-Date.parse(i.scopePass.checkedAt)<7*86400000&&Date.parse(i.scopePass.checkedAt)<=Date.now()+60000;
export function widerScopeSummary(plan){const items=plan.payload.items,done=i=>i.scopePass?.sourcePool==='wider'&&fresh(i);return {reviewed:items.filter(done).length,pending:items.filter(i=>flagged(i)&&!i.edited&&!done(i)).length,protected:items.filter(i=>flagged(i)&&i.edited).length};}
export const eligibleWiderQuery=q=>!/(?:life[ -]?insurance|customer service|log[ -]?in|phone number|\.com\b|https?:|\bpdf\b)/i.test(q);
export const widerScopePass=(original,reviewed,source,paid,settings={},reader=readPublicPage,now=new Date())=>finalScopePass(original,reviewed,source,paid,settings,reader,now,{wide:true});
export function finalScopeSummary(plan){const items=plan.payload.items;return {reviewed:items.filter(fresh).length,pending:items.filter(i=>flagged(i)&&!i.edited&&!fresh(i)).length,protected:items.filter(i=>flagged(i)&&i.edited).length};}
export function finalScopeOverlap(a,b){const clean=i=>{const q=term(i);return {...i,titleEdited:false,terms:[focusWords(q.replace(/\bsupplement\b/gi,'medigap')).filter(w=>!(/\bvs\b|\bversus\b/i.test(q)&&w==='compare')).join(' ')]};};return proposalIntentOverlap(a,b)||proposalIntentOverlap(clean(a),clean(b));}
const promptRow=p=>({id:p.id,prompt:p.prompt,mentions:p.mentions??null,citations:p.domainMentions??p.citations??null});
export function directionSupported(query,text){
 if(!/\b(switch|change|switching|changing)\b/i.test(query)||!query.match(/\bfrom\b/i))return true;
 const simplify=t=>normalizedTopic(t).replace(/\b(medicare|a|an|the|plan)\b/g,'').replace(/\s+/g,' ').trim();
 const direction=simplify(query).match(/from (.+?) to ([^?.]+)/)?.[0]?.replace(/ without.*$/,'');
 return !!direction&&simplify(text).includes(direction);
}
const decision=(item,page,checks,reason,now)=>({kind:'Existing-page update',query:term(item),page,checks,reason,checkedAt:now.toISOString(),tentative:true,limitation:'Live page relevance supports tentative work, not a proven content gap or publishing approval. Recheck after seven days or scope changes.'});
function finish(item,scope){item.scopePass=scope;const visible={...item,...assignmentPresentation(item)};item.scopePass.fingerprint=focusedFingerprint(visible);if(item.targetDecision)item.targetDecision={...item.targetDecision,fingerprint:focusedFingerprint(visible)};return item;}

// One slot and its optional receiving assignment form one reversible batch.
// No receiving assignment changes unless a verified replacement is also found.
export async function finalScopePass(original,reviewed,source,paid,settings={},reader=readPublicPage,now=new Date(),options={}){
 const wide=options.wide===true,finishScope=(item,scope)=>finish(item,{...scope,sourcePool:wide?'wider':'otterly'});
 const visible=reviewed.payload.items,pending=visible.filter(i=>flagged(i)&&!Object.hasOwn(original.edits||{},i.id)&&!(fresh(i)&&(!wide||i.scopePass.sourcePool==='wider'))),slot=pending[0];
 if(!slot)return {changes:[],records:[],remaining:0};
 const raw=original.payload.items.find(i=>i.id===slot.id),inventory=source.inventory?.pages||[],cache=new Map(),started=Date.now();let fetched=0;
 const checks=[],read=async url=>{const key=pageKey(url);if(!key)return null;if(!cache.has(key)){if(fetched>=80||Date.now()-started>150000)return null;fetched++;cache.set(key,reader(key).then(r=>({...inventoryEntry(key,r,now),text:pageText(r.html)})).catch(()=>null));}return cache.get(key);};
 const owners=url=>visible.filter(i=>i.id!==slot.id&&pageKey(i.targetUrl)===pageKey(url));
 const inventoryByUrl=new Map(inventory.map(p=>[pageKey(p.url),p])),assignedTitles=visible.filter(i=>i.id!==slot.id).map(i=>inventoryByUrl.get(pageKey(i.targetUrl))?.title?.split('|')[0]).filter(Boolean);
 async function inspect(item,freeOnly=false){
  const candidates=focusedCandidates(item,inventory,wide?{evidence:{gsc:{rows:item.evidence?.gsc||[]},semrush:{rows:item.evidence?.semrush||[]}}}:source).filter(c=>!freeOnly||!owners(c.canonical||c.url).length&&c.queryCoverage>=.45).slice(0,freeOnly?3:6),out=[];
  for(let at=0;at<candidates.length;at+=3){
   if(Date.now()-started>150000||fetched>=80)break;
   out.push(...await Promise.all(candidates.slice(at,at+3).map(async c=>{const p=await read(c.url),match=p&&verifyFocusedTarget(item,p),e=match&&directionSupported(term(item),match.excerpt)?match:null;return {url:c.url,title:p?.title||c.title,status:p?.status||'unavailable',fetchedAt:p?.fetchedAt||now.toISOString(),supported:!!e,evidence:e,assignedTo:owners(e?.url||c.url).map(i=>({id:i.id,title:i.title}))};})));
  }return out;
 }
 const currentChecks=await inspect(slot);checks.push(...currentChecks);
 const available=currentChecks.find(c=>c.supported&&!c.assignedTo.length);
 if(available){
  const e=available.evidence,reason='A deeper live-page review established a distinct target for the original monitored question.';
  const next=finishScope({...raw,targetUrl:e.url,type:'Existing-page investigation',action:`Update the relevant answer passage on “${e.title}” for the monitored question “${term(slot)}”. Check existing coverage, improve the direct answer and authoritative citations, and verify current facts before implementation. No separate article is planned.`,targetDecision:decision(slot,e,checks,reason,now)},{role:'slot',kind:'Original question targeted',checkedAt:now.toISOString()});
  return {changes:[{id:slot.id,item:next,reason,evidence:{page:e,checks}}],records:[],remaining:pending.length-1};
 }
 const occupied=currentChecks.filter(c=>c.supported&&c.assignedTo.length===1);
 let receiver=null,questionEvidence=null,ownerEvidence=null;
 for(const c of occupied){
  const owner=visible.find(i=>i.id===c.assignedTo[0].id);if(!owner||Object.hasOwn(original.edits||{},owner.id))continue;
  const p=await read(c.evidence.url),e=p&&(verifyFocusedTarget(owner,p)||verifyTarget(owner,{...p,headings:[]}));
  if(e){receiver=owner;questionEvidence=c.evidence;ownerEvidence=e;break;}
 }
 const used=new Set(visible.flatMap(i=>[...(i.terms||[i.title]),...(i.scopeQuestions||[]).map(q=>q.prompt)]).map(groupingKey));
 const pool=wide?repairCandidates(source,paid,settings).filter(c=>eligibleWiderQuery(c.term)).slice(0,400).map(c=>({id:groupingKey(c.term),prompt:c.term,sourceEvidence:c.evidence,priorityScore:c.score})):source.evidence?.otterly?.prompts||[];
 const prompts=pool.filter(p=>typeof p.id==='string'&&typeof p.prompt==='string'&&!used.has(groupingKey(p.prompt))&&!(settings.excluded||[]).some(x=>p.prompt.toLowerCase().includes(x.toLowerCase()))&&(!settings.products?.length||productFor(p.prompt)==='General Medicare'||settings.products.includes(productFor(p.prompt))));
 const rank=p=>wide?p.priorityScore:Math.max(0,...focusedCandidates({title:p.prompt,terms:[p.prompt]},inventory,wide?{evidence:{gsc:{rows:p.sourceEvidence.gsc},semrush:{rows:p.sourceEvidence.semrush}}}:source).filter(c=>!owners(c.canonical||c.url).length).map(c=>c.focusScore))+intentFor(p.prompt,[],2027).value*(wide?20:3)+(wide?Math.log1p(p.priorityScore):0);
 const ranks=new Map(prompts.map(p=>[p.id,rank(p)]));
 prompts.sort((a,b)=>ranks.get(b.id)-ranks.get(a.id)||a.prompt.localeCompare(b.prompt));
 let replacement=null,replacementChecks=[],examined=0;
 for(const p of prompts){
  if(fetched>=80||Date.now()-started>150000)break;
  const candidate={...raw,title:p.prompt,terms:[p.prompt],evidence:wide?{...p.sourceEvidence,posthog:null}:{gsc:[],semrush:[],otterly:[promptRow(p)],posthog:null}};
  if(visible.some(i=>i.id!==slot.id&&finalScopeOverlap(i,candidate))||wide&&assignedTitles.some(title=>finalScopeOverlap({terms:[title]},candidate)))continue;
  examined++;const cs=await inspect(candidate,true),match=cs.find(c=>c.supported&&!c.assignedTo.length);
  replacementChecks.push({prompt:p.prompt,promptId:p.id,sources:wide?Object.entries(p.sourceEvidence).filter(([,rows])=>rows.length).map(([key])=>key):['otterly'],checks:cs});
  if(match){replacement={candidate,p,e:match.evidence};break;}
 }
 if(!replacement){
  const reason=`No safe replacement found in this bounded pass: ${prompts.length} unused ${wide?'source-backed queries':'monitored prompts'} available, ${examined} examined. Existing assignments remain unchanged; no unmonitored question was invented.`;
  const next=finishScope({...raw},{role:'slot',kind:'Evidence shortfall',checkedAt:now.toISOString(),reason,checks,replacementChecks,availablePrompts:prompts.length,examined});
  return {changes:[{id:slot.id,item:next,reason,evidence:{checks,replacementChecks}}],records:[],remaining:pending.length-1};
 }
 const {candidate,p,e}=replacement,undoGroup='scope:'+slot.id,changes=[],reason=receiver?'Moved the original monitored question into compatible existing work and filled this slot with a distinct, live-verified source-backed opportunity.':'Replaced the unsupported assignment with a distinct source-backed query and a live-verified target.';
 const next={...candidate,title:assignmentTitle(p.prompt).replace(/: (topic review|cost questions to address)$/,''),editorialTitle:true,targetUrl:e.url,type:'Existing-page investigation',sourceKey:null,priority:null,action:`Improve the answer to “${p.prompt}” on “${e.title}”. Review the verified passage, make the answer easy to cite, and check authoritative source links and current facts. This is a tentative existing-page update, not a new article.`,verification:'Verify the precise content improvement and factual accuracy before implementation. Source observations support topic relevance, not a proven content gap, organic conversions or guaranteed AI citations. If no Otterly prompt is attached, this is an AI-answer optimization hypothesis, not a monitored citation gap.',targetDecision:{...decision(candidate,e,replacementChecks.at(-1)?.checks||[],reason,now),kind:'Replacement'}};
 delete next.revision;delete next.repairBasis;delete next.scopeQuestions;
 if(wide)next.measure='Record the implementation date and compare the target page and query in GSC over equal periods; use PostHog for page engagement where available. Check AI mentions and citations only if the question is actually monitored in Otterly. Paid-search results are supporting research, not organic conversion outcomes.';
 if(wide)next.repairBasis={reason:reason+' The AI-citation category describes the proposed answer format; only attached Otterly evidence establishes monitoring.',term:p.prompt,sources:Object.entries(p.sourceEvidence).filter(([,rows])=>rows.length).map(([key])=>key),paidPeriod:paid?.payload?.period||null};
 finishScope(next,{role:'slot',kind:wide?'Wider-source replacement':'Monitored replacement',checkedAt:now.toISOString(),originalQuestion:term(slot),receivingAssignmentId:receiver?.id||null,checks,replacementChecks});
 changes.push({id:slot.id,item:next,reason,evidence:{undoGroup,page:e,checks,replacementChecks}});
 if(receiver){
  const old=original.payload.items.find(i=>i.id===receiver.id),prompt=(source.evidence?.otterly?.prompts||[]).find(p=>groupingKey(p.prompt)===groupingKey(term(slot))),q={fromAssignmentId:slot.id,prompt:term(slot),promptId:prompt?.id||slot.evidence?.otterly?.[0]?.id,evidence:questionEvidence};
  const action=old.action+` Also address the monitored AI question “${q.prompt}” within the verified relevant passage; coordinate it with this page's existing work instead of planning a separate article.`;
  const ownerNext=finishScope({...old,action,scopeQuestions:[...(old.scopeQuestions||[]),q],evidence:{...old.evidence,otterly:[...(old.evidence?.otterly||[]),...(prompt?[promptRow(prompt)]:[])]},targetDecision:decision(receiver,ownerEvidence,[occupied.find(c=>c.evidence===questionEvidence)],'Incorporated a compatible AI question into the existing page assignment; both the original scope and added question have live page evidence.',now)},{role:'receiver',kind:'Question incorporated',checkedAt:now.toISOString(),sourceAssignmentId:slot.id});
  changes.push({id:receiver.id,item:ownerNext,reason:'Preserved the monitored question inside compatible work already planned for this page.',evidence:{undoGroup,page:ownerEvidence,question:q}});
 }
 return {changes,records:[],remaining:pending.length-1};
}

