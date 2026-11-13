import {pageKey} from './inventory.js';
import {intents} from '../semrush/opportunities.js';
import {hash,topicKey,groupingKey,normalizedTopic,intentFor,productFor} from './topics.js';
import {prepareInventory,matchPages} from './page-matching.js';
export {tokens,topicKey,intentFor,productFor} from './topics.js';
export const RANK_VERSION='research-v3';
const part=(value,weight,reason)=>({value,weight,points:value==null?null:Math.round(value/5*weight*10)/10,reason});
const band=demand=>demand>=1000?4:demand>=100?3:demand>0?2:null;
const competitionFor=rows=>{const values=rows.map(r=>r.difficulty).filter(Number.isFinite),kd=values.length?Math.max(...values):null;return {kd,value:kd==null?null:kd<=30?4:kd<=50?3:kd<=70?2:1};};
export function rankOpportunities(evidence,inventory,settings,inventoryComplete){
 const prepared=prepareInventory(inventory),groups=new Map(),originalKeys=new Set();let ignored=0,serviceExcluded=0,historicalExcluded=0;
 function add(term,source,row){
  if(typeof term!=='string'||term.length>250||term.length<4||settings.excluded.some(s=>term.toLowerCase().includes(s))){ignored++;return;}
  const product=productFor(term);if(product!=='General Medicare'&&!settings.products.includes(product)){ignored++;return;}
  const legacy=topicKey(term),key=groupingKey(term);originalKeys.add(legacy);
  if(!groups.has(key))groups.set(key,{groupKey:key,term,product,legacyKeys:new Set(),terms:[],gsc:[],semrush:[],otterly:[]});
  const g=groups.get(key);g.legacyKeys.add(legacy);if(!g.terms.includes(term))g.terms.push(term);g[source].push(row);
 }
 for(const row of evidence.gsc?.rows||[])add(row.keys[0],'gsc',row);
 for(const row of evidence.semrush?.rows||[])add(row.keyword,'semrush',row);
 for(const row of evidence.otterly?.prompts||[])add(row.prompt,'otterly',row);
 const legacyGroups=new Map();for(const g of groups.values())for(const k of g.legacyKeys)legacyGroups.set(k,(legacyGroups.get(k)||0)+1);
 const year=Number(settings.start.slice(0,4));
 const pool=[...groups.values()].map(g=>{
  // Prefer a monitored label; otherwise show the strongest observed query.
  g.gsc.sort((a,b)=>(b.impressions||0)-(a.impressions||0)||a.keys[0].localeCompare(b.keys[0]));
  g.term=g.semrush[0]?.keyword||g.otterly[0]?.prompt||g.gsc[0]?.keys[0]||g.term;
  const directional=g.groupKey!==topicKey(normalizedTopic(g.term));
  const legacyKeys=[...g.legacyKeys].sort(),key=legacyKeys.length===1&&legacyGroups.get(legacyKeys[0])===1&&!directional?legacyKeys[0]:hash('regrouped-v3:'+g.groupKey);
  const intent=intentFor(g.term,g.semrush.flatMap(r=>intents(r.intents)),year);
  if(intent.label==='Service / navigation')serviceExcluded++;if(intent.label==='Historical query')historicalExcluded++;
  return {...g,key,legacyKeys,intent,demand:Math.max(0,...g.gsc.map(r=>r.impressions||0),...g.semrush.map(r=>r.volume||0))};
 }).filter(g=>g.intent.value>=4);
 const stateBonus=g=>settings.states.some(s=>g.terms.some(t=>t.toLowerCase().includes(s)))?1:0;
 // Use the same conservative difficulty band before and after the candidate cap.
 const preliminary=g=>g.intent.value*7+(g.product==='General Medicare'?3:4)*5+stateBonus(g)*5+(band(g.demand)||0)*2+(competitionFor(g.semrush).value||0)*4;
 pool.sort((a,b)=>preliminary(b)-preliminary(a)||b.demand-a.demand||a.key.localeCompare(b.key));
 const tracked=pool.filter(g=>g.semrush.length||g.otterly.length);
 const selected=[...tracked,...pool.filter(g=>!g.semrush.length&&!g.otterly.length)].slice(0,1000);
 const items=selected.map(g=>{
  const {matches,target,overlap}=matchPages(g,prepared);
  const observedPages=[...new Set([...g.gsc.map(r=>pageKey(r.keys[1])),...g.semrush.map(r=>pageKey(r.landing))].filter(Boolean))];
  const unavailable=!!target&&target.status!=='read';
  const uncertainTarget=!target&&observedPages.length>0;
  const type=unavailable||uncertainTarget?'Investigate page':overlap?'Investigate overlap':target?.direct?'Update existing page':target?'Add / improve section':'New content candidate';
  const gapReason=unavailable?'A relevant page could not be read; this is not proof that content is missing.':uncertainTarget?'Observed landing pages exist, but none is a sufficiently specific content match. Inspect those pages before choosing an update or a new page.':overlap?'Two or more pages with comparable scope and strong title coverage each receive at least 20 impressions and 20% of this group’s observed impressions. Review their roles; this is not proof of cannibalization.':!target?'No sufficiently relevant target in the inspected inventory. Confirm website coverage and search intent before commissioning a new page.':'A relevant existing page was identified using its primary title, topic specificity and observed search evidence. Other related pages do not alone establish overlap.';
  const {kd,value:competition}=competitionFor(g.semrush);
  const business=g.product==='General Medicare'?3:4,stateMatch=stateBonus(g);
  const gapKnown=!unavailable&&!overlap&&!uncertainTarget&&(target||inventoryComplete);
  const components={intent:part(g.intent.value,35,g.intent.reason),business:part(Math.min(5,business+stateMatch),25,'Product fit: '+g.product+'. '+(stateMatch?'Matches a selected priority state.':'No state-priority bonus.')+' No revenue forecast.'),competition:part(competition,20,kd==null?'No difficulty/search-result evidence attached. This component is unknown.':'Saved Semrush difficulty '+kd+' (highest attached value); proxy only. Current search-result quality and format still need review.'),demand:part(band(g.demand),10,'Uses the strongest attached page-query impression count or keyword volume estimate, not their sum. These measures have different scopes; this is an ordinal demand band.'),gap:part(gapKnown?(target?2:3):null,10,gapReason)};
  const score=Object.values(components).reduce((s,c)=>s+(c.points||0),0),unknown=Object.values(components).filter(c=>c.value==null).reduce((s,c)=>s+c.weight,0);
  const usedSources=['gsc','semrush','otterly'].filter(s=>g[s].length),sourceUncertain=usedSources.some(s=>evidence[s]?.status&&evidence[s].status!=='available');
  const confidence=unknown>20||sourceUncertain||unavailable||uncertainTarget||overlap||!target&&!inventoryComplete?'Low':'Moderate';
  const path=target?new URL(target.url).pathname:null;
  const posthog=path?(evidence.posthog?.rows||[]).find(r=>r.path.replace(/\/$/,'')===path.replace(/\/$/,'')):null;
  return {key:g.key,previousKeys:g.legacyKeys.filter(k=>k!==g.key),title:g.term,terms:g.terms,product:g.product,intent:g.intent.label,type,targetUrl:target?.url||null,score:Math.round(score),scoreMax:Math.round(score+unknown),confidence,effort:type==='New content candidate'?'High':type.startsWith('Investigate')?'Research first':'Medium',components,reason:gapReason,relatedPages:matches,observedPages,evidence:{gsc:g.gsc.slice(0,20),gscRows:g.gsc.length,semrush:g.semrush,otterly:g.otterly.map(p=>({id:p.id,prompt:p.prompt,mentions:p.mentions,citations:p.domainMentions})),posthog:posthog?{sessions:posthog.conversions?.sessions??null,quoteStarts:posthog.conversions?.quoteStarts??null,engagement:posthog.engagement||null}:null},nextCheck:!target?'Verify distinct search intent and full-site coverage, then decide whether a new page is justified.':'Inspect the recommended target and confirm a concrete improvement or technical issue.',limitations:['Scores prioritize investigation, not predicted leads.','Grouping merges only explicit wording equivalents; plan letters, brands, questions and directional changes can remain distinct.','Fresh competitor keyword discovery and live search-result validation are not connected.','Otterly prompts are monitored questions, not measured search demand.',...(!inventoryComplete?['Website coverage is partial. Unrelated unreadable pages do not erase verified existing coverage; new-page gaps remain provisional.']:[])]};
 }).sort((a,b)=>b.score-a.score||a.title.localeCompare(b.title));
 return {version:RANK_VERSION,items,counts:{inputGroups:groups.size,originalGroups:originalKeys.size,mergedGroups:[...groups.values()].filter(g=>g.legacyKeys.size>1).length,highIntent:pool.length,reviewed:items.length,excludedOrInvalid:ignored,serviceExcluded,historicalExcluded,candidateLimit:1000,capped:pool.length>1000,trackedCandidates:tracked.length},method:'Buying intent 35%, product/state fit 25%, competition proxy 20%, demand band 10%, coverage gap 10%. Source intent labels alone cannot earn full transactional credit. Unknown components remain a score range; order uses supported points. Quote starts are page context, not keyword-level conversions.'};
}
