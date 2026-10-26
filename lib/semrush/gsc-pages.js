// Conservative URL matching: never assume redirects, canonical URLs or tracking parameters.
export function pageKey(value) {
 try {
  const url=new URL(value);
  if(!['https:','http:'].includes(url.protocol)||url.username||url.password)return null;
  if(!['www.medicarefaq.com','medicarefaq.com'].includes(url.hostname))return null;
  url.hash='';
  return url.href;
 } catch {return null;}
}
export function pageIndex(rows=[]) {
 const index=new Map();
 for(const row of rows){
  const key=pageKey(row.key);
  if(!key)continue;
  // Multiple source URLs with the same key need review, not guessed aggregation.
  index.set(key,index.has(key)?null:row);
 }
 return index;
}
export function joinPages(groups,rows) {
 const index=pageIndex(rows);
 return groups.map(group=>{
  const key=pageKey(group.url);
  return {...group,gsc:key?index.get(key)??null:null,ambiguous:!!key&&index.has(key)&&index.get(key)===null};
 });
}
export function pageFinding(group) {
 const data=group.gsc;
 if(group.ambiguous)return {type:'unmatched',label:'URL match needs review',action:'Multiple GSC URLs share this match. Inspect the source URLs before comparing.'};
 if(!data?.current)return {type:'unmatched',label:'Current GSC row not reported',action:'Check the exact URL in Search Console. Missing rows do not establish zero traffic.'};
 if(data.clicksChange<0)return {type:'decline',label:'Losing search clicks',action:'Review query losses, ranking changes and seasonality before changing this page.'};
 if(group.pageTwo>0)return {type:'near',label:'Keywords close to top 10',action:'Review the positions 11–20 keywords, search intent and relevant internal links.'};
 if(data.current.impressions>=1000&&data.current.ctr!=null&&data.current.ctr<0.01&&data.current.position!=null&&data.current.position<=10)return {type:'ctr',label:'Investigate CTR',action:'Review query mix and search results, then assess the title and description. This rule is a screening signal, not a CTR benchmark.'};
 return {type:'monitor',label:'Monitor performance',action:'Review the tracked keywords alongside page traffic before choosing an update.'};
}
