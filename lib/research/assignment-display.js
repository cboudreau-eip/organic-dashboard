// Render model source references as readable page names, retaining the linked
// source and exact passage separately in the evidence section.
export function assignmentText(value,result){
 return String(value||'').replace(/\b(own\d+|search\d+)(?:p\d+(?:-p?\d+)?)?\b/gi,(match,id)=>{
  const source=result?.sources?.find(s=>s.id===id.toLowerCase());
  if(!source)return 'the referenced page';
  const title=String(source.title||'the cited page').replace(/\s*\|\s*MedicareFAQ.*$/,'');
  return `“${title}”`;
 });
}
