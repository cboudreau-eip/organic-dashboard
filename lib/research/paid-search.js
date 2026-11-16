import {groupingKey,normalizedTopic,tokens,entities,intentFor} from './topics.js';
export const paidScope=a=>a==='MFAQ'?'MedicareFAQ only':a==='MC+MFAQ'?'Combined MedicareCompared + MedicareFAQ':'MedicareCompared only';
const key=t=>groupingKey(t);
function prepared(row){const term=row.term.replace(/united healthcare/g,'unitedhealthcare');const normalized=normalizedTopic(term);return {...row,key:key(term),tokens:tokens(normalized),entities:entities(term)};}
function related(a,b){
 if(a.tokens.length<3||b.tokens.length<4)return false;
 // Never cross plan letters, drug parts, states, carriers or explicit years.
 for(const k of ['plans','parts','states','carriers'])if([...a.entities[k]].sort().join('|')!==[...b.entities[k]].sort().join('|'))return false;
 const years=t=>(t.match(/\b20\d{2}\b/g)||[]).sort().join('|');if(years(a.term)!==years(b.term))return false;
 if(/\b(from|to)\b/.test(a.term+' '+b.term)&&/switch|chang/.test(a.term+' '+b.term))return false;
 const intersection=a.tokens.filter(t=>b.tokens.includes(t)).length;
 return intersection===a.tokens.length&&a.tokens.length/b.tokens.length>=.65;
}
export function enrichPaidPlan(plan,snapshot){
 if(!plan||!snapshot?.payload)return plan;
 const source=snapshot.payload,rows=source.rows.filter(r=>r.account!=='MC'&&!r.qualityIssue).map(prepared),used=new Set();
 const index=new Map();for(const r of rows){if(!index.has(r.key))index.set(r.key,[]);index.get(r.key).push(r);}
 const items=plan.payload.items.map(item=>{
  // Explicitly edited scopes are matched to the edited title, not old keywords.
  const changed=item.titleEdited??item.edited;
  const primary=prepared({term:changed?item.title:item.originalTitle||item.title});
  const scopes=(changed?[item.title]:item.terms?.length?item.terms:[item.originalTitle||item.title]).map(term=>prepared({term})).filter(q=>['plans','parts','states','carriers'].every(k=>q.entities[k].join('|')===primary.entities[k].join('|')));
  const matches=new Map();for(const q of scopes){for(const r of index.get(q.key)||[])matches.set(r.term,{...r,match:'Equivalent query'});}
  if(!changed)for(const r of rows)if(!matches.has(r.term)&&scopes.some(q=>related(q,r)))matches.set(r.term,{...r,match:'Related long-tail query'});
  const all=[...matches.values()].sort((a,b)=>b.sales-a.sales||b.leads-a.leads),selected=all.slice(0,8).map(({key,tokens,entities,...r})=>r);
  all.forEach(r=>used.add(r.term));
  const strength=all.reduce((best,r)=>Math.max(best,(r.clicks>=20?1:0)*(r.match==='Equivalent query'?1:.5)*(r.account==='MFAQ'?1:.5)*(Math.log1p(r.leads)+2*Math.log1p(r.sales))),0);
  const facts=selected.map(r=>`Paid search: “${r.term}” — ${paidScope(r.account)}; ${r.clicks.toLocaleString('en-US')} clicks, ${r.leads.toLocaleString('en-US')} attributed leads, ${r.sales.toLocaleString('en-US')} attributed sales. ${r.match}; ${source.period.start}–${source.period.end}.`);
  const focus=selected.length?`Investigate how the existing assignment addresses these paid-search queries: ${selected.slice(0,3).map(r=>'“'+r.term+'”').join('; ')}. Confirm organic relevance and page overlap before implementation.`:null;
  return {...item,paidSearch:{matches:selected,matchCount:all.length,reviewScore:Math.round(strength*(intentFor(item.originalTitle||item.title).value>=4?1:.35)*100)/100,focus,period:source.period,methodology:source.methodology},whyAssignment:{...item.whyAssignment,facts:[...(item.whyAssignment?.facts||[]),...facts]}};
 });
 const opportunities=rows.filter(r=>!used.has(r.term)&&r.sales>0&&r.clicks>=20&&!/Brand/i.test(r.category||'')&&!/\b20(?:0\d|1\d|2[0-6])\b/.test(r.term)&&intentFor(r.term,[],2027).value>=4&&!/compare medicare com|medicarefaq|medicarecompared/.test(r.term)).sort((a,b)=>b.sales-a.sales||b.leads-a.leads);
 const seen=new Set(),additional=[];for(const r of opportunities){if(seen.has(r.key))continue;seen.add(r.key);additional.push({term:r.term,account:r.account,leads:r.leads,sales:r.sales,clicks:r.clicks});if(additional.length===10)break;}
 return {...plan,payload:{...plan.payload,items,sourceDates:{...plan.payload.sourceDates,paidSearch:{period:source.period,status:'Paid search; mixed account scope; partial query coverage'}}},paidSearch:{id:snapshot.id,filename:source.filename,period:source.period,terms:source.rows.length,excludedMC:source.rows.filter(r=>r.account==='MC').length,qualityExcluded:source.rows.filter(r=>r.qualityIssue).length,matchedAssignments:items.filter(i=>i.paidSearch.matches.length).length,additional,methodology:source.methodology}};
}
export async function latestPaidSource(client){const r=await client.from('paid_search_research').select('id,payload').order('created_at',{ascending:false}).limit(1).maybeSingle();if(r.error)throw Error('Paid-search evidence could not be loaded. Retry to avoid exporting incomplete evidence.');return r.data;}
