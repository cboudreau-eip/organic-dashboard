// Only public MedicareFAQ pages may enter the recommendation context.
export function safePage(value){
 try{const u=new URL(value);if(u.protocol!=='https:'||!['www.medicarefaq.com','medicarefaq.com'].includes(u.hostname)||u.username||u.password||u.port||u.search)return null;u.hash='';return u.href;}catch{return null;}
}
export async function readPublicPage(url,fetcher=fetch){
 let current=safePage(url);if(!current)throw Error('Unsupported page.');
 for(let hop=0;hop<4;hop++){
  const r=await fetcher(current,{redirect:'manual',signal:AbortSignal.timeout(10000),cache:'no-store'});
  if(r.status>=300&&r.status<400){const location=r.headers.get('location');await r.body?.cancel();current=location&&safePage(new URL(location,current).href);if(!current)throw Error('Unsupported redirect.');continue;}
  if(!r.ok||!/(html|xml)/i.test(r.headers.get('content-type')||'')){await r.body?.cancel();throw Error('Page unavailable.');}
  const reader=r.body.getReader();let size=0;const chunks=[];
  try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>1500000){await reader.cancel();throw Error('Page too large.');}chunks.push(value);}}finally{reader.releaseLock();}
  const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
  return {url:current,html:new TextDecoder().decode(bytes)};
 }
 throw Error('Too many redirects.');
}
const locs=xml=>[...xml.matchAll(/<loc>\s*([^<]+)\s*<\/loc>/g)].map(m=>safePage(m[1].trim())).filter(Boolean);
const words=text=>new Set(text.toLowerCase().replace(/supplement(?:al)?/g,'medigap').replace(/part[ -]+d|prescription[ -]+drug(?:s)?|drug(?:s)?/g,'partd').match(/[a-z0-9]+/g)?.filter(w=>!['medicare','www','com','https','faqs','plans','the','and','for','with','what','does','have','need','should','can','how','this','that','from','plan'].includes(w)&&w.length>2)||[]);
export function rankPages(prompt,urls){
 const terms=words(prompt);
 const ranked=[...new Set(urls)].map(url=>{const tokens=words(new URL(url).pathname);return {url,tokens,score:[...tokens].filter(w=>terms.has(w)).length/Math.sqrt(tokens.size||1)};}).filter(x=>x.score>0).sort((a,b)=>b.score-a.score||a.url.length-b.url.length);
 // Include the strongest match for each concept before filling remaining slots.
 const diverse=[...terms].map(term=>ranked.find(p=>p.tokens.has(term))?.url).filter(Boolean);
 return [...new Set([...diverse,...ranked.map(p=>p.url)])].slice(0,6);
}
export function pageText(html){
 const main=html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i)?.[1]||html;
 return main.replace(/<(script|style|nav|footer|header)\b[^>]*>[\s\S]*?<\/\1>/gi,' ').replace(/<[^>]+>/g,' ').replace(/&nbsp;|&#160;/g,' ').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;|&apos;/g,"'").replace(/\s+/g,' ').trim().slice(0,18000);
}
export async function contentSources(prompt,fetcher=fetch){
 const root=await readPublicPage('https://www.medicarefaq.com/sitemap.xml',fetcher);
 const sitemapUrls=locs(root.html).slice(0,12);
 const maps=await Promise.allSettled(sitemapUrls.map(url=>readPublicPage(url,fetcher)));
 const urls=maps.flatMap(r=>r.status==='fulfilled'?locs(r.value.html):[]);
 const candidates=rankPages(prompt,urls);
 const pages=await Promise.allSettled(candidates.map(url=>readPublicPage(url,fetcher)));
 return pages.flatMap((r,i)=>{if(r.status!=='fulfilled')return [];const text=pageText(r.value.html);return text.length<300?[]:[{id:`page${i+1}`,url:r.value.url,text,truncated:text.length===18000}];});
}
