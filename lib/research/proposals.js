import {hash,groupingKey,intentFor,productFor} from './topics.js';
import {isLongTail} from './discovery.js';
import {prepareInventory,matchPages} from './page-matching.js';
export const MIX={'High intent':35,'Long-tail':25,'AI citations':15,'Evergreen':15};
const identity=t=>groupingKey(t.toLowerCase().replace(/\b20\d{2}\b/g,''));
const products=['Medicare Supplement Plan G','Medicare Supplement Plan N','Medicare Advantage','Medicare Part D','Medigap'];
const patterns={
 'High intent':['Compare {p} options before requesting a quote','What affects the price of {p}?','Questions to ask before buying {p}','How to compare {p} providers','Switching to {p}: costs and eligibility','Choosing {p} for your budget','How to request and compare {p} quotes'],
 'Long-tail':['How do I compare {p} costs when I take several prescriptions?','Can I switch to {p} after my employer coverage ends?','What should I check before choosing {p} if I travel?','How do I compare {p} when my monthly budget changes?','What questions should I ask about {p} before enrolling?'],
 'AI citations':['How does {p} work?','What should someone compare when choosing {p}?','What costs should I consider with {p}?'],
 'Evergreen':['A beginner’s guide to {p}','Common terms to understand when comparing {p}','How to review your {p} coverage each year']
};
export function generateProposals(payload,settings){
 const ranked=payload.results?.items||[],e=payload.evidence||{},prepared=prepareInventory(payload.inventory?.pages||[]);
 const candidates=new Map(),add=(title,source,row)=>{if(!title||title.length>250)return;const k=identity(title);if(!candidates.has(k))candidates.set(k,{title,terms:[title],evidence:{gsc:[],semrush:[],otterly:[]}});const c=candidates.get(k);if(c.terms.length<40&&!c.terms.includes(title))c.terms.push(title);if(c.evidence[source].length<10)c.evidence[source].push(row);};
 for(const r of [...(e.gsc?.rows||[])].sort((a,b)=>(b.impressions||0)-(a.impressions||0)))add(r.keys[0],'gsc',r);
 for(const r of e.semrush?.rows||[])add(r.keyword,'semrush',r);
 for(const r of e.otterly?.prompts||[])add(r.prompt,'otterly',{id:r.id,prompt:r.prompt,mentions:r.mentions??null,citations:r.domainMentions??null});
 const eligible=c=>!settings.excluded.some(x=>c.title.toLowerCase().includes(x))&&(productFor(c.title)==='General Medicare'||settings.products.includes(productFor(c.title)))&&!['Historical query','Service / navigation'].includes(intentFor(c.title,[],Number(settings.start.slice(0,4))).label);
 const observed=[...candidates.values()].filter(eligible),byIdentity=new Map(ranked.map(x=>[identity(x.title),x]));
 const pools={
  'High intent':ranked.filter(eligible),
  'Long-tail':ranked.filter(x=>eligible(x)&&x.terms.some(isLongTail)),
  'AI citations':observed.filter(x=>x.evidence.otterly.length).sort((a,b)=>{const min=x=>Math.min(...x.evidence.otterly.map(p=>Number.isFinite(p.citations)?p.citations:Infinity));return min(a)-min(b)||a.title.localeCompare(b.title);}),
  'Evergreen':observed.filter(x=>!x.title.match(/\b20\d{2}\b|\bnews\b|\blatest\b/i)&&intentFor(x.title).value===2).sort((a,b)=>(b.evidence.gsc[0]?.impressions||0)-(a.evidence.gsc[0]?.impressions||0))
 };
 const used=new Set(),pageCounts=new Map(),items=[];
 function take(candidate,category,suggested=false){
  const aliases=candidate.terms.map(identity);if(aliases.some(k=>used.has(k)))return false;
  const c=byIdentity.get(identity(candidate.title))||candidate;
  const target=c.targetUrl||(!suggested?matchPages({term:c.title,gsc:c.evidence.gsc||[],semrush:c.evidence.semrush||[]},prepared).target?.url:null)||null;
  if(target&&(pageCounts.get(target)||0)>=2)return false;
  aliases.forEach(k=>used.add(k));if(target)pageCounts.set(target,(pageCounts.get(target)||0)+1);
  const evidence=suggested?{gsc:[],semrush:[],otterly:[]} : {gsc:(c.evidence.gsc||[]).slice(0,5),semrush:(c.evidence.semrush||[]).slice(0,5),otterly:(candidate.evidence.otterly||[]).length?candidate.evidence.otterly.slice(0,5):(c.evidence.otterly||[]).slice(0,5),posthog:c.evidence.posthog||null};
  const longTerm=category==='Long-tail'?candidate.terms.find(isLongTail):null,title=longTerm||candidate.title;
  const action=category==='AI citations'?`Review AI answers and cited sources for “${title}”; identify a supported improvement to MedicareFAQ’s answer and source references.`:category==='Evergreen'?`Review coverage of “${title}” and propose a durable explanatory resource with relevant links to plan-selection pages.`:`Assess “${title}” and propose a focused buying-decision ${target?'improvement on the matched page':'resource after checking existing website coverage'}.`;
  items.push({id:hash('proposal:'+identity(title)),category,title,terms:candidate.terms.slice(0,20),targetUrl:target||'',action,notes:'',type:target?'Existing-page investigation':'New-page investigation',basis:suggested?'Research suggestion':'Observed opportunity',evidence,sourceKey:c.key||null,priority:c.score??null,measure:category==='AI citations'&&suggested?'Validate this question, then add it to Otterly monitoring if appropriate. Establish citation and mention baselines before measuring change.':category==='AI citations'?'Track MedicareFAQ citations and mentions for this monitored prompt and platform over comparable reporting windows; no citation improvement is guaranteed.':category==='Evergreen'?'Track relevant GSC queries, organic landing-page engagement and onward visits to commercial pages.':'Track relevant GSC query/page clicks and rankings, plus page-level quote starts. Do not attribute page conversions to individual keywords.',verification:suggested?'No observed keyword demand or monitored-prompt evidence attached. Validate demand, relevance, website overlap and factual requirements before implementation.':'Confirm the actual content gap, page overlap, current search intent and factual sources before implementation. Source presence is not proof that a new page or change is needed.'});return true;
 }
 // Reserve specialized candidates before allocating the broader commercial pool.
 for(const category of ['AI citations','Evergreen','Long-tail','High intent']){
  let n=0;for(const c of pools[category]){if(take(c,category))n++;if(n===MIX[category])break;}
  if(n<MIX[category])for(const pattern of patterns[category])for(const product of products){if(n>=MIX[category])break;const title=pattern.replace('{p}',product);const c={title,terms:[title],evidence:{gsc:[],semrush:[],otterly:[]}};if(eligible(c)&&take(c,category,true))n++;}
 }
 items.sort((a,b)=>Object.keys(MIX).indexOf(a.category)-Object.keys(MIX).indexOf(b.category));
 return {version:'proposals-v1',items,targets:MIX,requested:90,sourceDates:Object.fromEntries(Object.entries(e).map(([k,v])=>[k,{period:v.period||null,status:v.status||'unknown',fetchedAt:v.fetchedAt||null}])),limitations:['These are editable demo proposals, not approved implementation work.','Equivalent query wording is grouped; semantic overlap still needs review. No more than two observed assignments use the same target page.','Research suggestions fill category shortfalls without invented demand or citation metrics.','Source dates and partial coverage remain unchanged. No calendar or article content is generated.']};
}
export function proposalEdit(input,items){
 const allowed=['title','action','targetUrl','notes'];
 if(!input||!items.some(x=>x.id===input.itemId)||!input.fields||Object.keys(input.fields).some(k=>!allowed.includes(k)))throw Error('Choose a valid proposal and editable fields.');
 for(const [k,v] of Object.entries(input.fields)){if(typeof v!=='string'||v.length>(k==='title'?300:k==='targetUrl'?1000:3000)||(['title','action'].includes(k)&&!v.trim()))throw Error('Check the proposal text and field lengths.');}
 if(input.fields.targetUrl){let u;try{u=new URL(input.fields.targetUrl);}catch{throw Error('Use a MedicareFAQ HTTPS page URL.');}if(u.protocol!=='https:'||!['www.medicarefaq.com','medicarefaq.com'].includes(u.hostname)||u.username||u.password)throw Error('Use a MedicareFAQ HTTPS page URL.');}
 return input.fields;
}
export const publicProposalPlan=p=>p?{...p,payload:{...p.payload,items:p.payload.items.map(i=>({...i,...(p.edits?.[i.id]||{}),edited:!!p.edits?.[i.id]}))},edits:undefined}:null;
