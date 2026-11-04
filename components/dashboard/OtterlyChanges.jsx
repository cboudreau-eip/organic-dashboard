import {REPORT_URL} from '../../lib/otterly/report';
import './otterly-changes.css';
const number=n=>n.toLocaleString();
function Metric({value}){
 if(!value)return <span className="otterly-change-muted">Unavailable</span>;
 return <><span>{number(value.before)} → {number(value.after)}</span><strong className={value.delta>0?'otterly-change-up':value.delta<0?'otterly-change-down':'otterly-change-muted'}>{value.delta>0?'+':''}{number(value.delta)}</strong></>;
}
const source=period=>`${REPORT_URL}?country=us&startDate=${period.start}&endDate=${period.end}`;
export default function OtterlyChanges({comparison}){
 return <section className="otterly-changes" aria-labelledby="otterly-changes-title">
  <header><span className="organic-badge">SAVED REPORT COMPARISON</span><h3 id="otterly-changes-title">Since your last report</h3></header>
  {!comparison?.available?<p>{comparison?.reason||'Comparison unavailable. Try loading this report again.'}</p>:<>
   <p className="otterly-change-dates"><strong>{comparison.current.start} – {comparison.current.end}</strong> compared with {comparison.previous.start} – {comparison.previous.end}</p>
   <p>Changes in counts for the same question on the same platform. {comparison.overlap?'These rolling periods overlap; changes are not new activity since the last sync.':'Counts reflect the full reporting periods.'} They do not establish that a content edit caused a change.</p>
   <div className="otterly-change-summary">{[['mentions','Mentions'],['domainMentions','Citations']].map(([key,label])=><div key={key}><h4>{label}</h4><span><strong className="otterly-change-up">{comparison.totals[key].up}</strong> increased</span><span><strong className="otterly-change-down">{comparison.totals[key].down}</strong> decreased</span><small>{comparison.totals[key].unchanged} unchanged · counts of prompt/platform pairs</small></div>)}</div>
   {comparison.rows.length?<details className="otterly-change-details" open><summary>View changed prompt/platform pairs ({comparison.rows.length})</summary><div className="ai-table-wrap"><table><thead><tr><th>Question / platform</th><th>Mentions · prior → current</th><th>Citations · prior → current</th></tr></thead><tbody>{comparison.rows.map(row=><tr key={row.engine+':'+row.id}><td><strong>{row.prompt}</strong><small>{row.label}</small></td><td><Metric value={row.changes.mentions}/></td><td><Metric value={row.changes.domainMentions}/></td></tr>)}</tbody></table></div></details>:<p>No count changes in the comparable measurements.</p>}
   <details className="otterly-change-details"><summary>Comparison coverage and source evidence</summary><p>{comparison.matched} matched prompt/platform pairs had at least one comparable metric. {comparison.excluded} available pairs were excluded because prompts changed or measurements were missing. Platforms absent from both reports cannot be assessed. Each metric is compared only when both reports contain a numeric value; unavailable is not zero.</p><p>Platform evidence retrieved: current {new Date(comparison.currentFetchedAt).toLocaleString()}; prior {new Date(comparison.previousFetchedAt).toLocaleString()}. Source revisions can affect these counts. Rows are ordered by the largest count change, not business impact.</p><p><a href={source(comparison.current)} target="_blank" rel="noreferrer">Review current answers in Otterly ↗</a> · <a href={source(comparison.previous)} target="_blank" rel="noreferrer">Review prior answers in Otterly ↗</a></p><p>Use the question and platform shown above to find the corresponding answers and sources. Otterly may revise historical results after these snapshots were saved.</p></details>
  </>}
 </section>;
}

