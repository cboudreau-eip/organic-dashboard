import {hash,normalizedTopic} from './topics.js';
import {pageKey,inventoryEntry} from './inventory.js';
import {readPublicPage,safePage,pageText} from '../otterly/content-sources.js';
import {verifyTarget} from './target-resolution.js';

const codes=['shared-page','intent-overlap'];
const query=i=>i.titleEdited?i.title:i.terms?.[0]||i.title;
const facets={cost:/\b(costs?|prices?|pricing|premiums?|rates?)\b/i,benefits:/\b(benefits?|coverage|cover|covers)\b/i,eligibility:/\b(eligibility|eligible|qualify)\b/i,enrollment:/\b(enroll|enrollment|apply|sign up|signing up)\b/i,underwriting:/\bunderwriting\b/i,switching:/\b(switch|switching|change|changing)\b/i,comparison:/\b(compare|comparing|comparison|vs|versus)\b/i};
const purposes=text=>Object.entries(facets).filter(([,re])=>re.test(text)).map(([name])=>name);
const scope=i=>[i.id,i.title,i.titleEdited,i.action,i.terms,i.targetUrl,i.notes];
// Pair evidence shares the existing server-only evidence store; namespaced keys
// cannot collide with the generated 24-character assignment IDs.
export function overlapPairs(plan){
 const items=plan?.payload.items||[],pairs=new Map();
 for(const i of items)for(const f of i.quality?.flags||[])if(codes.includes(f.code))for(const id of f.related||[]){
  const other=items.find(x=>x.id===id);if(!other)continue;
  const members=[i,other].sort((a,b)=>a.id.localeCompare(b.id)),key='overlap:'+hash(members.map(x=>x.id).join('|'));
  const pair=pairs.get(key)||{key,members,codes:[]};if(!pair.codes.includes(f.code))pair.codes.push(f.code);pairs.set(key,pair);
 }
 return [...pairs.values()].map(p=>({...p,fingerprint:hash(JSON.stringify(['overlap-v2',p.members.map(scope),p.codes.sort()]))}));
}
export function currentOverlap(pair,record,now=Date.now()){
 const t=Date.parse(record?.result?.checkedAt);
 return record?.fingerprint===pair.fingerprint&&record.result.kind==='overlap-v2'&&t<=now+60000&&now-t<7*86400000?record.result:null;
}
function sectionsFor(item,page){
 const purpose=purposes(query(item));if(purpose.length!==1)return [];
 const headings=[...(page.html||'').matchAll(/<h[1-6]\b[^>]*>([\s\S]*?)<\/h[1-6]>/gi)].map(m=>({heading:pageText('<main>'+m[1]+'</main>'),start:m.index}));
 return headings.flatMap((h,n)=>{
  if(purposes(h.heading).join('|')!==purpose[0])return [];
  const excerpt=pageText('<main>'+page.html.slice(h.start,headings[n+1]?.start??page.html.length)+'</main>');
  const evidence=verifyTarget(item,{...page,text:excerpt,headings:[h.heading]});
  return evidence?[{...evidence,heading:h.heading,excerpt:evidence.excerpt,purpose:purpose[0]}]:[];
 });
}
function decision(pair,checks){
 const [a,b]=pair.members,pa=purposes(query(a)),pb=purposes(query(b));
 const same=pageKey(a.targetUrl)&&pageKey(a.targetUrl)===pageKey(b.targetUrl);
 const evidence=pair.members.map(i=>checks.find(c=>c.itemId===i.id)?.evidence);
 const scoped=pa.length===1&&pb.length===1&&pa[0]!==pb[0]&&pair.members.every((i,n)=>purposes(i.action+' '+(i.notes||'')).every(p=>p===[pa,pb][n][0]));
 const distinct=same&&scoped&&!pair.codes.includes('intent-overlap')&&evidence.every((e,n)=>e&&e.coverage>=85&&e.purpose===[pa,pb][n][0]&&pageKey(e.url)===pageKey(pair.members[n].targetUrl)&&pageKey(e.canonical)===pageKey(e.url))&&normalizedTopic(evidence[0].heading)!==normalizedTopic(evidence[1].heading);
 return distinct?{clear:true,status:'Distinct sections supported',reason:'The saved assignments have separate purposes and current page sections support each one. Coordinate them as separate updates to the same page.',next:'Retain both dates. Use the section boundaries below; coordinate the page edits before implementation.'}:
 pair.codes.includes('intent-overlap')?{clear:false,status:'Possible duplicate — scope decision needed',reason:'The audit found similar search intent. Separate dates or differently worded titles do not establish separate work.',next:'Compare the saved work and query lists below. Define genuinely different deliverables, or propose a replacement for one slot. Neither assignment has been merged or replaced.'}:
 {clear:false,status:'Shared page — separation not yet supported',reason:!scoped?'The saved scope is broad, overlapping, or lacks a distinct purpose for each assignment.':!evidence.every(Boolean)?'Current page content did not establish a matching, separate section for both assignments.':'The page or section evidence does not establish independent work.',next:'Narrow the proposed work to distinct page sections, or choose a supported target. Keep this flag until a recheck supports the separation.'};
}
export async function resolveOverlap(pair,read=readPublicPage,now=new Date()){
 const cache=new Map();
 const checks=await Promise.all(pair.members.map(async item=>{
  const url=safePage(item.targetUrl);if(!url)return {itemId:item.id,status:'Target page unconfirmed'};
  try{if(!cache.has(url))cache.set(url,read(url).then(r=>({...inventoryEntry(url,r,now),html:r.html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i)?.[1]||r.html})));const page=await cache.get(url),evidence=sectionsFor(item,page)[0]||null;
   const context=evidence||verifyTarget(item,{...page,headings:[]});
   return {itemId:item.id,url:page.url,title:page.title,status:evidence?'Section supported':context?'Relevant passage found; separation unconfirmed':'No distinct matching section established',evidence,context,
    proposedBoundary:context?`For “${item.title}”, review ${context.heading==='Content passage'?'the matching passage':'“'+context.heading+'”'}. Limit the deliverable to “${query(item)}”; compare it with the related assignment before changing either scope.`:`For “${item.title}”, confirm a page section specifically addressing “${query(item)}” before separating this work.`};
  }catch{return {itemId:item.id,url,status:'Page could not be retrieved'};}
 }));
 return {kind:'overlap-v2',checkedAt:now.toISOString(),checks,...decision(pair,checks)};
}
export function applyOverlapResolutions(plan,records=[],now=Date.now()){
 if(!plan)return plan;
 const pairs=overlapPairs(plan),results=pairs.map(pair=>{const record=records.find(r=>r.item_id===pair.key),result=currentOverlap(pair,record,now);return {pair,result:result?{...result,...decision(pair,result.checks||[])}:null,stale:!!record};});
 const items=plan.payload.items.map(item=>{
  const related=results.filter(r=>r.pair.members.some(i=>i.id===item.id));
  const flags=item.quality.flags.filter(f=>!codes.includes(f.code)||!f.related?.length||!f.related.every(id=>related.some(r=>r.result?.clear&&r.pair.members.some(i=>i.id===id))));
  return {...item,overlapResolutions:related.map(({pair,result,stale})=>({key:pair.key,...(result||{status:stale?'Recheck needed':'Not checked',reason:stale?'Scope, target, related assignment or evidence freshness changed.':'Run the overlap and shared-page pass.'}),members:pair.members.map(i=>({id:i.id,title:i.title,action:i.action,terms:i.terms,targetUrl:i.targetUrl,edited:i.edited})),cleared:!!result?.clear})),quality:{...item.quality,flags,status:flags.length?'Needs attention':'No remaining issue detected'}};
 });
 const count=code=>items.filter(i=>i.quality.flags.some(f=>code?f.code===code:true)).length;
 return {...plan,payload:{...plan.payload,items},qualityAudit:{...plan.qualityAudit,flagged:count(),noIssueDetected:items.length-count(),sharedPage:count('shared-page'),overlap:count('intent-overlap')},overlapResolutionSummary:{pairs:pairs.length,checked:results.filter(r=>r.result).length,cleared:results.filter(r=>r.result?.clear).length,remaining:results.filter(r=>!r.result).length,needsDecision:results.filter(r=>r.result&&!r.result.clear).length}};
}
