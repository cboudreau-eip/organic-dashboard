import {assignmentText} from '../../lib/research/assignment-display';
export default function AssignmentVerification({assignment:a}){
 const verification=a.result?.verification;
 return <section className="assignment-verification"><h4>Second verification pass</h4>
 {!verification?<p>This older assessment has not had the second pass. Run the updated verification before keeping it for planning.</p>:<><p><strong>{verification.status}</strong> · {verification.note||'Verification must complete before planning.'}</p>
 {verification.verdicts.map(v=><article className="assignment-finding" key={v.topicKey}><strong>{a.topics.find(t=>t.key===v.topicKey)?.title}</strong><p>Evidence: {v.support} · Qualifications: {v.qualifications} · Overlap: {v.overlap} · Official confirmation: {v.authority}</p><p>{assignmentText(v.reason,a.result)}</p>{v.url&&<><blockquote>{v.quote}</blockquote><a href={v.url} target="_blank" rel="noreferrer">Open verification source</a></>}</article>)}</>}
 {a.coverage&&<p className="research-help">Compared with up to {a.coverage.inspectedLimit} relevant public pages from {a.coverage.inventoryPages} saved inventory entries. {a.coverage.inventoryComplete?'Inventory processed.':'Inventory incomplete; a missing match does not establish a new-page gap.'}</p>}
 </section>;
}
