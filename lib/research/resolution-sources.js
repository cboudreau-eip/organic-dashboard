import {safePage,readPublicPage,pageText} from '../otterly/content-sources.js';
import {pageKey} from './inventory.js';
import {sourcePassages} from './validation-sources.js';
import {RESOLUTION_VERSION,applyResolution,checkProposal,blockersFor} from './resolution.js';
import {topicEvidence} from './decision-audit.js';
const normalized=value=>String(value||'').toLowerCase().replace(/medicare supplement|medigap/g,'supplement').replace(/prescription drug/g,'part d').replace(/\b(prices|pricing|premiums|rates)\b/g,'cost').replace(/[^a-z0-9 ]/g,' ').replace(/\s+/g,' ').trim();
export function resolutionCandidates(a,inventory){
 const query=normalized(a.topics.map(t=>t.title).join(' ')),terms=new Set(query.split(' ').filter(t=>t.length>2&&!['medicare','what','how','can','the','and','with','for','does','have','plan','plans'].includes(t)));
 const distinctions=query.match(/(?:plan|part) [a-z]\b/g)||[];
 const ranked=inventory.filter(p=>safePage(p.url)&&!['/','/blog','/medicare-supplement-plans','/original-medicare'].includes(new URL(p.url).pathname.replace(/\/$/,'')||'/')).map(p=>{const title=normalized([p.title,...(p.headings||[]),new URL(p.url).pathname].join(' '));let score=[...terms].filter(t=>title.split(' ').includes(t)).length;for(const d of distinctions)score+=title.includes(d)?5:-2;return {url:pageKey(p.canonical||p.url),score};}).filter(p=>p.score>0).sort((a,b)=>b.score-a.score||a.url.length-b.url.length);
 return [...new Set([a.targetUrl,...ranked.map(p=>p.url),...a.candidateUrls].filter(safePage))].slice(0,6);
}
export function failedResolution(a,stage,category='unavailable'){
 const question=stage==='pages'?'The selected MedicareFAQ pages could not be read. Retry or confirm the relevant page.':`The ${stage==='proposal'?'research assessment':'independent verification'} could not complete (${category}). Retry this check; no recommendation was accepted.`;
 return {...a.result,readiness:'Needs research',confidence:'Low',retryable:true,checks:[question],verification:{status:'Unavailable',verdicts:[]},resolution:{version:RESOLUTION_VERSION,completedAt:new Date().toISOString(),blockers:[{code:'technical',question}],previousBlockers:blockersFor(a),optionalChecks:[],matchedPages:[],failure:{stage,category}},summary:'Research resolution could not finish. Previous findings are retained for context, not approval.'};
}
export async function resolveAssignment(a,dates,{search,generate,verify,read=readPublicPage}){
 let stage='pages';const audit={pageLimit:6,searchLimit:2,proposalAttempts:0,verificationAttempts:0,startedAt:new Date().toISOString()};let pageChecks=[],searches=[];
 try{
  const topic=a.topics.slice(0,2).map(t=>t.title).join(' ');
  const carrier=/carrier|compan|review|complaint|lumico|aetna|cigna|humana|omaha|blue cross|healthspring/i.test(topic);
  const queries=[topic,(carrier?'official carrier regulator evidence ':'site:gov Medicare CMS official guidance ')+topic];
  const [readPages,searched]=await Promise.all([
   Promise.all((a.resolutionUrls||a.candidateUrls).slice(0,6).map(async(url,i)=>{try{const r=await read(url),text=pageText(r.html);if(text.length<200)throw Error();return {id:'own'+(i+1),url:pageKey(r.url),requestedUrl:url,title:r.html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]?.replace(/&amp;/g,'&').slice(0,250)||url,kind:'own',text,fetchedAt:new Date().toISOString(),truncated:text.length>=18000};}catch{return {id:'own'+(i+1),url,kind:'own',status:'unavailable'};}})),
   Promise.all(queries.map(query=>search(query).catch(()=>({status:'unavailable',query,sources:[],note:'Search could not complete.'}))))
  ]);
  pageChecks=readPages.map(({text,...p})=>p);searches=searched;
  const own=readPages.filter(p=>p.text),external=searched.flatMap((s,i)=>s.sources.filter(p=>p.text).map((p,j)=>({...p,id:`search${i+1}_${j+1}`})));
  if(!own.length&&a.targetUrl)return {...failedResolution(a,'pages'),pageChecks};
  const pages=[...own,...external].map(({text,...p})=>({...p,passages:sourcePassages({...p,text})}));
  if(!pages.length)return {...failedResolution(a,'pages'),pageChecks};
  const canonical=own.find(p=>p.requestedUrl===a.targetUrl)?.url;
  const checked={...a,targetUrl:canonical||a.targetUrl};
  const context={reviewDate:new Date().toISOString().slice(0,10),sourceDates:dates,assignment:{targetUrl:checked.targetUrl,topics:a.topics.map(topicEvidence),aiEvidence:a.aiEvidence||null},previous:{blockers:blockersFor(a),findings:(a.result?.findings||[]).map(({topicKey,judgement})=>({topicKey,judgement})),note:'Earlier model conclusions are hypotheses, not requirements or facts. Reassess them independently.'},inventory:{complete:!!a.coverage?.inventoryComplete,entries:a.coverage?.inventoryPages,inspected:own.length,limit:6},pages};
  stage='proposal';let proposal;
  for(let attempt=0;attempt<2;attempt++){audit.proposalAttempts++;try{proposal=checkProposal(await generate({...context,...(attempt?{repair:'Return exactly one concise finding per topic. Use listed passage IDs. No URLs in prose. Tasks describe work only: no draft sentences, quotations, premium amounts or percentage claims. Covered task must be exactly No change needed.'}:{})}),checked,pages);break;}catch(e){if(attempt===1)throw e;}}
  stage='verification';let result;
  for(let attempt=0;attempt<2;attempt++){audit.verificationAttempts++;try{
   const verified=await verify({...context,proposal,...(attempt?{repair:'Return exactly one concise finding per topic. Keep summary under 500 characters and at most three optional checks. No URLs in prose. Use listed passage IDs. Preserve proposed improvement tasks verbatim; covered task must be exactly No change needed.'}:{})});
   result=applyResolution(checked,proposal,verified,pages,dates);break;
  }catch(e){if(attempt===1||!['Invalid resolution structure','Invalid resolution finding','Invalid reconciliation'].includes(e?.message))throw e;}}
  return {...result,pageChecks,search:{status:searched.some(s=>s.status==='available')?'available':'unavailable',query:queries.join(' | '),sources:external,note:'Two bounded searches with citation excerpts; not a full search-ranking or competitor audit.'},resolution:{...result.resolution,audit:{...audit,completedAt:new Date().toISOString()},searches:searched.map(({sources,...s})=>({...s,sourceCount:sources.length}))}};
 }catch(e){const category=['AbortError','TimeoutError'].includes(e?.name)?'timeout':String(e?.name).includes('APICall')?'provider unavailable':'invalid evidence response';
  const known=['Unknown resolution passage','Invalid resolution structure','Invalid resolution finding','Missing resolution evidence','Coverage needs a MedicareFAQ passage','Improvement needs target-page evidence','New-page scope unsupported','Invalid reconciliation','Unverified replacement task','Covered finding cannot contain work'];
  const failed=failedResolution(a,stage,category);
  return {...failed,pageChecks,resolution:{...failed.resolution,failure:{...failed.resolution.failure,detail:known.includes(e?.message)?e.message:'Provider response could not be validated'},audit,searches:searches.map(({sources,...s})=>({...s,sourceCount:sources.length}))}};}
}
