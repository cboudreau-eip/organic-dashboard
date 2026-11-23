import {assessmentBrief} from './assessment.js';
export function isAnnotationCheck(item){return /internal passage IDs.*visible/i.test(item.question);}
export function annotationVerdict(item,target,now){
 const complete=target?.text&&target.text.length<18000,found=complete&&/\b(?:target|related\d+|official\d+)p\d+\b/.test(target.text);
 const status=!complete?'Unresolved':found?'Correction needed':'Supported';
 const evidence=target?[{id:target.id+'inspection',text:found?'Research annotation identifiers were found in the extracted page text.':complete?'No research annotation identifiers were found in the complete extracted main-page text.':'The complete target page could not be inspected.',url:target.url,kind:'target',fetchedAt:now}]:[];
 return {...item,status,instruction:found?'Remove research passage identifiers from the public page.':'Keep research passage identifiers out of public article copy.',reason:complete?'Direct inspection of the retrieved main-page text.':'A complete target-page read is required.',evidence,evidenceIds:[]};
}
export function outstandingItems(payload){
 if(payload.verification)return payload.verification.items.filter(i=>i.status==='Unresolved');
 return [...payload.result.changes.flatMap((c,index)=>c.needsVerification?[{id:`change:${index}`,section:c.section,question:c.change,reason:c.why}]:[]),...payload.result.checks.map((question,index)=>({id:`check:${index}`,section:'Publication check',question}))];
}
const text={type:'string',minLength:1,maxLength:1200};
export function verificationSchema(items,pages,review=false){
 const ids=pages.flatMap(p=>p.passages.map(x=>x.id));
 return {type:'object',additionalProperties:false,required:['items'],properties:{items:{type:'array',minItems:items.length,maxItems:items.length,items:{type:'object',additionalProperties:false,required:review?['id','supported','reason','evidenceIds']:['id','status','instruction','reason','evidenceIds'],properties:{id:{type:'string',enum:items.map(i=>i.id)},reason:text,evidenceIds:{type:'array',maxItems:8,items:{type:'string',...(ids.length?{enum:ids}:{})}},...(review?{supported:{type:'boolean'}}:{status:{type:'string',enum:['Supported','Correction needed','Unresolved']},instruction:text})}}}}};
}
export function verifyVerdicts(output,items,pages,review=false){
 if(!Array.isArray(output?.items)||output.items.length!==items.length)throw Error('Incomplete verification results');
 const seen=new Set(),passages=new Map(pages.flatMap(p=>p.passages.map(e=>[e.id,{...e,url:p.url,kind:p.kind,fetchedAt:p.fetchedAt}])));
 return output.items.map(v=>{
  const item=items.find(i=>i.id===v.id);if(!item||seen.has(v.id))throw Error('Invalid verification identity');seen.add(v.id);
  for(const k of review?['reason']:['reason','instruction'])if(typeof v[k]!=='string'||!v[k].trim()||v[k].length>1600||/https?:\/\//i.test(v[k]))throw Error('Invalid verification text');
  if(!Array.isArray(v.evidenceIds)||v.evidenceIds.length>12)throw Error('Invalid verification evidence');
  const evidence=[...new Set(v.evidenceIds)].map(id=>{if(!passages.has(id))throw Error('Invented verification source');return passages.get(id);});
  if(review){if(typeof v.supported!=='boolean')throw Error('Invalid review verdict');return {...v,evidence,supported:v.supported&&evidence.some(e=>e.kind==='official')};}
  if(!['Supported','Correction needed','Unresolved'].includes(v.status))throw Error('Invalid verification status');
  return {...item,...v,evidence,status:evidence.some(e=>e.kind==='official')?v.status:'Unresolved'};
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
 const resolved=verdicts.map(v=>{const review=reviews.find(r=>r.id===v.id),passed=v.status!=='Unresolved'&&review?.supported;
  return {...v,status:passed?v.status:'Unresolved',reviewReason:review?.reason||'Independent verification was unavailable.',reviewEvidence:review?.evidence||[],verifiedAt:now};});
 const previous=parent.payload.verification?.items||[],all=[...previous.filter(i=>!resolved.some(v=>v.id===i.id)),...resolved];
 const byId=new Map(all.map(v=>[v.id,v]));
 const changes=parent.payload.result.changes.map((c,index)=>{
  const key=c.verificationKey||`change:${index}`,v=byId.get(key);if(!v)return c;
  return {...c,verificationKey:key,change:v.status==='Unresolved'?`Verify before implementing: ${v.question}`:v.instruction,why:v.reason+' '+v.reviewReason,evidence:[...v.evidence,...v.reviewEvidence],needsVerification:v.status==='Unresolved'};
 });
 for(const v of all.filter(i=>i.id.startsWith('check:')&&i.status==='Correction needed'))if(!changes.some(c=>c.verificationKey===v.id))changes.push({verificationKey:v.id,section:'Verified correction',change:v.instruction,why:v.reason,evidence:[...v.evidence,...v.reviewEvidence],needsVerification:false});
 const remaining=all.filter(v=>v.status==='Unresolved');
 const result={...parent.payload.result,summary:`Verification reviewed ${all.length} items: ${all.filter(v=>v.status==='Supported').length} supported, ${all.filter(v=>v.status==='Correction needed').length} corrected, ${remaining.length} unresolved. Use the corrected instructions below; unresolved items remain checks, not approved claims.`,changes,outline:changes.filter(c=>!c.needsVerification).map(c=>c.section),checks:remaining.map(v=>v.question+' — '+v.reason+' '+v.reviewReason)};
 // Do not retain the old outline's unverified factual claims in the corrected brief.
 const brief=assessmentBrief(result,parent.payload.target)+'\n\n### Verification decisions\n'+all.map(v=>`- ${v.status}: ${v.question}\n  ${v.status==='Unresolved'?'Still unresolved. '+v.reason:v.instruction}\n  Evidence: ${[...new Set([...v.evidence,...v.reviewEvidence].map(e=>e.url))].join(', ')||'No supporting official passage retrieved.'}`).join('\n');
 return {...parent.payload,result,brief,generatedAt:now,reviewedAt:now,verification:{parentAssessmentId:parent.id,checkedAt:now,items:all,attempts},sources:[...parent.payload.sources,...pages.map(({text,passages,...p})=>p)],warnings:[...parent.payload.warnings,'Verification is an AI-assisted source review, not publication approval.']};
}
