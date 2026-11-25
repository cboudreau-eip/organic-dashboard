import {hash,groupingKey,intentFor,productFor} from './topics.js';
import {isLongTail} from './discovery.js';
import {focusedCandidates,verifyFocusedTarget,focusWords} from './focused-targets.js';
import {proposalIntentOverlap} from './proposal-audit.js';
import {publicProposalPlan} from './proposals.js';
import {inventoryEntry} from './inventory.js';
import {readPublicPage} from '../otterly/content-sources.js';
import {assignmentTitle} from './proposal-presentation.js';

const equivalent=(a,b)=>groupingKey(a)===groupingKey(b);
export function expansionCandidates(plan,source,paid,settings={}) {
 const rows=new Map(),add=(term,kind,row)=>{
  if(!term||term.length>250||/\b20(?:0\d|1\d|2[0-6])\b/.test(term))return;
  if(intentFor(term,[],2027).value<4||(settings.excluded||[]).some(x=>term.toLowerCase().includes(x.toLowerCase())))return;
  if(settings.products?.length&&productFor(term)!=='General Medicare'&&!settings.products.includes(productFor(term)))return;
  const key=groupingKey(term);if(!rows.has(key))rows.set(key,{id:hash('additional:'+key),title:term,terms:[term],evidence:{gsc:[],semrush:[],otterly:[],paidSearch:[]}});
  const item=rows.get(key);if(item.evidence[kind].length<3)item.evidence[kind].push(row);
 };
 for(const r of source.evidence?.gsc?.rows||[])if(r.impressions>0)add(r.keys?.[0],'gsc',r);
 for(const r of source.evidence?.semrush?.rows||[])if(r.volume>0)add(r.keyword,'semrush',r);
 for(const r of source.evidence?.otterly?.prompts||[])add(r.prompt,'otterly',{id:r.id,prompt:r.prompt,mentions:r.mentions??null,citations:r.domainMentions??null});
 for(const r of paid?.payload?.rows||[])if(['MFAQ','MC+MFAQ'].includes(r.account)&&!r.qualityIssue&&r.clicks>=20&&r.sales>0)add(r.term,'paidSearch',r);
 const existing=publicProposalPlan(plan).payload.items;
 return [...rows.values()].filter(i=>!existing.some(x=>x.id===i.id||[x.title,...(x.terms||[])].some(t=>equivalent(t,i.title))||proposalIntentOverlap(x,i))).map(i=>({...i,score:intentFor(i.title).value*10+(isLongTail(i.title)?15:0)+Math.min(15,Math.log1p(Math.max(0,...i.evidence.gsc.map(r=>r.impressions),...i.evidence.semrush.map(r=>r.volume)))*2)+i.evidence.otterly.length*2})).sort((a,b)=>b.score-a.score||a.title.localeCompare(b.title));
}

// A bounded overlap screen, not a claim that no similar page exists anywhere.
export async function expandPlan(plan,source,paid,settings={},reader=readPublicPage,now=new Date()) {
 const inventory=source.inventory?.pages||[];
 if(inventory.length<20)throw Object.assign(Error('Collect page inventory before adding new-content opportunities.'),{status:422});
 const candidates=expansionCandidates(plan,source,paid,settings),added=[],skipped=[],cache=new Map(),started=Date.now();
 for(const candidate of candidates.slice(0,100)){
  if(added.length>=6||Date.now()-started>180000)break;
  if(added.some(i=>proposalIntentOverlap(i,candidate)))continue;
  const pages=focusedCandidates(candidate,inventory,source);
  // Strong title/heading matches are refresh candidates, never new-page filler.
  const wanted=focusWords(candidate.title),covers=p=>{const words=new Set(focusWords((p.title||'')+' '+(p.headings||[]).join(' ')));return wanted.length>0&&wanted.filter(w=>words.has(w)).length/wanted.length>=.8;};
  if(pages.some(p=>covers(p)||verifyFocusedTarget(candidate,p))){skipped.push({term:candidate.title,reason:'Existing page coverage',url:pages[0]?.url});continue;}
  if(pages.length<2){skipped.push({term:candidate.title,reason:'Not enough related pages to check'});continue;}
  const checks=await Promise.all(pages.slice(0,2).map(async p=>{
   if(!cache.has(p.url))cache.set(p.url,reader(p.url).then(r=>inventoryEntry(p.url,r,now)).catch(()=>null));
   const current=await cache.get(p.url);return {url:p.url,title:current?.title||p.title,status:current?.status||'unavailable',supported:!!current&&(covers(current)||!!verifyFocusedTarget(candidate,current)),headings:current?.headings?.slice(0,12)||[],checkedAt:now.toISOString()};
  }));
  if(checks.some(c=>c.status!=='read'||c.supported)){skipped.push({term:candidate.title,reason:checks.some(c=>c.supported)?'Live page coverage':'Page check unavailable'});continue;}
  const category=isLongTail(candidate.title)?'Long-tail':'High intent';
  added.push({...candidate,title:assignmentTitle(candidate.title).replace(/: topic review$/,''),editorialTitle:true,category,type:'New-page proposal',targetUrl:'',basis:'Observed opportunity',notes:'',
   action:`Create a new page answering “${candidate.title}”, focused on the reader’s comparison, cost, eligibility or enrollment decision. Keep this specific question separate from the broader related guides checked below; link to them rather than repeat their full scope. Confirm the coverage gap and current facts in assessment before drafting.`,
   verification:'Tentative new-page proposal. Saved keyword/prompt evidence plus a bounded page-overlap screen supports investigation, not proof of an absent page or publishing approval. Recheck current search intent, site coverage and factual sources before writing.',
   measure:'Track GSC impressions and clicks for the specific query and new URL; PostHog organic engagement and quote starts; Otterly citations when a matching monitored prompt exists. Record a baseline before publication.',
   expansionEvidence:{checkedAt:now.toISOString(),sourceRunId:plan.research_run_id,sourceDates:source.sourceDates||plan.payload.sourceDates,inventoryPages:inventory.length,existingAssignmentsChecked:plan.payload.items.length,checks,reason:'High-intent observed query not equivalent to a saved assignment. No strong coverage found in saved inventory titles/headings or the two related pages checked live.',limitation:'Lexical screening can miss semantic overlap; this is a tentative opportunity, not confirmed unique content.'}
  });
 }
 return {items:added,summary:{considered:candidates.length,added:added.length,skipped:skipped.length,examples:skipped.slice(0,5)}};
}
