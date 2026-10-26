'use client';
import {formatReportDate,periodParams} from '../../lib/posthog/period';
import CollapsibleSection from './CollapsibleSection';
import { useEffect, useState } from 'react';
import { metricChange } from '../../lib/posthog/overview';
const fmt = n => n.toLocaleString('en-US');
const rate = n => n === null ? '—' : `${n.toFixed(2)}%`;

export default function OrganicConversions({ days, detailed = false }) {
  const requestKey=periodParams(days);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setData(null); setError('');
    (async () => {
      try {
        const response = await fetch(`/api/analytics/conversions?${requestKey}`, { cache: 'no-store', signal: controller.signal });
        const json = await response.json();
        if (!response.ok) throw new Error(json.error || 'Conversions could not be loaded.');
        if (!controller.signal.aborted) setData(json);
      } catch (e) { if (!controller.signal.aborted) setError(e.message); }
    })();
    return () => controller.abort();
  }, [requestKey, retry]);
  const heading = detailed ? 'Organic leads & funnel' : 'Organic conversions';
  if (error) return <section className="organic-conversions"><h3>{heading}</h3><div className="organic-error" role="alert">{error} <button className="button" onClick={() => setRetry(retry + 1)}>Retry conversions</button></div></section>;
  if (!data) return <section className="organic-conversions"><h3>{heading}</h3><p role="status">Loading organic conversion activity…</p></section>;
  const { current: c, previous: p, period } = data;
  const cards = [['contactSessions','Contact submissions','Sessions with a final contact-step event'],['rate','Contact conversion rate','Contact-submission sessions ÷ eligible sessions'],['quoteStarts','Quote starts','Sessions with a ZIP submission after a page view'],['phoneClicks','Phone clicks','Tracked clicks, not confirmed calls or leads']];
  const stages = [['Organic landing sessions',c.sessions],['ZIP submitted after page view',c.quoteStarts],['Contact submitted after ZIP',c.completedFunnel]];
  return <CollapsibleSection className="organic-conversions" title={heading} level={3} header={<h3>{heading}</h3>}>
    
    <p className="organic-detail-note">{formatReportDate(period.start)} – {formatReportDate(period.end)} vs {formatReportDate(period.priorStart)} – {formatReportDate(period.priorEnd)} · {data.timezone}</p>
    {period.warnings?.map(warning=><p className="gsc-date-warning" key={warning}>{warning}</p>)}
    <p>Sessions starting on MedicareFAQ through organic search, including tracked contact steps on the shared quote site.</p>
    <div className="organic-cards conversion-cards overview-kpis">{cards.map(([key,label,note]) => {
      const comparable=c[key]!==null&&p[key]!==null;
      const delta=comparable?c[key]-p[key]:null;
      const direction=delta===null||delta===0?'flat':delta>0?'up':'down';
      const tone=!comparable||delta===0?'neutral':key==='phoneClicks'?'context':delta>0?'positive':'negative';
      return <article className="card overview-kpi" data-tone={tone} key={key}>
        <span className="overview-kpi-label">{label}</span>
        <strong className="overview-kpi-value">{key==='rate'?rate(c[key]):fmt(c[key])}</strong>
        <div className="overview-kpi-change">
          <span className="overview-kpi-badge"><span aria-hidden="true">{direction==='up'?'↗':direction==='down'?'↘':'–'}</span><span>{metricChange({value:c[key],previous:p[key],format:key==='rate'?'percent':'count'})}</span></span>
          {comparable&&<span className="overview-kpi-delta">{key==='rate'?'Change vs. comparison period · pp = percentage points':(delta>0?'+':'')+fmt(delta)+' '+label.toLowerCase()+' vs. prior'}</span>}
        </div>
        <div className="overview-kpi-prior"><span>Comparison period</span><strong>{key==='rate'?rate(p[key]):fmt(p[key])}</strong></div>
        <small>{note}</small>
      </article>;
    })}</div>
    <p className="organic-detail-note">Rate denominator: {fmt(c.sessions)} eligible sessions. Each contact-submission session counts once; {fmt(c.contactEvents)} contact events were recorded. These are tracked submissions, not CRM-verified or unique-person leads.</p>
    {detailed && <CollapsibleSection className="card conversion-funnel" title="Same-session quote journey" level={3} header={<h3>Same-session quote journey</h3>}><p>Ordered steps completed within the selected reporting period.</p>{stages.map(([label,value],i) => <div className="conversion-stage" key={label}><div><span>{label}</span><strong>{fmt(value)}</strong></div><div className="conversion-rail"><span style={{width:`${c.sessions ? value/c.sessions*100 : 0}%`}} /></div>{i>0 && <small>{stages[i-1][1] ? `${rate(value/stages[i-1][1]*100)} progressed from the previous step · ${fmt(stages[i-1][1]-value)} did not reach this step` : 'No previous-step sessions'}</small>}</div>)}<p>{fmt(c.contactSessions-c.completedFunnel)} contact-submission sessions had no observed preceding ZIP step and are excluded from the final funnel stage. Phone clicks occurred in {fmt(c.phoneSessions)} sessions.</p></CollapsibleSection>}
    <CollapsibleSection className="card organic-landing" title="Landing pages producing contact submissions" level={3} header={<h3>Landing pages producing contact submissions</h3>}><p>Up to 100 by contact-submission sessions, then eligible sessions</p><div className="organic-table-scroll"><table><thead><tr><th scope="col">Landing page</th><th scope="col">Eligible sessions</th><th scope="col">Contact submissions</th><th scope="col">Conversion rate</th></tr></thead><tbody>{data.pages.map(row => <tr key={row.page}><td>{row.page}</td><td>{fmt(row.sessions)}</td><td>{fmt(row.contactSessions)}</td><td>{rate(row.rate)}</td></tr>)}</tbody></table></div>{!data.pages.length && <p>No eligible organic sessions in this period.</p>}</CollapsibleSection>
    <details className="organic-definitions"><summary>Conversion definitions and tracking limits</summary><p>Eligible sessions start on www.medicarefaq.com or medicarefaq.com, are classified Organic Search, and have a MedicareFAQ page view. Contact submissions use form_submitted with step_3_contact on demographics.medicarecompared.com. ZIP steps use step_1_zip. Only events on MedicareFAQ, rates.medicarefaq.com, and demographics.medicarecompared.com within the same session and reporting period are considered.</p><p>Repeated contact events in a session count once. We have not verified backend acceptance or matched these events to CRM lead records. New sessions, lost cross-domain identifiers, untracked calls, and completions after the reporting period are not attributed. The landing-session denominator is narrower than the traffic overview, which includes visits reaching MedicareFAQ after starting elsewhere. No additional bot or internal-user exclusion is applied to this conversion cohort.</p><p>This PostHog report does not verify applications or sales. Historical Datorama exports, when available, appear separately in Leads & funnel. Retrieved {new Date(data.fetchedAt).toLocaleString()}; results may be cached for five minutes plus source caching.</p></details>
  </CollapsibleSection>;
}
