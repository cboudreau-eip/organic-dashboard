// Presentation is derived from immutable evidence. User edits are applied afterwards.
export function assignmentTitle(value) {
 const text=String(value||'').trim().replace(/\s+/g,' ')
  .replace(/\bmedicarefaq\b/gi,'MedicareFAQ').replace(/\bmedicare\b/gi,'Medicare')
  .replace(/\bmedigap\b/gi,'Medigap').replace(/\bpart ([abcd])\b/gi,(_,x)=>`Part ${x.toUpperCase()}`)
  .replace(/\bplan ([a-n])\b/gi,(_,x)=>`Plan ${x.toUpperCase()}`)
  .replace(/\birmaa\b/gi,'IRMAA').replace(/\bmapd\b/gi,'MA-PD').replace(/\broth\b/gi,'Roth').replace(/\bi\b/g,'I');
 if(!text)return text;
 const title=text[0].toUpperCase()+text.slice(1);
 if(/^(how|what|why|when|where|who|which|can|does|do|is|are|should|will)\b/i.test(title))return title.replace(/[?.!]+$/,'')+'?';
 if(/\b(?:vs\.?|versus)\b/i.test(title))return `${title.replace(/\bvs\.?\s/gi,'vs. ')}: comparison review`;
 if(/\b(?:best|top rated|best rated)\b/i.test(title))return `Compare options for “${text}”`;
 if(/^(compare|choosing|switching|a beginner|questions|common terms)\b/i.test(title))return title;
 return `${title}: ${/\b(cost|costs|price|prices|premium|premiums)\b/i.test(text)?'cost questions to address':'topic review'}`;
}

export function assignmentPresentation(item) {
 const evidence=item.evidence||{},gsc=evidence.gsc||[],semrush=evidence.semrush||[],otterly=evidence.otterly||[];
 const reasons={
  'High intent':'Prioritized in the commercial pool to investigate a plan-selection, cost, comparison or enrollment decision.',
  'Long-tail':'Prioritized for a specific, longer search question that can guide a focused answer or page improvement.',
  'AI citations':'Prioritized to investigate whether MedicareFAQ can better answer a monitored AI question and support it with useful sources.',
  Evergreen:'Reserved for durable explanatory coverage that can support readers and related plan-selection pages.'
 };
 const facts=[];
 if(item.repairBasis)facts.push('Calendar repair evidence: '+item.repairBasis.sources.join(', ')+' for “'+item.repairBasis.term+'”. Live page content supports the assigned target; verify the specific improvement before writing.');
 if(gsc.length)facts.push(`Saved GSC evidence includes ${gsc.length} query/page ${gsc.length===1?'row':'rows'} for this topic. These are examples, not summed demand.`);
 if(semrush.length)facts.push(`Saved Semrush evidence includes ${semrush.length} keyword ${semrush.length===1?'record':'records'}. Volume is an estimate, not measured visits.`);
 if(otterly.length){
  const known=otterly.filter(x=>Number.isFinite(x.citations)),zero=known.filter(x=>x.citations===0).length;
  facts.push(`Saved Otterly evidence includes ${otterly.length} monitored ${otterly.length===1?'prompt':'prompts'}${zero?`; ${zero} recorded zero MedicareFAQ citations`:''}${known.length<otterly.length?'; some citation counts are unavailable':''}. This does not establish why a page was not cited.`);
 }
 if(item.revision)for(const r of item.revision.rows)facts.push(`Revision evidence: “${r.term}” — ${r.account==='MFAQ'?'MedicareFAQ only':'Combined MedicareCompared + MedicareFAQ'}; ${r.clicks} clicks, ${r.leads} attributed leads and ${r.sales} attributed sales (${item.revision.period.start}–${item.revision.period.end}). Historical paid attribution is directional, not organic demand or Salesforce counts.`);
 if(!facts.length)facts.push('No measured keyword or monitored-prompt evidence is attached. This is a research proposal, not a verified content gap.');
 return {title:item.editorialTitle?item.title:assignmentTitle(item.title),originalTitle:item.title,whyAssignment:{summary:item.repairBasis?.reason||item.revision?.reason||reasons[item.category]||'Proposed for further research.',facts,sourceScope:'Based on the saved assignment and source dates. Recheck relevance if you change its scope.'}};
}
