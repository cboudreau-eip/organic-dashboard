'use client';
import {ENGINES,promptFinding,promptOpportunities,REPORT_URL} from '../../lib/otterly/report';
const count=value=>value==null?'Unavailable':value.toLocaleString();
const labels={missing:'No mentions or citations recorded',cited:'Cited, but not named',mentioned:'Brand mentioned',incomplete:'Incomplete evidence'};
export default function PromptOpportunities({report}){
 const opportunities=promptOpportunities(report.prompts);
 const missing=opportunities.filter(p=>p.finding==='missing').length;
 const cited=opportunities.filter(p=>p.finding==='cited').length;
 const sourceUrl=`${REPORT_URL}?country=us&startDate=${report.period.start}&endDate=${report.period.end}`;
 return <section aria-labelledby="prompt-opportunities-heading">
  <h3 id="prompt-opportunities-heading">Prompts to investigate</h3>
  <p><strong>{missing} with no mentions or citations recorded · {cited} cited but not named</strong></p>
  <p>These monitored questions have no MedicareFAQ brand mentions and either competitor mentions or MedicareFAQ citations. Questions with neither mentions nor citations appear first, followed by cited-but-not-named questions; within each group, higher competitor mention counts appear first. This is a review order, not an estimate of business impact.</p>
  <p>Counts use this report’s dates and United States scope. A zero describes the monitored answers only, not every answer on the platform. Prompt citations count references to MedicareFAQ as a source.</p>
  {!report.promptPlatforms&&<p>Platform detail was not saved with this report. Overall prompt evidence is still shown below.</p>}
  {report.promptPlatformsFetchedAt&&<p className="organic-freshness">Platform detail retrieved {new Date(report.promptPlatformsFetchedAt).toLocaleString()}. Overall counts retain the saved report’s original sync time.</p>}
  {opportunities.map(p=><article className="card" key={p.id}>
   <h4>{p.prompt}</h4><p><strong>{labels[p.finding]}</strong></p>
   <p>MedicareFAQ mentions: <strong>{count(p.mentions)}</strong> · MedicareFAQ citations: <strong>{count(p.domainMentions)}</strong></p>
   <p>Competitors mentioned: {p.competitors.length?p.competitors.map(c=>`${c.brand} (${count(c.mentions)})`).join(', '):'None recorded'}</p>
   <p>{p.finding==='missing'?'Review the competitor answers and their sources to identify what MedicareFAQ is missing.':p.finding==='cited'?'Review the cited content and answer wording to understand why MedicareFAQ is used as a source without being named.':'Verify the missing measurement before treating this as a visibility gap.'} These are suggested investigation steps, not proven causes or guaranteed fixes.</p>
   <details className="organic-definitions"><summary>View platform evidence</summary><div className="ai-table-wrap"><table><thead><tr><th>Platform</th><th>MedicareFAQ mentions</th><th>MedicareFAQ citations</th><th>Competitors mentioned</th><th>Finding</th></tr></thead><tbody>{Object.entries(ENGINES).map(([id,label])=>{
    const row=report.promptPlatforms?.find(e=>e.id===id)?.prompts?.find(r=>r.id===p.id);
    return <tr key={id}><td>{label}</td><td>{count(row?.mentions)}</td><td>{count(row?.domainMentions)}</td><td>{row?row.competitors.map(c=>`${c.brand} (${count(c.mentions)})`).join(', ')||'None recorded':'Unavailable'}</td><td>{row?labels[promptFinding(row)]:'Unavailable'}</td></tr>;
   })}</tbody></table></div><p>Unavailable means platform detail was not returned or saved, or the platform had no monitored prompts. It is not zero. Platform detail fetched later may differ from the original report if Otterly revises its data.</p></details>
   <a href={sourceUrl} target="_blank" rel="noreferrer">Review answers in Otterly</a>
  </article>)}
  {!opportunities.length&&<p>No supported prompt opportunities were returned for this period.</p>}
 </section>;
}
