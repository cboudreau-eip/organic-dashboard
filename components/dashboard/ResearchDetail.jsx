'use client';
import {useState} from 'react';
import {DECISIONS} from '../../lib/research/contracts';
const n=x=>x==null?'Unavailable':Number(x).toLocaleString('en-US',{maximumFractionDigits:1});
const date=x=>x?new Date(x).toLocaleString():'Unavailable';
export default function ResearchDetail({item,review,runId,canEdit,busy,onSave,onClose}){
 const [decision,setDecision]=useState(review?.decision||'Needs review'),[reason,setReason]=useState(review?.reason||'');
 return <section className="research-detail" aria-label="Opportunity evidence">
 <button onClick={onClose}>Back to review queue</button><h3>{item.title}</h3><p>{item.reason}</p>
 <p><strong>{item.type}</strong> · {item.intent} · {item.product} · {item.confidence} confidence · {item.effort} effort</p>
 <p>{item.nextCheck}</p>
 <h4>Why it ranks here: {item.score===item.scoreMax?item.score:`${item.score}–${item.scoreMax}`} / 100</h4>
 <div className="research-table"><table><thead><tr><th>Factor</th><th>Supported points</th><th>Explanation</th></tr></thead><tbody>{Object.entries(item.components).map(([key,c])=><tr key={key}><th>{key}</th><td>{c.points==null?'Unknown':c.points} / {c.weight}</td><td>{c.reason}</td></tr>)}</tbody></table></div>
 <h4>Related existing pages</h4>{item.relatedPages.length?<ul>{item.relatedPages.map(p=><li key={p.url}><a href={p.url} target="_blank" rel="noreferrer">{p.title||p.url}</a> — {p.status}; {p.direct?'observed search landing page':`${p.match}% wording match in titles/headings`}<p>{p.headings.join(' · ')}</p></li>)}</ul>:<p>No strong match in the inspected inventory. This does not prove a new page is needed.</p>}
 <details open><summary>Observed search terms ({item.terms.length})</summary><p>{item.terms.join(' · ')}</p></details>
 <details><summary>Google Search Console evidence ({item.evidence.gscRows} rows; showing up to 20)</summary><div className="research-table"><table><thead><tr><th>Query / page</th><th>Clicks</th><th>Impressions</th><th>Position</th><th>CTR</th></tr></thead><tbody>{item.evidence.gsc.map((r,i)=><tr key={i}><td>{r.keys[0]}<br/><a href={r.keys[1]} target="_blank" rel="noreferrer">{r.keys[1]}</a></td><td>{n(r.clicks)}</td><td>{n(r.impressions)}</td><td>{n(r.position)}</td><td>{r.ctr==null?'Unavailable':n(r.ctr*100)+'%'}</td></tr>)}</tbody></table></div></details>
 <details><summary>Semrush evidence ({item.evidence.semrush.length} keywords)</summary><div className="research-table"><table><thead><tr><th>Keyword</th><th>Position</th><th>Volume estimate</th><th>Difficulty</th><th>Source intent</th></tr></thead><tbody>{item.evidence.semrush.map((r,i)=><tr key={i}><td>{r.keyword}</td><td>{n(r.position)}</td><td>{n(r.volume)}</td><td>{n(r.difficulty)}</td><td>{r.intents||'Unavailable'}</td></tr>)}</tbody></table></div></details>
 <details><summary>Otterly evidence ({item.evidence.otterly.length} monitored prompts)</summary>{item.evidence.otterly.map((r,i)=><p key={i}>{r.prompt} — mentions: {n(r.mentions)}; citations: {n(r.citations)}</p>)}<p>These counts describe monitored AI answers, not search demand.</p></details>
 <h4>PostHog landing-page context</h4>{item.evidence.posthog?<p>{n(item.evidence.posthog.sessions)} organic sessions · {n(item.evidence.posthog.quoteStarts)} sessions with a quote start. These are page-level counts, not conversions attributed to this keyword. Quote completions are excluded from ranking.</p>:<p>No matched page-level evidence. This is not a zero conversion result.</p>}
 <details><summary>Limitations</summary><ul>{item.limitations.map(s=><li key={s}>{s}</li>)}</ul></details>
 <form className="research-review" onSubmit={e=>{e.preventDefault();onSave({action:'review',runId,key:item.key,version:review?.version||0,decision,reason});}}><h4>Your review</h4>
 {review&&<p>Last saved {date(review.updated_at)}{review.run_id!==runId?' on an earlier run; decision carried forward.':''}</p>}
 <fieldset disabled={!canEdit||busy}><label>Decision<select value={decision} onChange={e=>setDecision(e.target.value)}>{DECISIONS.map(d=><option key={d}>{d}</option>)}</select></label><label>Reason / research needed<textarea maxLength={2000} value={reason} onChange={e=>setReason(e.target.value)} placeholder="Why keep it, defer it, or reject it?"/></label><button type="submit">Save review decision</button></fieldset>
 <p>Keep means retain for planning review. It does not schedule or create content.</p></form>
 </section>;
}
