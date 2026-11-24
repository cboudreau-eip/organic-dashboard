export function isAnnotationCheck(item){return /internal passage IDs.*visible/i.test(item.question);}
export function benefitEvidenceConcern(item){
 const instruction=item.instruction||'',benefit=instruction.match(/Part [AB] deductible/i)?.[0],plans=[...instruction.matchAll(/\bPlan ([A-N])\b/g)].map(m=>m[0]);
 if(!benefit||!plans.length)return '';
 const official=[...(item.evidence||[]),...(item.reviewEvidence||[])].filter(e=>e.kind==='official');
 for(const plan of plans)if(new RegExp(plan+'[^.!?]{0,80}(?:does not|doesn.t|not cover)[^.!?]{0,80}'+benefit,'i').test(instruction)&&official.some(e=>e.text.includes(`${benefit} | ${plan}: Yes`)))return 'The proposed exclusion contradicts the official table: the named plan covers this benefit. Correct the instruction using the labeled table cell.';
 if(!plans.every(plan=>official.some(e=>e.text.toLowerCase().includes(benefit.toLowerCase())&&e.text.includes(plan))))return 'Plan-benefit coverage is not established by the cited official passages. Retrieve explicit evidence for the named plan and deductible; do not infer coverage from a flattened table or unrelated guidance.';
 return '';
}
// A second model agreeing does not make an incomplete eligibility rule safe.
export function qualificationConcern(instruction){
 if(/\b(?:change|check):\d+\b/i.test(instruction))return 'This conclusion depends on another proposed change. Verify the resulting page after that change is implemented; it is not a completed check yet.';
 if(/no change/i.test(instruction)&&/cost|price|premium|deductible|copay/i.test(instruction))return 'Verify each cost figure, benefit comparison and applicable year against an official source. General ranges or the target page itself do not establish accuracy.';
 if(/pre-existing.condition exclusions/i.test(instruction))return 'Verify the specific pre-existing-condition waiting-period rules and exceptions; do not describe them as blanket exclusions.';
 if(/first(?:[- ]time)?\s+(?:MA|Medicare Advantage)/i.test(instruction)&&/trial|12.month|one year/i.test(instruction)&&!/(?:65|dropped|previous|prior|formerly).*(?:Medigap|supplement)|(?:age|aged|at)\s*65/i.test(instruction))return 'The trial-right instruction omits the age or previous-Medigap-policy conditions. Verify the applicable scenario before adding an eligibility rule.';
 if(/involuntary (?:loss|disenrollment)/i.test(instruction))return 'Specify and verify the qualifying loss scenario; involuntary loss alone is not a sufficiently precise eligibility instruction.';
 if(/common understanding|generalizations.*not.*requiring/i.test(instruction))return 'General wording is not a substitute for verifying cost and benefit claims.';
 return '';
}
export function annotationVerdict(item,target,now){
 const complete=target?.text&&target.text.length<18000,found=complete&&/\b(?:target|related\d+|official\d+)p\d+\b/.test(target.text);
 const status=!complete?'Unresolved':found?'Correction needed':'Supported';
 const evidence=target?[{id:target.id+'inspection',text:found?'Research annotation identifiers were found in the extracted page text.':complete?'No research annotation identifiers were found in the complete extracted main-page text.':'The complete target page could not be inspected.',url:target.url,kind:'target',fetchedAt:now}]:[];
 return {...item,status,instruction:found?'Remove research passage identifiers from the public page.':'Keep research passage identifiers out of public article copy.',reason:complete?'Direct inspection of the retrieved main-page text.':'A complete target-page read is required.',evidence,evidenceIds:[]};
}
export function outstandingItems(payload){
 if(payload.verification)return payload.verification.items.filter(i=>['Unresolved','Partially resolved'].includes(i.status)||benefitEvidenceConcern(i)).map(i=>benefitEvidenceConcern(i)?{...i,remainingQuestion:benefitEvidenceConcern(i)}:i);
 return [...payload.result.changes.flatMap((c,index)=>c.needsVerification?[{id:`change:${index}`,section:c.section,question:c.change,reason:c.why}]:[]),...payload.result.checks.map((question,index)=>({id:`check:${index}`,section:'Publication check',question}))];
}
const text={type:'string',minLength:1,maxLength:1200};
export function verificationSchema(items,pages,review=false){
 const ids=pages.flatMap(p=>p.passages.map(x=>x.id));
 return {type:'object',additionalProperties:false,required:['items'],properties:{items:{type:'array',minItems:items.length,maxItems:items.length,items:{type:'object',additionalProperties:false,required:review?['id','supported','reason','evidenceIds']:['id','status','instruction','reason','evidenceIds','evidenceType','remainingQuestion','group'],properties:{id:{type:'string',enum:items.map(i=>i.id)},reason:text,evidenceIds:{type:'array',maxItems:3,items:{type:'string',...(ids.length?{enum:ids}:{})}},...(review?{supported:{type:'boolean'}}:{status:{type:'string',enum:['Supported','Correction needed','Partially resolved','Unresolved']},instruction:text,evidenceType:{type:'string',enum:['Page observation','Factual rule']},remainingQuestion:{type:'string',maxLength:600},group:{type:'string',minLength:1,maxLength:100}})}}}}};
}
export function verifyVerdicts(output,items,pages,review=false){
 if(!Array.isArray(output?.items)||output.items.length!==items.length)throw Error('Incomplete verification results');
 const seen=new Set(),passages=new Map(pages.flatMap(p=>p.passages.map(e=>[e.id,{...e,url:e.url||p.url,kind:p.kind,fetchedAt:p.fetchedAt}])));
 return output.items.map(v=>{
  const item=items.find(i=>i.id===v.id);if(!item||seen.has(v.id))throw Error('Invalid verification identity');seen.add(v.id);
  for(const k of review?['reason']:['reason','instruction'])if(typeof v[k]!=='string'||!v[k].trim()||v[k].length>1600||/https?:\/\//i.test(v[k]))throw Error('Invalid verification text');
  if(!Array.isArray(v.evidenceIds)||v.evidenceIds.length>12)throw Error('Invalid verification evidence');
  const evidence=[...new Set(v.evidenceIds)].map(id=>{if(!passages.has(id))throw Error('Invented verification source');return passages.get(id);});
  const evidenceType=v.evidenceType||item.evidenceType||'Factual rule';
  const needsOfficial=(review?item.status:v.status)!=='Supported'||evidenceType!=='Page observation';
  const sufficient=evidence.some(e=>e.kind==='official'||!needsOfficial&&e.kind==='target');
  if(!review&&/\b(?:target|related\d+|official\d+)p\d+\b/.test(v.instruction))throw Error('Invalid verification text');
  if(review){if(typeof v.supported!=='boolean')throw Error('Invalid review verdict');return {...v,evidence,supported:v.supported&&sufficient};}
  if(!['Supported','Correction needed','Partially resolved','Unresolved'].includes(v.status))throw Error('Invalid verification status');
  if(v.status==='Partially resolved'&&!v.remainingQuestion?.trim())throw Error('Invalid verification remainder');
  return {...item,...v,evidenceType,evidence,status:sufficient?v.status:'Unresolved'};
 });
}
export async function validatedVerification(generate,items,pages,review=false){
 let stage=review?'verification review':'verification decisions';
 try{
  const output=await generate();
  try{return verifyVerdicts(output,items,pages,review);}catch(error){
   stage+=' format repair';
   const repaired=await generate('The response failed validation: '+error.message+'. Return all item IDs exactly once, concise prose without URLs, and only supplied evidence IDs. Preserve uncertainty and all qualifying conditions.');
   return verifyVerdicts(repaired,items,pages,review);
  }
 }catch(error){error.assessmentStage=stage;throw error;}
}
export function correctedAssessment(parent,verdicts,reviews,pages,attempts,now=new Date().toISOString()){
 const excerpts=list=>list.map(e=>({...e,text:e.text.slice(0,1400),excerptLimited:e.text.length>1400||e.excerptLimited}));
 const resolved=verdicts.map(v=>{const review=reviews.find(r=>r.id===v.id),concern=qualificationConcern(v.instruction)||benefitEvidenceConcern({...v,reviewEvidence:review?.evidence||[]}),passed=v.status!=='Unresolved'&&review?.supported&&!concern;
  return {...v,evidence:excerpts(v.evidence),status:passed?(v.remainingQuestion?.trim()?'Partially resolved':v.status):'Unresolved',remainingQuestion:concern||(passed?v.remainingQuestion:`Not verified: ${v.section}. ${review?.reason||'Independent verification was unavailable.'}`),reviewReason:concern||review?.reason||'Independent verification was unavailable.',reviewEvidence:excerpts((review?.evidence||[]).filter(e=>!v.evidence.some(x=>x.id===e.id))),verifiedAt:now};});
 const previous=parent.payload.verification?.items||[],all=[...previous.filter(i=>!resolved.some(v=>v.id===i.id)),...resolved];
 const byId=new Map(all.map(v=>[v.id,v]));
 const changes=parent.payload.result.changes.map((c,index)=>{
  const key=c.verificationKey||`change:${index}`,v=byId.get(key);if(!v)return c;
  return {...c,verificationKey:key,change:v.status==='Unresolved'?`Unresolved: ${v.remainingQuestion||v.reason}`:v.instruction,why:v.reason,evidence:[...v.evidence,...v.reviewEvidence],needsVerification:v.status==='Unresolved'};
 });
 for(const v of all.filter(i=>i.id.startsWith('check:')&&['Correction needed','Partially resolved'].includes(i.status)))if(!changes.some(c=>c.verificationKey===v.id))changes.push({verificationKey:v.id,section:v.section,change:v.instruction,why:v.reason,evidence:[...v.evidence,...v.reviewEvidence],needsVerification:false});
 const remaining=all.filter(v=>['Unresolved','Partially resolved'].includes(v.status));
 const ready=all.filter(v=>v.status!=='Unresolved');
 const result={...parent.payload.result,summary:`Verification reviewed ${all.length} items: ${ready.length} have supported instructions; ${remaining.length} have unresolved questions. Partial results can appear in both groups. Use only the ready-to-implement instructions.`,changes,outline:changes.filter(c=>!c.needsVerification).map(c=>c.section),checks:remaining.map(v=>v.remainingQuestion||v.reason)};
 // Do not retain the old outline's unverified factual claims in the corrected brief.
 const compact=s=>{const clean=String(s||'').replace(/\s*\([^)]*(?:target|related\d+|official\d+)p\d+[^)]*\)/g,'');return clean.length>650?clean.slice(0,647)+'…':clean;};
 const brief=['## Verified page assessment — implementation instructions',`Target: ${parent.payload.target}`,'',result.summary,'','### Ready to implement',...(ready.length?ready.map(v=>`- ${v.group||v.section}: ${v.instruction}\n  Where: ${v.section}\n  Evidence: ${[...new Set([...v.evidence,...v.reviewEvidence].map(e=>e.url))].join(', ')}`):['No supported instructions yet.']),'','### Unresolved — do not use as claims',...(remaining.length?remaining.map(v=>`- ${v.group||v.section}: ${compact(v.remainingQuestion||v.reason)}\n  Next step: Use Verify outstanding items in the Work queue to research this exact question. Omit this unverified detail until supported.`):['No outstanding research questions in this assessment.']),'','### Preserve','Keep useful structure only. This is not verification of existing factual claims; unresolved cost, eligibility and timing details must be omitted or verified before publication.',...result.preserve.map(x=>'- '+compact(x)),'','### Internal links',...result.links.map(x=>`- ${x.url} — ${compact(x.reason)}`),'','Full questions, source passages and review history are saved in Verification results. Read PDF table rows with their conditions and footnotes. Final editorial review is still required. No article has been written or published.'].join('\n');
 return {...parent.payload,result,brief,generatedAt:now,reviewedAt:now,verification:{version:2,parentAssessmentId:parent.id,checkedAt:now,items:all,attempts},sources:[...parent.payload.sources,...pages.map(({text,passages,documentPages,...p})=>p)],warnings:[...new Set([...parent.payload.warnings,'Verification is an AI-assisted source review, not publication approval.'])]};
}
