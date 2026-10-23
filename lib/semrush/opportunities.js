/** Filters and page grouping for observed Semrush snapshots. */
export const BANDS=[['all','All positions'],['1-3','Positions 1–3'],['4-10','Positions 4–10'],['11-20','Positions 11–20'],['21-50','Positions 21–50'],['51-100','Positions 51–100'],['unknown','Unavailable / outside 1–100']];
export function tokens(value){return String(value||'').split(/[,;|]+/).map(s=>s.trim()).filter(Boolean);}
export function intents(value){
 const names={i:'informational',n:'navigational',c:'commercial',t:'transactional'};
 return tokens(value).map(v=>names[v.toLowerCase()]||v.toLowerCase());
}
export function inBand(position,band){
 if(band==='all')return true;
 if(band==='unknown')return position==null;
 if(position==null)return false;
 const [min,max]=band.split('-').map(Number);
 return position>=min&&position<=max;
}
export function filterKeywords(rows,{search='',band='all',intent='',tag='',minVolume='',maxVolume='',landing=null}={}){
 const query=search.trim().toLowerCase();
 return rows.filter(r=>{
  if(query&&![r.keyword,r.tags,r.intents,r.landing].join(' ').toLowerCase().includes(query))return false;
  if(!inBand(r.position,band))return false;
  if(intent&&!intents(r.intents).includes(intent))return false;
  if(tag&&!tokens(r.tags).some(t=>t.toLowerCase()===tag.toLowerCase()))return false;
  if(minVolume!==''&&(r.volume==null||r.volume<Number(minVolume)))return false;
  if(maxVolume!==''&&(r.volume==null||r.volume>Number(maxVolume)))return false;
  return landing===null||r.landing===landing;
 });
}
export function groupPages(rows){
 const groups=new Map();
 for(const r of rows){
  const url=r.landing||'';
  if(!groups.has(url))groups.set(url,{url,count:0,top3:0,nearTop:0,pageTwo:0,develop:0,unknown:0,best:null,volume:0,knownVolume:0,commercial:0});
  const g=groups.get(url);g.count++;
  if(r.position!=null)g.best=g.best==null?r.position:Math.min(g.best,r.position);
  if(inBand(r.position,'1-3'))g.top3++;
  if(inBand(r.position,'4-10'))g.nearTop++;
  if(inBand(r.position,'11-20'))g.pageTwo++;
  if(inBand(r.position,'21-50'))g.develop++;
  if(r.position==null)g.unknown++;
  if(r.volume!=null){g.volume+=r.volume;g.knownVolume++;}
  if(intents(r.intents).some(v=>v==='commercial'||v==='transactional'))g.commercial++;
 }
 return [...groups.values()].map(g=>({...g,volume:g.knownVolume?g.volume:null})).sort((a,b)=>(b.nearTop+b.pageTwo)-(a.nearTop+a.pageTwo)||b.count-a.count||a.url.localeCompare(b.url));
}
