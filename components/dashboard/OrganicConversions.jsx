'use client';
import MetricHelp from './MetricHelp';
import {METRIC_HELP} from '../../lib/metric-definitions';
import {formatReportDate,periodParams} from '../../lib/posthog/period';
import CollapsibleSection from './CollapsibleSection';
import { useEffect, useState } from 'react';
import { metricChange } from '../../lib/posthog/overview';
import {quoteJourney} from '../../lib/posthog/quote-journey';
const fmt = n => n == null ? 'Unavailable' : n.toLocaleString('en-US');
const rate = n => n == null ? 'Unavailable' : `${n.toFixed(2)}%`;

export default function OrganicConversions({ days, detailed = false }) {
  const requestKey=periodParams(days);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const [loadedKey,setLoadedKey]=useState('');
  useEffect(() => {
    const controller = new AbortController();
    let timer,polls=0;
    setError('');
    const load=async(first=false) => {
      try {
        const response = await fetch(`/api/analytics/conversions?${requestKey}${first&&retry?'&retry=1':''}`, { cache: 'no-store', signal: controller.signal });
        let json;try{json=await response.json();}catch{throw new Error('The conversion report did not finish loading. Please retry; no zero totals have been assumed.');}
        if (!response.ok) throw new Error(json.error || 'Conversions could not be loaded.');
        if (!controller.signal.aborted) {
          setData(json);setLoadedKey(requestKey);
          if(json.refreshing){
            if(++polls<60)timer=setTimeout(()=>load(),5000);
            else setError('This refresh is taking longer than expected. Your saved results remain available. Retry to check progress.');
          }
        }
      } catch (e) { if (!controller.signal.aborted) setError(e.message); }
    };
    load(true);
    return () => {controller.abort();clearTimeout(timer);};
  }, [requestKey, retry]);
  const heading = detailed ? 'Organic leads & funnel' : 'Organic conversions';
  if (error&&(!data||loadedKey!==requestKey)) return <section className="organic-conversions"><h3>{heading}</h3><div className="organic-error" role="alert">{error} <button className="button" onClick={() => setRetry(retry + 1)}>Retry conversions</button></div></section>;
  if (!data||loadedKey!==requestKey) return <section className="organic-conversions"><h3>{heading}</h3><p role="status">Loading organic conversion activity…</p></section>;
  const { current, previous, period } = data;
  const c=current||{},p=previous||{};
  const journey=quoteJourney(current),priorJourney=quoteJourney(previous);
  const cards = [['contactSessions','Contact submissions','Sessions with a final contact-step event'],['rate','Contact conversion rate','Contact-submission sessions ÷ eligible sessions'],['quoteStarts','Quote starts','Sessions with a ZIP submission after a page view'],['phoneClicks','Phone clicks','Tracked clicks, not confirmed calls or leads']];
  const stages = [['Organic landing sessions',c.sessions],['ZIP submitted after page view',c.quoteStarts],['Contact submitted after ZIP',c.completedFunnel]];
  return <CollapsibleSection className="organic-conversions" title={heading} level={3} header={<h3>{heading}</h3>}>
    
    <p className="organic-detail-note">{formatReportDate(period.start)} – {formatReportDate(period.end)} vs {formatReportDate(period.priorStart)} – {formatReportDate(period.priorEnd)} · {data.timezone}</p>
    {period.warnings?.map(warning=><p className="gsc-date-warning" key={warning}>{warning}</p>)}
    <p>Sessions starting on MedicareFAQ through organic search, including tracked contact steps on the shared quote site.</p>
    {data.fetchedAt&&<p className="organic-detail-note">Last successful {data.hasSavedReport?'report':'sections'} retrieval: {new Date(data.fetchedAt).toLocaleString()}{data.stale?' · Saved results for the dates shown above.':''}</p>}
    {data.refreshing&&!error&&<p role="status">{data.hasSavedReport?'Refreshing in the background. Your last complete report stays visible until the new report is ready.':'Preparing your report in the background. Sections appear as they finish; this page checks progress automatically.'}</p>}
    {(error||data.refreshFailed)&&<p className="organic-error" role="alert">{error||'The refresh could not finish. Any saved results shown retain their original retrieval time.'} <button type="button" className="button" onClick={()=>setRetry(value=>value+1)}>Retry conversions</button></p>}
    {data.status==='partial'&&!data.refreshing&&<p className="organic-error" role="status">Part of this report could not be loaded: {(data.unavailable||[]).map(key=>({current:'selected-period totals',previous:'comparison-period totals',pages:'landing-page breakdown'}[key])).join(', ')}. Available results remain visible. Missing values are not zero. <button type="button" className="button" onClick={()=>setRetry(value=>value+1)}>Retry unavailable data</button></p>}
    <div className="organic-cards conversion-cards overview-kpis">{cards.map(([key,label,note]) => {
      const comparable=c[key]!=null&&p[key]!=null;
      const delta=comparable?c[key]-p[key]:null;
      const direction=delta===null||delta===0?'flat':delta>0?'up':'down';
      const tone=!comparable||delta===0?'neutral':key==='phoneClicks'?'context':delta>0?'positive':'negative';
      return <article className="card overview-kpi" data-tone={tone} key={key}>
        <span className="overview-kpi-label">{label}<MetricHelp label={label} definition={METRIC_HELP[key]} /></span>
        <strong className="overview-kpi-value">{key==='rate'?rate(c[key]):fmt(c[key])}</strong>
        <div className="overview-kpi-change">
          <span className="overview-kpi-badge"><span aria-hidden="true">{direction==='up'?'↗':direction==='down'?'↘':'–'}</span><span>{comparable?metricChange({value:c[key],previous:p[key],format:key==='rate'?'percent':'count'}):'Comparison unavailable'}</span></span>
          {comparable&&<span className="overview-kpi-delta">{key==='rate'?'Change vs. comparison period · pp = percentage points':(delta>0?'+':'')+fmt(delta)+' '+label.toLowerCase()+' vs. prior'}</span>}
        </div>
        <div className="overview-kpi-prior"><span>Comparison period</span><strong>{key==='rate'?rate(p[key]):fmt(p[key])}</strong></div>
        <small>{note}</small>
      </article>;
    })}</div>
    {current&&<p className="organic-detail-note">Rate denominator: {fmt(c.sessions)} eligible sessions. Each contact-submission session counts once; {fmt(c.contactEvents)} contact events were recorded. These are tracked submissions, not CRM-verified or unique-person leads.</p>}
    {detailed&&<section aria-label="Quote completion summary" className="conversion-funnel">
      <h3>Are quote starters completing the journey?</h3>
      <p>From ZIP submission to the final contact step in the same session and reporting period.</p>
      <div className="organic-cards conversion-cards overview-kpis">{[
        ['starts','Quote starts',false,'Sessions with a ZIP submission after a page view'],
        ['completed','Completed quote journeys',false,'Sessions with a final contact step after the ZIP step'],
        ['completionRate','Completion rate',true,'Completed quote journeys ÷ quote starts'],
        ['dropOffRate','Drop-off rate',true,'Quote starts without an observed completion ÷ quote starts'],
      ].map(([key,label,percent,note])=>{
        const value=journey[key],prior=priorJourney[key],comparable=value!=null&&prior!=null;
        const delta=comparable?value-prior:null;
        const tone=delta===null||delta===0?'neutral':key==='starts'?'context':(key==='dropOffRate'?delta<0:delta>0)?'positive':'negative';
        return <article className="card overview-kpi" data-tone={tone} key={key}>
          <span className="overview-kpi-label">{label}<MetricHelp label={label} definition={METRIC_HELP[key]} /></span>
          <strong className="overview-kpi-value">{percent?rate(value):fmt(value)}</strong>
          <div className="overview-kpi-change"><span className="overview-kpi-badge"><span aria-hidden="true">{delta===null||delta===0?'–':delta>0?'↗':'↘'}</span><span>{comparable?metricChange({value,previous:prior,format:percent?'percent':'count'}):'Comparison unavailable'}</span></span><span className="overview-kpi-delta">{percent?'Change vs. comparison period · pp = percentage points':'Change vs. comparison period'}</span></div>
          <div className="overview-kpi-prior"><span>Comparison period</span><strong>{percent?rate(prior):fmt(prior)}</strong></div>
          <small>{note}</small>
        </article>;
      })}</div>
      {journey.starts>0&&<p><strong>{fmt(journey.completed)} of {fmt(journey.starts)} quote-start sessions reached the final contact step.</strong> {fmt(journey.dropOff)} had no observed completion in the same session and period.</p>}
      {journey.starts===0&&<p>No quote starts were recorded. Completion and drop-off rates cannot be calculated.</p>}
      <p className="organic-detail-note">A completed journey is a tracked contact-step submission, not a confirmed policy or CRM-verified lead. Drop-off does not prove abandonment: later completions and lost tracking can be excluded.</p>
    </section>}
    {detailed && current && <CollapsibleSection className="card conversion-funnel" title="Same-session quote journey" level={3} header={<h3>Same-session quote journey</h3>}><p>Ordered steps completed within the selected reporting period.</p>{stages.map(([label,value],i) => <div className="conversion-stage" key={label}><div><span>{label}</span><strong>{fmt(value)}</strong></div><div className="conversion-rail"><span style={{width:`${c.sessions ? value/c.sessions*100 : 0}%`}} /></div>{i>0 && <small>{stages[i-1][1] ? `${rate(value/stages[i-1][1]*100)} progressed from the previous step · ${fmt(stages[i-1][1]-value)} did not reach this step` : 'No previous-step sessions'}</small>}</div>)}<p>{fmt(c.contactSessions-c.completedFunnel)} contact-submission sessions had no observed preceding ZIP step and are excluded from the final funnel stage. Phone clicks occurred in {fmt(c.phoneSessions)} sessions.</p></CollapsibleSection>}
    {detailed&&!current&&<p role="status">The selected-period funnel is unavailable until its totals load.</p>}
    <CollapsibleSection className="card organic-landing" title="Landing pages producing contact submissions" level={3} header={<h3>Landing pages producing contact submissions</h3>}><p>Up to 100 by contact-submission sessions, then eligible sessions</p><div className="organic-table-scroll"><table><thead><tr><th scope="col">Landing page<MetricHelp label="Landing page" definition={METRIC_HELP.landing} /></th><th scope="col">Eligible sessions<MetricHelp label="Eligible sessions" definition={METRIC_HELP.eligible} /></th><th scope="col">Contact submissions<MetricHelp label="Contact submissions" definition={METRIC_HELP.contactSessions} /></th><th scope="col">Conversion rate<MetricHelp label="Conversion rate" definition={METRIC_HELP.rate} /></th></tr></thead><tbody>{(data.pages||[]).map(row => <tr key={row.page}><td>{row.page}</td><td>{fmt(row.sessions)}</td><td>{fmt(row.contactSessions)}</td><td>{rate(row.rate)}</td></tr>)}</tbody></table></div>{data.pages===null ? <p role="status">Landing-page breakdown unavailable. Use Retry unavailable data above.</p> : !data.pages.length && <p>No eligible organic sessions in this period.</p>}</CollapsibleSection>
    <details className="organic-definitions"><summary>Conversion definitions and tracking limits</summary><p>Eligible sessions start on www.medicarefaq.com or medicarefaq.com, are classified Organic Search, and have a MedicareFAQ page view. Contact submissions use form_submitted with step_3_contact on demographics.medicarecompared.com. ZIP steps use step_1_zip. Only events on MedicareFAQ, rates.medicarefaq.com, and demographics.medicarecompared.com within the same session and reporting period are considered.</p><p>Repeated contact events in a session count once. We have not verified backend acceptance or matched these events to CRM lead records. New sessions, lost cross-domain identifiers, untracked calls, and completions after the reporting period are not attributed. The landing-session denominator is narrower than the traffic overview, which includes visits reaching MedicareFAQ after starting elsewhere. No additional bot or internal-user exclusion is applied to this conversion cohort.</p><p>This PostHog report does not verify applications or sales. Historical Datorama exports, when available, appear separately in Leads & funnel. Complete reports are saved for these exact dates and refreshed on access after 15 minutes, subject to PostHog source caching. Closing the page stops progress checks; returning resumes them.</p></details>
  </CollapsibleSection>;
}
