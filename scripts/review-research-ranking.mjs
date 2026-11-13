// Offline comparison of the same saved research evidence. No external requests.
import fs from 'node:fs';
import {rankOpportunities} from '../lib/research/rank.js';
const [snapshotPath,baselinePath,outputPath]=process.argv.slice(2);
if(!snapshotPath||!baselinePath||!outputPath)throw Error('Provide saved run JSON, baseline items JSON and audit Markdown output path.');
const run=JSON.parse(fs.readFileSync(snapshotPath,'utf8')),baseline=JSON.parse(fs.readFileSync(baselinePath,'utf8')).items.slice(0,20);
const result=rankOpportunities(run.payload.evidence,run.payload.inventory.pages,run.settings,run.payload.inventory.complete);
const reviewed=baseline.map((old,i)=>{const next=result.items.find(x=>x.key===old.key||x.previousKeys.includes(old.key));return {oldRank:i+1,old,next,newRank:next?result.items.indexOf(next)+1:null};});
const distinct=[...new Set(reviewed.map(r=>r.next?.key).filter(Boolean))];
const notes=[
 'Retain the carrier page. Merge equivalent Plan G wording; the conservative difficulty band now considers all attached variants.',
 'Combine BCBS/Blue Cross wording and generic plan variants; keep Anthem distinct from the broader BCBS family.',
 'Use the dedicated Plan C page, not the birthday-rule page. Verify present-day product eligibility before approving work.',
 'Treat the observed companies comparison as existing coverage to inspect, not proof that two pages compete.',
 'Merge general Anthem variants. Existing landing evidence needs inspection before claiming a new-page gap.',
 'Use the Idaho page; combine generic plan wording.',
 'Keep a provisional new-page investigation; remove the unrelated medical-alert target. Missing site reads prevent a confirmed gap.',
 'Match chart/comparison wording to the comparison page, not unrelated pages containing a chart.',
 'Use the Utah page; combine generic plan wording.',
 'Resolve NH/New Hampshire as one topic and preserve the state-specific target.',
 'Do not recommend Hawaii for a national USAA query. Inspect observed pages before suggesting a new page.',
 'Combine the general Aetna wording variants while preserving plan-specific and review questions.',
 'Same general Aetna group as the preceding row; no separate content assignment.',
 'Same general Anthem group; no separate content assignment.',
 'Same general Anthem group; no separate content assignment.',
 'Retain the application signal; match Part D-specific enrollment coverage rather than a generic application or Part B page.',
 'Keep the Cigna carrier page and merge general plan variants.',
 'Keep explicit enrollment-action wording and prefer Part D-specific coverage.',
 'Reduce to buying-obstacle credit. Comparable Part D enrollment pages still warrant overlap review if both have material evidence.',
 'Reduce timing wording to buying-obstacle credit and use Medigap open enrollment rather than the Medicare annual-enrollment page.'
];
const safe=s=>String(s??'—').replaceAll('|','/').replaceAll('\n',' ');
const lines=['# Research ranking review — 2026-11-13','',
 'Baseline: `'+run.id+'` (`research-v2`). Comparison: `'+result.version+'`. The same saved GSC, PostHog, Semrush, Otterly and website inventory are used. This is an evidence and rules audit, not fresh search-result validation or editorial approval.','',
 'Reviewed all 20 original leaders. They now map to '+distinct.length+' distinct groups. The original '+baseline.filter(x=>x.type==='Investigate overlap').length+' overlap warnings become '+distinct.filter(k=>result.items.find(x=>x.key===k).type==='Investigate overlap').length+' among those groups.','',
 '## Original top 20, reviewed individually','',
 '| Before | Original opportunity | New rank / score | Recommended action and target | Review finding |','|---|---|---|---|---|',
 ...reviewed.map((r,i)=>'| '+r.oldRank+' | '+safe(r.old.title)+' | '+(r.next?r.newRank+' / '+r.next.score+(r.next.scoreMax!==r.next.score?'–'+r.next.scoreMax:''):'Outside queue')+' | '+(r.next?safe(r.next.type)+(r.next.targetUrl?' · [page]('+r.next.targetUrl+')':' · target unconfirmed'):'—')+' | '+notes[i]+' |'),'',
 '## Rule changes','',
 '- Explicit quote/application/purchase wording earns transactional credit. Enrollment timing and source-only transactional labels receive commercial-level credit.',
 '- Service/navigation and clearly outdated-year queries are excluded from this buying-intent queue. These exclusions do not claim those queries have no business value elsewhere.',
 '- Explicit equivalent product, carrier, generic-plan, NH and plan-comparison wording is grouped. State, plan letter, underwriting negation, review questions and switching direction remain distinct.',
 '- Primary-title relevance, product/carrier/plan/state identity, canonical URLs and observed page-query evidence select targets. Incidental subheadings and tiny GSC rows no longer automatically win.',
 '- Overlap requires at least two comparably scoped pages with strong primary-title coverage, at least 20 impressions each and at least 20% of the group’s observed impressions each. These are review thresholds, not a cannibalization diagnosis.',
 '- Coverage confidence is assessed per opportunity. Verified existing coverage can receive credit despite unrelated inventory failures; uncertain targets and new gaps remain provisional.',
 '- Difficulty uses the highest attached saved KD consistently before and after the candidate cap. Demand is never summed across GSC and Semrush.',
 '- Unchanged groups retain saved review decisions. Regrouped topics show earlier notes for reference and require a new decision; old reviews are not overwritten.','',
 '## Same-evidence queue totals','',
 JSON.stringify(result.counts,null,2),'',
 'The 1,000-item cap still prioritizes monitored Semrush/Otterly candidates before filling remaining places with GSC discoveries. Unknown competition can disadvantage a new long-tail topic, so the queue is not an exhaustive best-content list. No keyword-to-conversion attribution is inferred.','',
 '## New top 20','',
 '| Rank | Topic | Priority | Action |','|---|---|---|---|',
 ...result.items.slice(0,20).map((x,i)=>'| '+(i+1)+' | '+safe(x.title)+' | '+x.score+(x.scoreMax!==x.score?'–'+x.scoreMax:'')+' | '+x.type+' |'),'',
 'Calendar generation, content creation and website edits remain outside this change.',''];
fs.writeFileSync(outputPath,lines.join('\n'));
fs.writeFileSync(snapshotPath.replace(/\.json$/,'-reranked.json'),JSON.stringify(result));
console.log(JSON.stringify({version:result.version,originalTop20:baseline.length,distinctGroups:distinct.length,originalOverlap:baseline.filter(x=>x.type==='Investigate overlap').length,newOverlap:distinct.filter(k=>result.items.find(x=>x.key===k).type==='Investigate overlap').length,counts:result.counts,output:outputPath},null,2));
