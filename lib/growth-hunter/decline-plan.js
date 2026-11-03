export function declineSuggestion(finding){
 const a=finding.prior,b=finding.current;
 if(b.position-a.position>=1)return 'Review the queries losing clicks and compare the page’s coverage with the current search results. Check recent content and internal-link changes before deciding what to update.';
 if(Math.abs(b.position-a.position)<=0.5&&b.ctr-a.ctr<=-0.005)return 'Inspect the search results and the page’s title and description for the queries losing clicks. Check changes in search-result features and query mix before proposing a title or description update.';
 if(b.impressions<a.impressions*0.8)return 'Check whether search demand, seasonality, indexing, or query mix changed. Review the lost queries before assigning a content update.';
 return 'Investigate the queries losing clicks, indexing, and recent page changes. The current evidence does not establish a cause; confirm the issue before editing content.';
}
export function declineNotes(run,finding,plan,research,leadReport,lead){
 const p=run.result;
 const lines=['Planned investigation: '+plan,'GSC page: '+finding.url,
 `Pacific dates: ${p.priorPeriod.start} to ${p.priorPeriod.end} → ${p.currentPeriod.start} to ${p.currentPeriod.end}`,
 ...['clicks','impressions','ctr','position'].map(k=>`${k}: ${finding.prior[k]} → ${finding.current[k]}${k==='ctr'?' (fraction)':''}`),
 'Saved decline run: '+run.id+' · Saved '+run.created_at,
 'Frozen GSC snapshots: '+run.prior_snapshot_id+' → '+run.current_snapshot_id,
 research?'Saved query evidence: '+research.id+' · Fetched '+research.payload.fetchedAt:'Query evidence not loaded for this action.'];
 if(research){const queries=compareQueryEvidence(research.payload).matched.filter(q=>q.lostClicks>0).slice(0,3);for(const q of queries)lines.push(`Query ${q.query.slice(0,120)}: ${q.prior.clicks} → ${q.current.clicks} clicks`);}
 if(leadReport){lines.push('PostHog organic landing cohorts · Same Pacific dates · Retrieved '+leadReport.fetchedAt);
  for(const k of ['sessions','contactSessions','phoneSessions'])lines.push(`${k}: ${lead?.previous?.[k]??'Unavailable'} → ${lead?.current?.[k]??'Unavailable'}`);
  if(leadReport.current?.truncated||leadReport.previous?.truncated)lines.push('PostHog row limit reached; missing pages may be outside returned results.');
 }else lines.push('PostHog landing/contact evidence unavailable or not loaded.');
 lines.push('Missing rows are not zero. GSC query coverage is incomplete; matched-page detector excludes unmatched pages. Contact sessions are tracked submissions, not CRM leads or policies. Observed changes do not prove a cause.');
 return lines.join('\n');
}
import {compareQueryEvidence} from './keywords.js';
