export const REVIEW_FIELDS = [
 ['period','Review dates','Start and end dates for this review.'],
 ['comparison','Comparison dates','The comparison period; note different dates used by any source.'],
 ['freshness','Sources, scope, and data gaps','MedicareFAQ organic scope; source/report name, data-through and retrieval dates; device/location; missing values.'],
 ['performance','Traffic and search summary','What changed? Include current/prior counts, dates, and the report supporting each finding.'],
 ['leads','Leads and policies','Keep PostHog submissions and Datorama EIP leads separate. Specify gross/approved and MS/MA. Label subtotals and unavailable rates.'],
 ['opportunity1','Opportunity 1','Page URL • evidence and source/date • why it matters • next action • owner • target date • success measure.'],
 ['opportunity2','Opportunity 2','Page URL • evidence and source/date • why it matters • next action • owner • target date • success measure.'],
 ['opportunity3','Opportunity 3','Page URL • evidence and source/date • why it matters • next action • owner • target date • success measure.'],
 ['results','Previous work and available results','What shipped and when? Before/after dates and values, saved result date, limits, and next step. If none, say not yet available.'],
 ['decisions','Decisions and follow-up','What do you need from Pepper? Priorities, owners, next review date, and unresolved questions.']
];
export const emptyReview=()=>Object.fromEntries(REVIEW_FIELDS.map(([key])=>[key,'']));
const keyFor=userId=>{if(typeof userId!=='string'||!userId)throw Error('Sign in to save a draft.');return 'organic-review-draft:v1:'+userId;};
export function validateReview(value){
 if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Invalid review draft.');
 return Object.fromEntries(REVIEW_FIELDS.map(([key])=>{if(typeof value[key]!=='string'||value[key].length>4000)throw Error('Invalid review draft field.');return [key,value[key]];}));
}
export function readReview(storage,userId){
 const raw=storage.getItem(keyFor(userId));if(!raw)return null;
 const record=JSON.parse(raw);if(record.version!==1||typeof record.savedAt!=='string'||!Number.isFinite(Date.parse(record.savedAt)))throw Error('Invalid saved draft.');
 return {fields:validateReview(record.fields),savedAt:record.savedAt};
}
export function saveReview(storage,userId,fields){
 const record={version:1,fields:validateReview(fields),savedAt:new Date().toISOString()};
 storage.setItem(keyFor(userId),JSON.stringify(record));return record;
}
export function formatReview(fields){
 const draft=validateReview(fields);
 return 'Review for Pepper — MedicareFAQ organic performance\n\n'+REVIEW_FIELDS.map(([key,label])=>label+'\n'+(draft[key].trim()||'[Not recorded]')).join('\n\n');
}
import {metricValue,metricChange} from '../../lib/posthog/overview.js';
import {displayMetric,changeLabel} from '../../lib/gsc/report.js';

export function loadedReview(traffic,search){
 const fields={period:[],comparison:[],freshness:[],performance:[]};
 for(const [label,state,zone] of [['PostHog',traffic,'America/New_York'],['Google Search Console',search,'America/Los_Angeles']]){
  const r=state?.status==='ready'?state.result:null;
  if(!r?.period){fields.freshness.push(`${label}: ${state?.status==='error'?'unavailable':'loading / not loaded'}. No values included.`);continue;}
  fields.period.push(`${label}: ${r.period.start} – ${r.period.end} · ${zone}`);
  fields.comparison.push(`${label}: ${r.period.priorStart} – ${r.period.priorEnd} · ${zone}`);
  fields.freshness.push(`${label}: MedicareFAQ organic search · all countries and devices. Retrieved: ${r.fetchedAt||'not reported'}. Data through: ${r.availableThrough||r.period.end}. ${(r.period.warnings||[]).join(' ')}`);
  if(label==='PostHog')for(const m of r.metrics||[]){
   const value=Number.isFinite(m.value)?m.value:null,previous=Number.isFinite(m.previous)?m.previous:null;
   fields.performance.push(`${label} — ${m.label||m.key}: ${metricValue(value,m.format)} current vs ${metricValue(previous,m.format)} prior; ${m.unavailableReason||metricChange({...m,value,previous})}.${m.coverage?' Measured-session coverage: '+m.coverage.measured+' of '+m.coverage.total+' current; '+(m.coverage.previousMeasured??'unavailable')+' of '+(m.coverage.previousTotal??'unavailable')+' prior.':''}`);
  }else for(const [key,name] of [['clicks','Clicks'],['impressions','Impressions'],['ctr','Click-through rate'],['position','Average position']]){
   const c=r.current?.[key]??null,p=r.previous?.[key]??null;
   fields.performance.push(`${label} — ${name}: ${displayMetric(c,key)} current vs ${displayMetric(p,key)} prior; ${changeLabel(c,p,key)}.`);
  }
 }
 fields.freshness.push('Sources may use different periods and time zones. Missing values are unavailable, not zero. These are observed changes, not proof of what caused them.');
 return Object.fromEntries(Object.entries(fields).map(([k,v])=>[k,v.join('\n')||'No loaded report dates yet.']));
}
