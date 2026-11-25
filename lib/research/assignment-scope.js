// Read-only scope labels, independent of category, approval and work status.
const result=(key,label,reason)=>({key,label,reason});
export function assignmentScope(item={}) {
 const action=String(item.action||'').trim();
 const newAction=/^(?:create|write|draft|build|publish|plan|propose)\s+(?:(?:a|an|the)\s+)?(?:(?:distinct|new|separate|standalone)\s+)+(?:page|article|piece|guide|resource)\b/i.test(action);
 const refreshAction=/^(?:update|refresh|revise|improve|edit|expand)\b/i.test(action);
 const newScope=newAction||item.type==='New-page proposal'||item.targetDecision?.kind==='New-page proposal';
 const hasTarget=!!String(item.targetUrl||'').trim();
 if(newScope&&(hasTarget||refreshAction))return result('review','Needs review','The saved new-page scope conflicts with the update instructions or target page. Confirm which work is intended.');
 if(newScope)return result('new','New content','The saved scope proposes a separate new page. This is still tentative, not publishing approval.');
 if(hasTarget)return result('refresh','Refresh','This assignment targets an existing page for review or improvement.');
 return result('review','Needs review','No existing target page or clear new-page scope is saved. Confirm whether to create a page or refresh one.');
}
// Manual scope edits take precedence over older decisions. Never write back to data.
export function savedAssignmentScope(item,edit={}) {
 const changed=['action','targetUrl'].some(k=>Object.hasOwn(edit,k)&&edit[k]!==item[k]);
 return assignmentScope({...item,...edit,...(changed?{type:undefined,targetDecision:undefined}:{})});
}
