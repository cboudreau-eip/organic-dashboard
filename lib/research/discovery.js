// Review readiness is deliberately independent of implementation readiness.
export const isLongTail=term=>String(term).trim().split(/\s+/).length>=5;
export function discoveryQueue(items,previous=[]){
 const seen=new Set(previous);
 const rows=items.map(item=>{
  const longTail=item.terms.some(isLongTail),known=[item.key,...(item.previousKeys||[])].some(k=>seen.has(k));
  const sources=['gsc','semrush','otterly'].filter(s=>item.evidence[s]?.length);
  return {...item,discovery:{longTail,previouslyEvaluated:known,sources,stage:'Opportunity review',implementationReady:false,
   reason:known?'Previously evaluated; inspect new evidence before reopening.':'Not evaluated in the previous assignment snapshot.',
   nextStep:item.targetUrl?'Confirm the buying question and inspect the matched page for a specific improvement.':'Verify page coverage and search-result intent before deciding whether a new page is needed.'}};
 });
 // Keep supported business priority dominant; use specificity to break close scores.
 rows.sort((a,b)=>(b.score+(b.discovery.longTail?5:0))-(a.score+(a.discovery.longTail?5:0))||a.title.localeCompare(b.title));
 const fresh=rows.filter(x=>!x.discovery.previouslyEvaluated), selected=[],targets=new Map();
 for(const x of fresh){const key=x.targetUrl||x.key;if((targets.get(key)||0)>=2)continue;selected.push(x.key);targets.set(key,(targets.get(key)||0)+1);if(selected.length===20)break;}
 return {items:rows,shortlist:selected,counts:{fresh:fresh.length,previouslyEvaluated:rows.length-fresh.length,longTail:fresh.filter(x=>x.discovery.longTail).length},method:'Review shortlist: supported priority plus 5 points for observed phrases of five or more words; at most two questions per matched page. No minimum search volume. Previously evaluated topics remain visible outside the fresh shortlist. This is a research priority, not proof of a content gap.'};
}
