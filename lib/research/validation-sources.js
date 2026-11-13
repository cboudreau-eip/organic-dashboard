import {safePage,readPublicPage,pageText} from '../otterly/content-sources.js';
import {pageKey} from './inventory.js';
import {assessValidation,failedValidation} from './validation.js';
export function publicSearchUrl(value){try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password&&!u.port&&u.hostname.includes('.')&&!/^[\d.]+$|localhost$|\.local$/.test(u.hostname)?u.href:null;}catch{return null;}}
export function searchEvidence(result,query,now=new Date()){
 const rows=new Map();
 for(const s of result.sources||[]){const url=publicSearchUrl(s.url);if(!url||safePage(url))continue;const quote=s.providerMetadata?.anthropic?.citedText||s.providerMetadata?.anthropic?.cited_text||'';if(!rows.has(url)||quote)rows.set(url,{url,title:String(s.title||url).slice(0,250),text:String(quote).slice(0,1000)});}
 // Provider-executed results can expose titles/URLs without citation excerpts.
 for(const step of result.steps||[])for(const t of step.toolResults||[])if(t.toolName==='web_search')for(const s of Array.isArray(t.output)?t.output:[]){const url=publicSearchUrl(s.url);if(url&&!safePage(url)&&!rows.has(url))rows.set(url,{url,title:String(s.title||url).slice(0,250),text:''});}
 const sources=[...rows.values()].slice(0,6).map((s,i)=>({...s,id:'search'+(i+1),kind:'search',fetchedAt:now.toISOString()}));
 return {status:sources.some(s=>s.text.length>=20)?'available':sources.length?'limited':'unavailable',query,fetchedAt:now.toISOString(),sources,note:'Limited independent web search with provider citation excerpts; not a Google/Bing rank report or full competitor-page audit.'};
}
export async function validateAssignment(assignment,sourceDates,{search,generate,read=readPublicPage}){
 const query=assignment.topics[0].title;
 const [pages,external]=await Promise.all([
  Promise.all(assignment.candidateUrls.map(async(url,i)=>{try{const r=await read(url),text=pageText(r.html);if(text.length<200)throw Error();return {id:'own'+(i+1),url:pageKey(r.url),requestedUrl:url,kind:'own',title:r.html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]?.slice(0,250)||url,text,fetchedAt:new Date().toISOString(),truncated:text.length>=18000};}catch{return {id:'own'+(i+1),url,kind:'own',status:'unavailable'};}})),
  search(query).catch(()=>({status:'unavailable',query,sources:[],fetchedAt:new Date().toISOString(),note:'The external search could not complete.'}))
 ]);
 const readable=pages.filter(p=>p.text),sources=[...readable,...external.sources.filter(s=>s.text)];
 // A fresh same-host redirect may establish the canonical target without inventing one.
 const redirected=readable.find(p=>p.requestedUrl===assignment.targetUrl);const checked={...assignment,targetUrl:redirected?.url||assignment.targetUrl};
 if(!readable.length)return {...failedValidation('The relevant MedicareFAQ pages could not be read. No content gap is inferred.',assignment,external),pageChecks:pages};
 try{
  const output=await generate({assignment:{targetUrl:checked.targetUrl,topics:assignment.topics.map(t=>({key:t.key,title:t.title,terms:t.terms.slice(0,12),intent:t.intent}))},pages:sources,searchStatus:external.status});
  return {...assessValidation(output,checked,sources,external,sourceDates),verifiedTarget:checked.targetUrl,pageChecks:pages.map(({text,...p})=>p)};
 }catch{return {...failedValidation('The AI assessment could not be verified. Saved evidence remains available; retry this check.',assignment,external),pageChecks:pages.map(({text,...p})=>p)};}
}
