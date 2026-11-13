import {readPublicPage,safePage,pageText} from '../otterly/content-sources.js';
export const PAGE_LIMIT=2500,MAP_LIMIT=80;
export const pageKey=value=>{const safe=safePage(value);if(!safe)return null;const u=new URL(safe);return 'https://www.medicarefaq.com'+(u.pathname.replace(/\/+$/,'')||'/');};
const decode=s=>s.replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>');
export function sitemapEntries(xml){return [...xml.matchAll(/<loc>\s*([^<]+)\s*<\/loc>/gi)].map(m=>safePage(decode(m[1].trim()))).filter(Boolean);}
export function inventoryEntry(requested,{url,html},now=new Date()){
 const strip=s=>decode(s.replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim());
 const title=strip(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]||'').slice(0,300);
 const main=html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i)?.[1]||html;
 const headings=[...main.matchAll(/<h[1-3]\b[^>]*>([\s\S]*?)<\/h[1-3]>/gi)].map(m=>strip(m[1])).slice(0,60);
 const tags=html.match(/<link\b[^>]*>/gi)||[];
 const canonicalTag=tags.find(t=>/rel=["']canonical["']/i.test(t));
 const canonical=canonicalTag?.match(/href=["']([^"']+)/i)?.[1];
 const text=pageText(html);
 return {url:pageKey(url),requested:pageKey(requested),canonical:canonical?pageKey(new URL(decode(canonical),url).href):null,title,headings,text:text.slice(0,10000),textTruncated:text.length>=10000,links:[...new Set([...main.matchAll(/href=["']([^"']+)/gi)].flatMap(m=>{try{return pageKey(new URL(decode(m[1]),url).href)||[];}catch{return [];}}))].slice(0,100),status:text.length>=200?'read':'unreadable',fetchedAt:now.toISOString()};
}
export async function discoverStep(state,read=readPublicPage){
 const next={...state,maps:[...state.maps],seenMaps:[...state.seenMaps],urls:[...state.urls],errors:[...state.errors]};
 const url=next.maps.shift();if(!url)return next;
 next.seenMaps.push(url);
 try{const result=await read(url);const entries=sitemapEntries(result.html);
  if(/<sitemapindex\b/i.test(result.html))next.maps=[...new Set([...next.maps,...entries.filter(u=>!next.seenMaps.includes(u))])];
  else next.urls=[...new Set([...next.urls,...entries.map(pageKey).filter(Boolean)])];
 }catch{next.errors.push({url,reason:'Sitemap could not be read'});}
 if(next.seenMaps.length>=MAP_LIMIT&&next.maps.length){next.errors.push({reason:'Sitemap discovery limit reached'});next.maps=[];}
 if(next.urls.length>PAGE_LIMIT){next.errors.push({reason:'Inventory exceeds 2,500-page limit; coverage is partial'});next.urls=next.urls.slice(0,PAGE_LIMIT);}
 return next;
}
export async function crawlBatch(urls,read=readPublicPage){
 const result=[];
 for(let at=0;at<urls.length;at+=5){const batch=await Promise.all(urls.slice(at,at+5).map(async url=>{try{return inventoryEntry(url,await read(url));}catch{return {url,requested:url,status:'unavailable',fetchedAt:new Date().toISOString(),title:'',headings:[],text:'',links:[]};}}));result.push(...batch);}
 return result;
}
