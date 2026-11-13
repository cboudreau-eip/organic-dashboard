import {discoverStep,crawlBatch,PAGE_LIMIT,pageKey} from './inventory.js';
import {rankOpportunities} from './rank.js';
export const SOURCES=['gsc','posthog','semrush','otterly'];
export function initialPayload(cachedPages=[]){return {evidence:{},inventory:{maps:['https://www.medicarefaq.com/sitemap.xml'],seenMaps:[],urls:[],errors:[],pages:[],cachedPages:cachedPages.filter(p=>p.status==='read'&&pageKey(p.url)&&Date.now()-Date.parse(p.fetchedAt)<7*86400000)}};}
export async function advance(run,adapters){
 const p=structuredClone(run.payload),stage=run.stage;
 if(SOURCES.includes(stage)){
  try{
   const result=await adapters[stage](p.evidence[stage]);
   p.evidence[stage]=result;
   if(result.more)return {payload:p,stage,status:'running'};
  }catch{p.evidence[stage]={...(p.evidence[stage]||{}),status:'unavailable',more:false,note:'Collection failed. Start a fresh run to retry this source; retained rows, if any, are partial.'};}
  return {payload:p,status:'running',stage:SOURCES[SOURCES.indexOf(stage)+1]||'sitemaps'};
 }
 if(stage==='sitemaps'){
  p.inventory=await discoverStep(p.inventory,adapters.read);
  if(p.inventory.maps.length)return {payload:p,stage,status:'running'};
  const observed=[...(p.evidence.gsc?.rows||[]).map(r=>pageKey(r.keys[1])),...(p.evidence.semrush?.rows||[]).map(r=>pageKey(r.landing))].filter(Boolean);
  const urls=[...new Set([...observed,...p.inventory.urls])];
  if(urls.length>PAGE_LIMIT)p.inventory.errors.push({reason:'Inventory capped at 2,500 pages; observed landing pages take priority.'});
  const allowed=urls.slice(0,PAGE_LIMIT),reused=[...new Map((p.inventory.cachedPages||[]).filter(p=>allowed.includes(p.requested)).map(p=>[p.requested,p])).values()];
  p.inventory.pages=reused;p.inventory.reused=reused.length;
  p.inventory.urls=[...reused.map(p=>p.requested),...allowed.filter(u=>!reused.some(p=>p.requested===u))];
  delete p.inventory.cachedPages;
  return {payload:p,stage:'pages',status:'running'};
 }
 if(stage==='pages'){
  const pending=p.inventory.urls.slice(p.inventory.pages.length,p.inventory.pages.length+20);
  p.inventory.pages.push(...await crawlBatch(pending,adapters.read));
  return {payload:p,status:'running',stage:p.inventory.pages.length<p.inventory.urls.length?'pages':'rank'};
 }
 if(stage==='rank'){
  const complete=p.inventory.urls.length>0&&!p.inventory.errors.length&&p.inventory.pages.every(x=>x.status==='read');
  p.inventory.complete=complete;
  p.results=rankOpportunities(p.evidence,p.inventory.pages,run.settings,complete);
  const available=SOURCES.slice(0).filter(s=>s!=='posthog'&&(p.evidence[s]?.rows?.length||p.evidence[s]?.prompts?.length));
  if(!available.length)throw Error('No candidate evidence is available. Start a fresh run after checking data sources.');
  return {payload:p,status:'complete',stage:'complete'};
 }
 throw Error('This run cannot advance.');
}
export function publicRun(run){
 if(!run)return null;
 const {payload,...meta}=run,p=payload||{},inventory=p.inventory||{};
 const results=p.results?{...p.results,items:Array.isArray(p.results.items)?p.results.items.map(({evidence,relatedPages,observedPages,components,limitations,...item})=>({...item,terms:item.terms.slice(0,30)})):[]}:null;
 return {...meta,sources:Object.fromEntries(Object.entries(p.evidence||{}).map(([key,{rows,prompts,...source}])=>[key,{...source,count:rows?.length??rows?.count??prompts?.length??prompts?.count??0}])),inventory:{total:inventory.urls?.length||0,read:Array.isArray(inventory.pages)?inventory.pages.filter(p=>p.status==='read').length:inventory.readCount||0,processed:inventory.pages?.length??inventory.pages?.count??0,reused:inventory.reused||0,sitemaps:inventory.seenMaps?.length||0,errors:inventory.errors||[],complete:inventory.complete||false},results};
}
