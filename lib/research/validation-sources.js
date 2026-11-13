import {safePage,readPublicPage,pageText} from '../otterly/content-sources.js';
import {pageKey} from './inventory.js';
import {assessValidation,failedValidation} from './validation.js';
import {applyVerification} from './assignment-verification.js';
import {topicEvidence} from './decision-audit.js';
export function publicSearchUrl(value){try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password&&!u.port&&u.hostname.includes('.')&&!/^[\d.]+$|localhost$|\.local$/.test(u.hostname)?u.href:null;}catch{return null;}}
export function sourcePassages(source){
 const passages=[];let offset=0;
 while(offset<source.text.length){let end=Math.min(offset+300,source.text.length);if(end<source.text.length){const space=source.text.lastIndexOf(' ',end);if(space>offset)end=space;}const text=source.text.slice(offset,end).trim();if(text)passages.push({id:source.id+'p'+(passages.length+1),text});offset=end;while(source.text[offset]===' ')offset++;}
 return passages;
}
export function attachVerifiedPassages(output,pages){
 return {...output,findings:output.findings.map(({passageId,...f})=>{const source=pages.find(p=>p.id===f.sourceId),passage=source?.passages.find(p=>p.id===passageId);if(f.sourceId!==null&&!passage||f.sourceId===null&&passageId!==null)throw Error('Invalid passage reference');return {...f,quote:passage?.text||''};})};
}
export function searchEvidence(result,query,now=new Date()){
 const rows=new Map();
 for(const s of result.sources||[]){const url=publicSearchUrl(s.url);if(!url||safePage(url))continue;const quote=s.providerMetadata?.anthropic?.citedText||s.providerMetadata?.anthropic?.cited_text||'';if(!rows.has(url)||quote)rows.set(url,{url,title:String(s.title||url).slice(0,250),text:String(quote).slice(0,1000)});}
 // AI SDK 7 attaches citation excerpts to text parts while top-level sources are listings.
 for(const part of [...(result.content||[]),...(result.steps||[]).flatMap(s=>s.content||[])])for(const c of part.citations||[]){const s=c.source,url=publicSearchUrl(s?.url),quote=c.citedText||s?.providerMetadata?.anthropic?.cited_text;if(url&&!safePage(url)&&quote)rows.set(url,{url,title:String(s.title||url).slice(0,250),text:String(quote).slice(0,1000)});}
 // Provider-executed results can expose titles/URLs without citation excerpts.
 for(const step of result.steps||[])for(const t of step.toolResults||[])if(t.toolName==='web_search')for(const s of Array.isArray(t.output)?t.output:[]){const url=publicSearchUrl(s.url);if(url&&!safePage(url)&&!rows.has(url))rows.set(url,{url,title:String(s.title||url).slice(0,250),text:''});}
 const sources=[...rows.values()].sort((a,b)=>Number(!!b.text)-Number(!!a.text)).slice(0,6).map((s,i)=>({...s,id:'search'+(i+1),kind:'search',fetchedAt:now.toISOString()}));
 return {status:sources.some(s=>s.text.length>=20)?'available':sources.length?'limited':'unavailable',query,fetchedAt:now.toISOString(),sources,note:'Limited independent web search with provider citation excerpts; not a Google/Bing rank report or full competitor-page audit.'};
}
export async function validateAssignment(assignment,sourceDates,{search,generate,verify,read=readPublicPage}){
 const query=assignment.topics[0].title;
 const [pages,external]=await Promise.all([
  Promise.all(assignment.candidateUrls.map(async(url,i)=>{try{const r=await read(url),text=pageText(r.html);if(text.length<200)throw Error();return {id:'own'+(i+1),url:pageKey(r.url),requestedUrl:url,kind:'own',title:r.html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]?.slice(0,250)||url,text,fetchedAt:new Date().toISOString(),truncated:text.length>=18000};}catch{return {id:'own'+(i+1),url,kind:'own',status:'unavailable'};}})),
  search(query).catch(()=>({status:'unavailable',query,sources:[],fetchedAt:new Date().toISOString(),note:'The external search could not complete.'}))
 ]);
 const readable=pages.filter(p=>p.text),sources=[...readable,...external.sources.filter(s=>s.text)];
 // A fresh same-host redirect may establish the canonical target without inventing one.
 const redirected=readable.find(p=>p.requestedUrl===assignment.targetUrl);const checked={...assignment,targetUrl:redirected?.url||assignment.targetUrl};
 if(!readable.length&&(assignment.targetUrl||!sources.length))return {...failedValidation('The relevant MedicareFAQ pages could not be read. No content gap is inferred.',assignment,external),pageChecks:pages};
 try{
  const contextPages=sources.map(({text,...s})=>({...s,passages:sourcePassages({...s,text})}));
  const context={sourceDates,assignment:{targetUrl:checked.targetUrl,topics:assignment.topics.map(topicEvidence),coverage:assignment.coverage},pages:contextPages,searchStatus:external.status};
  let output,assessment;
  // One bounded repair can correct formatting/reference mistakes without another
  // crawl or search. It never bypasses verification or retries an evidence hold.
  for(let attempt=0;attempt<2;attempt++){
   try{const proposed=await generate({...context,...(attempt?{validationFeedback:'The previous response failed structural/evidence validation. Return one concise finding per supplied topic, use only its exact listed passage ID and matching source ID, keep checks to five, and put no URLs in prose. Use uncertain when evidence is insufficient.'}:{})});
    output=attachVerifiedPassages(proposed,contextPages);assessment=assessValidation(output,checked,sources,external,sourceDates);break;
   }catch(e){if(attempt===1)throw e;}
  }
  const first={...assessment,verifiedTarget:checked.targetUrl,pageChecks:pages.map(({text,...p})=>p)};
  if(!verify)return {...first,readiness:'Needs research',confidence:'Low',retryable:true,verification:{status:'Unavailable',verdicts:[]},checks:[...first.checks,'Second verification pass is unavailable.']};
  try{const second=await verify({...context,proposal:output}),additional=second.additionalPages||[];
   return applyVerification({...first,sources:[...first.sources,...additional.map(({passages,...p})=>p)]},second,checked,[...contextPages,...additional]);}
  catch{return {...first,readiness:'Needs research',confidence:'Low',retryable:true,verification:{status:'Unavailable',verdicts:[]},checks:[...first.checks,'The second verification pass could not be completed. Retry before accepting this assignment.']};}
 }catch{return {...failedValidation('The AI assessment could not be verified. Saved evidence remains available; retry this check.',assignment,external),pageChecks:pages.map(({text,...p})=>p)};}
}
