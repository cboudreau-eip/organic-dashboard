'use client';
import {useState} from 'react';
import CollapsibleSection from './CollapsibleSection';
import CohortHistory from './CohortHistory';
import {cohortMetrics, followUpMonths} from '../../lib/datorama/cohorts';
import './datorama-cohorts.css';

const label = month => new Date(`${month}-01T12:00:00Z`).toLocaleDateString('en-US', {month: 'long', year: 'numeric', timeZone: 'UTC'});

export default function DatoramaCohorts({data}) {
  const [selected, setSelected] = useState('');
  const months = [...data.months].filter(m => m.start <= data.leadDataThrough).reverse();
  const cohort = months.find(m => m.month === selected) || months.find(m => !m.partial) || months[0];
  if (!cohort) return null;
  const metrics = cohortMetrics(cohort);
  return <CollapsibleSection className="datorama-cohorts" title="Monthly lead cohorts & four-month follow-up" level={3}>
    <p>Keep every lead’s results in the month the lead was created. An August lead that buys in October still belongs to August.</p>
    <label className="cohort-picker">Lead-created month<select value={cohort.month} onChange={e => setSelected(e.target.value)}>{months.map(m => <option key={m.month} value={m.month}>{label(m.month)}{m.partial ? ' (partial month)' : ''}</option>)}</select></label>
    <p><strong>{label(cohort.month)} cohort</strong> · Lead dates {cohort.start}–{cohort.end}. Latest imported results, exported {new Date(data.exportedAt).toLocaleDateString('en-US', {timeZone: 'UTC'})}.</p>
    <p className="cohort-note">These are the latest totals assigned to this cohort, not totals frozen at month-end. A refreshed import can revise earlier cohorts. Gross and approved policies are separate statuses; do not add them together.</p>
    <div className="cohort-metrics">{metrics.map(m => <article key={m.label}><span>{m.label}</span><strong>{m.total === null ? 'Unavailable' : m.total.toLocaleString('en-US')}</strong><small>{m.unavailable ? (m.label === 'Salesforce opportunities' ? 'Not included in the current import' : 'Source mapping pending') : m.total === null ? 'No complete numeric total available' : m.incomplete ? 'Reported subtotal · incomplete coverage' : 'Latest imported total'}</small></article>)}</div>
    <p className="cohort-note">Salesforce opportunities use Datorama’s Opportunity Count for the original lead-created month. This retains the source definition; phone-contact qualification has not been independently verified. These are not Growth Hunter suggestions.</p>
    <h4>Four months after the lead-created month</h4>
    <p>Each checkpoint is the end of the following calendar month. Status is based on imported lead coverage through {data.leadDataThrough}, not today’s date.</p>
    <ol className="cohort-followups">{followUpMonths(cohort.month, data.leadDataThrough).map(point => <li key={point.number}><span>Follow-up {point.number}</span><strong>{label(point.month)}</strong><small>Checkpoint: {point.end}</small><p>{point.status}</p></li>)}</ol>
    <p>This schedule shows month-end targets. Saved exports below retain their actual source dates; they are not reconstructed month-end measurements.</p>
    <CohortHistory key={cohort.month} month={cohort.month} exportedAt={data.exportedAt}/>
    <details><summary>Follow-up measurement limits</summary><p>History starts with the first saved source export. Earlier checkpoint values cannot be reconstructed. Revenue, first-year policy value, and persistency remain unavailable until their source fields are connected. Missing values are never treated as zero.</p></details>
  </CollapsibleSection>;
}
