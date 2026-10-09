'use client';
import { useEffect, useState } from 'react';
import { metricChange } from '../../lib/posthog/overview';
const fmt = n => n.toLocaleString('en-US');
const rate = n => n === null ? '—' : `${n.toFixed(2)}%`;

export default function OrganicConversions({ days, detailed = false }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setData(null); setError('');
    (async () => {
      try {
        const response = await fetch(`/api/analytics/conversions?days=${days}`, { cache: 'no-store', signal: controller.signal });
        const json = await response.json();
        if (!response.ok) throw new Error(json.error || 'Conversions could not be loaded.');
        if (!controller.signal.aborted) setData(json);
      } catch (e) { if (!controller.signal.aborted) setError(e.message); }
    })();
    return () => controller.abort();
  }, [days, retry]);
  const heading = detailed ? 'Organic leads & funnel' : 'Organic conversions';
  if (error) return <section className="organic-conversions"><h3>{heading}</h3><div className="organic-error" role="alert">{error} <button className="button" onClick={() => setRetry(retry + 1)}>Retry conversions</button></div></section>;
  if (!data) return <section className="organic-conversions"><h3>{heading}</h3><p role="status">Loading organic conversion activity…</p></section>;
  const { current: c, previous: p, period } = data;
  const cards = [['contactSessions','Contact submissions','Sessions with a final contact-step event'],['rate','Contact conversion rate','Contact-submission sessions ÷ eligible sessions'],['quoteStarts','Quote starts','Sessions with a ZIP submission after a page view'],['phoneClicks','Phone clicks','Tracked clicks, not confirmed calls or leads']];
  const stages = [['Organic landing sessions',c.sessions],['ZIP submitted after page view',c.quoteStarts],['Contact submitted after ZIP',c.completedFunnel]];
  return <section className="organic-conversions">
    <h3>{heading}</h3>
    <p className="organic-detail-note">{period.start} – {period.end} vs {period.priorStart} – {period.priorEnd} · {data.timezone}</p>
    <p>Sessions starting on MedicareFAQ through organic search, including tracked contact steps on the shared quote site.</p>
    <div className="organic-cards conversion-cards">{cards.map(([key,label,note]) => <article className="card" key={key}><span>{label}</span><strong>{key === 'rate' ? rate(c[key]) : fmt(c[key])}</strong><span className="organic-change">{metricChange({value:c[key],previous:p[key],format:key === 'rate' ? 'percent' : 'count'})}</span><small>vs. {key === 'rate' ? rate(p[key]) : fmt(p[key])} prior</small><small>{note}</small></article>)}</div>
    <p className="organic-detail-note">Rate denominator: {fmt(c.sessions)} eligible sessions. Each contact-submission session counts once; {fmt(c.contactEvents)} contact events were recorded. These are tracked submissions, not CRM-verified or unique-person leads.</p>
    {detailed && <section className="card conversion-funnel"><h3>Same-session quote journey</h3><p>Ordered steps completed within the selected reporting period.</p>{stages.map(([label,value],i) => <div className="conversion-stage" key={label}><div><span>{label}</span><strong>{fmt(value)}</strong></div><div className="conversion-rail"><span style={{width:`${c.sessions ? value/c.sessions*100 : 0}%`}} /></div>{i>0 && <small>{stages[i-1][1] ? `${rate(value/stages[i-1][1]*100)} progressed from the previous step · ${fmt(stages[i-1][1]-value)} did not reach this step` : 'No previous-step sessions'}</small>}</div>)}<p>{fmt(c.contactSessions-c.completedFunnel)} contact-submission sessions had no observed preceding ZIP step and are excluded from the final funnel stage. Phone clicks occurred in {fmt(c.phoneSessions)} sessions.</p></section>}
    <section className="card organic-landing"><h3>Landing pages producing contact submissions</h3><p>Top 10 by contact-submission sessions, then eligible sessions</p><div className="organic-table-scroll"><table><thead><tr><th scope="col">Landing page</th><th scope="col">Eligible sessions</th><th scope="col">Contact submissions</th><th scope="col">Conversion rate</th></tr></thead><tbody>{data.pages.map(row => <tr key={row.page}><td>{row.page}</td><td>{fmt(row.sessions)}</td><td>{fmt(row.contactSessions)}</td><td>{rate(row.rate)}</td></tr>)}</tbody></table></div>{!data.pages.length && <p>No eligible organic sessions in this period.</p>}</section>
    <details className="organic-definitions"><summary>Conversion definitions and tracking limits</summary><p>Eligible sessions start on www.medicarefaq.com or medicarefaq.com, are classified Organic Search, and have a MedicareFAQ page view. Contact submissions use form_submitted with step_3_contact on demographics.medicarecompared.com. ZIP steps use step_1_zip. Only events on MedicareFAQ, rates.medicarefaq.com, and demographics.medicarecompared.com within the same session and reporting period are considered.</p><p>Repeated contact events in a session count once. We have not verified backend acceptance or matched these events to CRM lead records. New sessions, lost cross-domain identifiers, untracked calls, and completions after the reporting period are not attributed. The landing-session denominator is narrower than the traffic overview, which includes visits reaching MedicareFAQ after starting elsewhere. No additional bot or internal-user exclusion is applied to this conversion cohort.</p><p>Applications and sales are not connected. Ask Charlie still uses sample data. Retrieved {new Date(data.fetchedAt).toLocaleString()}; results may be cached for five minutes plus source caching.</p></details>
  </section>;
}
