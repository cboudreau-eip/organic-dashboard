import {createHash} from 'node:crypto';
import {pageKey} from './inventory.js';
import {intents} from '../semrush/opportunities.js';
export const RANK_VERSION='research-v1';
const stop=new Set('a an the is are do does i my me you your how what which can should to for of in on with and or at by from'.split(' '));
export function tokens(value){return [...new Set(String(value).toLowerCase().replace(/medicare supplement(?:al)?/g,'medigap').replace(/supplemental insurance/g,'medigap').replace(/companies/g,'company').replace(/quotes/g,'quote').replace(/plans/g,'plan').match(/[a-z0-9]+/g)?.filter(s=>!stop.has(s))||[])];}
export const topicKey=text=>createHash('sha256').update(tokens(text).sort().join(' ')).digest('hex').slice(0,24);
export function productFor(text){return /\b(part d|prescription|drug|pharmacy)\b/i.test(text)?'Part D':/\b(advantage|mapd|hmo|ppo)\b/i.test(text)&&!/medigap|supplement/i.test(text)?'Medicare Advantage':/medigap|supplement|plan [fgndklm]\b/i.test(text)?'Medigap':'General Medicare';}
export function intentFor(text,sourceIntents=[]){
 if(/\b(quote|quotes|apply|enroll|buy|purchase)\b/i.test(text)||sourceIntents.includes('transactional'))return {value:5,label:'Transactional',reason:'Observed application, enrollment, purchase or quote wording; verify intent in search results.'};
 if(/\b(compare|comparison|best|company|companies|carrier|price|cost|premium|discount|rate|switch|change|underwriting|eligible|eligibility)\b/i.test(text)||sourceIntents.includes('commercial'))return {value:4,label:'Commercial / buying obstacle',reason:'Comparison, pricing, selection or eligibility wording suggests a buying decision; rule-based assessment.'};
 return {value:2,label:'Supporting information',reason:'No strong buying signal in the observed wording.'};
}
const part=(value,weight,reason)=>({value,weight,points:value==null?null:Math.round(value/5*weight*10)/10,reason});
function matchPages(group,inventory){
 const terms=tokens(group.term),set=new Set(terms);
 const directlyObserved=new Set([...group.gsc.map(r=>pageKey(r.keys[1])),...group.semrush.map(r=>pageKey(r.landing))].filter(Boolean));
 return inventory.map(page=>{
  const head=page.headTokens;
  const body=page.bodyTokens;
  const overlap=terms.filter(t=>head.has(t)).length/(set.size||1);
  const bodyOverlap=terms.filter(t=>body.has(t)).length/(set.size||1);
  return {url:page.url,title:page.title,status:page.status,canonical:page.canonical,match:Math.round(overlap*100),bodyMatch:Math.round(bodyOverlap*100),direct:directlyObserved.has(page.url)||directlyObserved.has(page.requested),headings:page.headings.filter(h=>tokens(h).some(t=>set.has(t))).slice(0,4)};
 }).filter(p=>p.direct||p.match>=45||(p.bodyMatch>=80&&p.match>=25)).sort((a,b)=>Number(b.direct)-Number(a.direct)||b.match-a.match||b.bodyMatch-a.bodyMatch).slice(0,5);
}
export function rankOpportunities(evidence,inventory,settings,inventoryComplete){
 inventory=inventory.map(p=>({...p,headTokens:new Set(tokens(p.title+' '+p.headings.join(' '))),bodyTokens:new Set(tokens(p.text))}));
 const groups=new Map();let ignored=0;
 function add(term,source,row){
  if(typeof term!=='string'||term.length>250||term.length<4||settings.excluded.some(s=>term.toLowerCase().includes(s))){ignored++;return;}
  const product=productFor(term);if(product!=='General Medicare'&&!settings.products.includes(product)){ignored++;return;}
  const key=topicKey(term);if(!groups.has(key))groups.set(key,{key,term,product,terms:[],gsc:[],semrush:[],otterly:[]});
  const g=groups.get(key);if(!g.terms.includes(term))g.terms.push(term);g[source].push(row);
 }
 for(const row of evidence.gsc?.rows||[])add(row.keys[0],'gsc',row);
 for(const row of evidence.semrush?.rows||[])add(row.keyword,'semrush',row);
 for(const row of evidence.otterly?.prompts||[])add(row.prompt,'otterly',row);
 const pool=[...groups.values()].map(g=>({...g,intent:intentFor(g.term,g.semrush.flatMap(r=>intents(r.intents))),demand:Math.max(0,...g.gsc.map(r=>r.impressions),...g.semrush.map(r=>r.volume||0))})).filter(g=>g.intent.value>=4);
 // Prioritize buyer intent before visibility; no minimum volume excludes new long-tail topics.
 pool.sort((a,b)=>b.intent.value-a.intent.value||b.demand-a.demand||a.key.localeCompare(b.key));
 const selected=pool.slice(0,1000);
 const items=selected.map(g=>{
  const matches=matchPages(g,inventory),target=matches.find(p=>p.direct)||matches[0]||null;
  const observedPages=[...new Set([...g.gsc.map(r=>pageKey(r.keys[1])),...g.semrush.map(r=>pageKey(r.landing))].filter(Boolean))];
  const unavailable=target&&target.status!=='read';
  const overlap=matches.filter(p=>p.status==='read'&&(p.direct||p.match>=75)).length>1;
  const type=unavailable?'Investigate page':overlap?'Investigate overlap':target?.direct?'Update existing page':target?.match>=65?'Add / improve section':'New content candidate';
  const gapReason=unavailable?'A relevant page could not be read; this is not proof that content is missing.':overlap?'Several pages match this need. Check their distinct roles; multiple results alone do not prove cannibalization.':type==='New content candidate'?'No strong title/heading match in the inspected inventory. Confirm the gap before commissioning a new page.':'Existing coverage was found. Verify the specific missing answer before approving an update.';
  const difficulties=g.semrush.map(k=>k.difficulty).filter(Number.isFinite),kd=difficulties.length?Math.max(...difficulties):null;
  const competition=kd==null?null:kd<=30?4:kd<=50?3:kd<=70?2:1;
  const business=g.product==='General Medicare'?3:4;
  const stateMatch=settings.states.some(s=>g.term.toLowerCase().includes(s));
  const components={intent:part(g.intent.value,35,g.intent.reason),business:part(Math.min(5,business+(stateMatch?1:0)),25,`Product fit: ${g.product}. ${stateMatch?'Matches a selected priority state.':'No state-priority bonus.'} No revenue forecast.`),competition:part(competition,20,kd==null?'No difficulty/search-result evidence attached. This component is unknown.':`Saved Semrush difficulty ${kd}; proxy only. Current search-result quality and format still need review.`),demand:part(g.demand>=1000?4:g.demand>=100?3:g.demand>0?2:null,10,'Uses the strongest attached page-query impression count or keyword volume estimate, not their sum. These measures have different scopes; this is an ordinal demand band.'),gap:part(inventoryComplete&&!unavailable&&!overlap?(type==='New content candidate'?3:2):null,10,gapReason)};
  const score=Object.values(components).reduce((s,c)=>s+(c.points||0),0),unknown=Object.values(components).filter(c=>c.value==null).reduce((s,c)=>s+c.weight,0);
  const datesStale=Object.values(evidence).some(s=>s?.status==='stale');
  const confidence=!inventoryComplete||unknown>20||datesStale||unavailable?'Low':'Moderate';
  const path=target?new URL(target.url).pathname:null;
  const posthog=path?(evidence.posthog?.rows||[]).find(r=>r.path.replace(/\/$/,'')===path.replace(/\/$/,'')):null;
  return {key:g.key,title:g.term,terms:g.terms,product:g.product,intent:g.intent.label,type,targetUrl:target?.url||null,score:Math.round(score),scoreMax:Math.round(score+unknown),confidence,effort:type==='New content candidate'?'High':type.startsWith('Investigate')?'Research first':'Medium',components,reason:gapReason,relatedPages:matches,observedPages,evidence:{gsc:g.gsc.slice(0,20),gscRows:g.gsc.length,semrush:g.semrush,otterly:g.otterly.map(p=>({id:p.id,prompt:p.prompt,mentions:p.mentions,citations:p.domainMentions})),posthog:posthog?{sessions:posthog.conversions?.sessions??null,quoteStarts:posthog.conversions?.quoteStarts??null,engagement:posthog.engagement||null}:null},nextCheck:type==='New content candidate'?'Verify distinct search intent and full-site coverage, then decide whether a new page is justified.':'Inspect the matched pages and confirm a concrete improvement or technical issue.',limitations:['Scores prioritize investigation, not predicted leads.','Conservative wording-based grouping may leave related topics separate.','Fresh competitor keyword discovery and live search-result validation are not connected.','Otterly prompts are monitored questions, not measured search demand.']};
 }).sort((a,b)=>b.score-a.score||a.title.localeCompare(b.title));
 return {version:RANK_VERSION,items,counts:{inputGroups:groups.size,highIntent:pool.length,reviewed:items.length,excludedOrInvalid:ignored,candidateLimit:1000,capped:pool.length>1000},method:'Buying intent 35%, product/state fit 25%, competition proxy 20%, demand band 10%, coverage gap 10%. Unknown components remain a score range; order uses supported points. Quote starts are context, not a keyword-level conversion claim.'};
}
