import {pageText} from '../otterly/content-sources.js';
const hosts=['medicare.gov','cms.gov','naic.org','content.naic.org','ambest.com','mutualofomaha.com','aetna.com','cigna.com','healthspring.com','humana.com','bcbs.com','anthem.com','lumico.com','insurance.utah.gov','insurance.idaho.gov','tdi.texas.gov'];
export function primaryUrl(value){try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password&&!u.port&&hosts.some(h=>u.hostname===h||u.hostname.endsWith('.'+h))?u.href:null;}catch{return null;}}
export async function readPrimary(url,fetcher=fetch){
 let current=primaryUrl(url);if(!current)throw Error('Unsupported primary source');
 const signal=AbortSignal.timeout(15000);
 for(let hop=0;hop<3;hop++){
  const r=await fetcher(current,{redirect:'manual',signal,cache:'no-store'});
  if(r.status>=300&&r.status<400){const next=r.headers.get('location');await r.body?.cancel();current=next&&primaryUrl(new URL(next,current).href);if(!current)throw Error('Unsupported redirect');continue;}
  if(!r.ok||!r.headers.get('content-type')?.includes('text/html')){await r.body?.cancel();throw Error('Document unavailable or requires another format');}
  const reader=r.body.getReader();let bytes=0;const chunks=[];
  try{for(;;){const {done,value}=await reader.read();if(done)break;bytes+=value.length;if(bytes>1500000){await reader.cancel();throw Error('Document too large');}chunks.push(value);}}finally{reader.releaseLock();}
  const html=Buffer.concat(chunks).toString('utf8'),text=pageText(html);if(text.length<200)throw Error('No readable document');
  return {url:current,text,title:html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]?.slice(0,250)||current,retrievedAt:new Date().toISOString(),method:'Direct primary-source page read',truncated:text.length>=18000};
 }
 throw Error('Too many redirects');
}
export async function verifyPrimarySources(search,{read=readPrimary}={}){
 const selected=search.sources.filter(s=>primaryUrl(s.url)).slice(0,3);
 const documents=await Promise.all(selected.map(async s=>{try{return {...s,...await read(s.url),requestedUrl:s.url,documentStatus:'read'};}catch{return {...s,documentStatus:'unavailable',documentNote:'Could not read the full document. Any retained text is a search excerpt, not a verified document.'};}}));
 const byUrl=new Map(documents.map(d=>[d.requestedUrl||d.url,d]));
 return {...search,sources:search.sources.map(s=>byUrl.get(s.url)||s),documents:documents.map(({text,...d})=>d)};
}
