import {primaryUrl} from '../research/primary-sources.js';
import {pageText} from '../otterly/content-sources.js';

export function selectDocumentPages(pages,question,maxPages=14){
 const words=[...new Set(question.toLowerCase().match(/[a-z]{4,}/g)||[])].filter(w=>!['this','that','with','from','have','page','review','verify','does','which','their','your','medicare'].includes(w));
 const ranked=pages.map(p=>({...p,score:words.reduce((sum,w)=>sum+(p.text.toLowerCase().includes(w)?1:0),0)+['guaranteed issue','trial right','underwriting'].reduce((sum,phrase)=>sum+(question.toLowerCase().includes(phrase)&&p.text.toLowerCase().includes(phrase)?6:0),0)})).sort((a,b)=>b.score-a.score||a.page-b.page);
 const chosen=new Set();
 for(const p of ranked){if(chosen.size>=maxPages)break;chosen.add(p.page);for(const adjacent of [p.page-1,p.page+1])if(chosen.size<maxPages&&pages.some(x=>x.page===adjacent))chosen.add(adjacent);}
 return pages.filter(p=>chosen.has(p.page));
}
export async function extractPdf(bytes){
 const {getDocument}=await import('pdfjs-dist/legacy/build/pdf.mjs');
 const task=getDocument({data:new Uint8Array(bytes),useSystemFonts:false,disableFontFace:true,verbosity:0});
 const timer=setTimeout(()=>task.destroy(),20000);
 try{
  const pdf=await task.promise;if(pdf.numPages>100)throw Error('PDF exceeds page limit');
  const labels=await pdf.getPageLabels(),pages=[];
  for(let i=1;i<=pdf.numPages;i++){
   const p=await pdf.getPage(i),content=await p.getTextContent();
   const text=content.items.filter(x=>typeof x.str==='string').map(x=>x.str+(x.hasEOL?'\n':' ')).join('').trim();
   if(text.length>25000)throw Error('PDF page exceeds text limit');
   pages.push({page:i,label:labels?.[i-1]||String(i),text});p.cleanup();
  }
  if(pages.reduce((n,p)=>n+p.text.length,0)<200)throw Error('PDF has no readable text');
  return pages;
 }finally{clearTimeout(timer);await task.destroy();}
}
export async function readVerificationSource(url,question,{fetcher=fetch,parsePdf=extractPdf}={}){
 let current=primaryUrl(url);if(!current||!new URL(current).hostname.endsWith('.gov'))throw Error('Unsupported official source');
 const signal=AbortSignal.timeout(20000);
 for(let hop=0;hop<3;hop++){
  const r=await fetcher(current,{redirect:'manual',signal,cache:'no-store'});
  if(r.status>=300&&r.status<400){const next=r.headers.get('location');await r.body?.cancel();current=next&&primaryUrl(new URL(next,current).href);if(!current||!new URL(current).hostname.endsWith('.gov'))throw Error('Unsupported redirect');continue;}
  const type=r.headers.get('content-type')||'',pdf=type.includes('application/pdf');
  if(!r.ok||(!pdf&&!type.includes('text/html'))){await r.body?.cancel();throw Error('Unsupported document');}
  const reader=r.body.getReader(),chunks=[];let size=0;
  try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>(pdf?8000000:1500000)){await reader.cancel();throw Error('Document too large');}chunks.push(value);}}finally{reader.releaseLock();}
  const bytes=Buffer.concat(chunks),fetchedAt=new Date().toISOString();
  if(pdf){const all=await parsePdf(bytes),documentPages=selectDocumentPages(all,question);return {url:current,title:'Official PDF guidance',kind:'official',format:'pdf',documentPages,totalPages:all.length,text:documentPages.map(p=>p.text).join('\n'),truncated:documentPages.length<all.length,fetchedAt};}
  const html=bytes.toString('utf8'),text=pageText(html);if(text.length<200)throw Error('No readable document');
  return {url:current,title:html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]?.slice(0,250)||current,text,kind:'official',format:'html',truncated:text.length>=18000,fetchedAt};
 }
 throw Error('Too many redirects');
}
export function verificationPassages(source){
 if(source.documentPages)return source.documentPages.map(p=>({id:source.id+'page'+p.page,text:p.text,page:p.page,pageLabel:p.label,url:source.url+'#page='+p.page}));
 // Larger contiguous passages preserve qualifying clauses and the surrounding context.
 const result=[];for(let start=0;start<source.text.length;start+=1800)result.push({id:source.id+'p'+(result.length+1),text:source.text.slice(start,start+2000)});return result;
}
