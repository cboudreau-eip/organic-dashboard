import {blockersFor,blockerLabels} from '../../lib/research/resolution';
import {assignmentText} from '../../lib/research/assignment-display';
export default function AssignmentResolution({assignment}){
 const result=assignment.result,resolution=result?.resolution,blockers=blockersFor(assignment);
 if(!result)return null;
 return <section className="assignment-resolution" aria-label="Research resolution">
 <strong>{resolution?'Research resolution':'Research blockers'}</strong>
 {resolution&&<p>{resolution.blockers.length?`${resolution.blockers.length} unresolved ${resolution.blockers.length===1?'question':'questions'}`:result.readiness==='No change suggested'?'Existing coverage confirmed — no new assignment recommended.':'Evidence checks passed — ready for your decision.'} {resolution.completedAt&&<small>Checked {new Date(resolution.completedAt).toLocaleString()}</small>}</p>}
 {!!blockers.length&&<ul>{blockers.map((b,i)=><li key={i}><strong>{blockerLabels[b.code]||'Needs review'}:</strong> {assignmentText(b.question,result)}</li>)}</ul>}
 {!!resolution?.matchedPages?.length&&<details><summary>Matched MedicareFAQ pages ({resolution.matchedPages.length})</summary><ul>{resolution.matchedPages.map(url=><li key={url}><a href={url} target="_blank" rel="noreferrer">{url}</a></li>)}</ul></details>}
 {resolution&&<details><summary>Resolution history and optional checks</summary><p>The earlier assessment and your decisions remain in validation history. No assignment was accepted automatically.</p>{resolution.changedTopics?.length>0&&<p>{resolution.changedTopics.length} topic decision(s) changed after independent review.</p>}{resolution.previousBlockers?.length>0&&<><strong>Earlier blockers</strong><ul>{resolution.previousBlockers.map((b,i)=><li key={i}>{blockerLabels[b.code]||b.code}: {assignmentText(b.question,result)}</li>)}</ul></>}{resolution.proposal&&<details><summary>First assessment before independent review</summary><ul>{resolution.proposal.findings.map(f=><li key={f.topicKey}><strong>{assignment.topics.find(t=>t.key===f.topicKey)?.title}</strong>: {f.judgement} — {assignmentText(f.task,result)}</li>)}</ul></details>}{resolution.optionalChecks?.length>0&&<><strong>Optional editorial checks — not required blockers</strong><ul>{resolution.optionalChecks.map((c,i)=><li key={i}>{assignmentText(c,result)}</li>)}</ul></>}{resolution.audit&&<p>At most {resolution.audit.pageLimit} page reads and {resolution.audit.searchLimit} searches per assignment. This refreshes page evidence, not imported source metrics.</p>}</details>}
 </section>;
}
