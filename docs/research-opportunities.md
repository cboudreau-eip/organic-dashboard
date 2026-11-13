# Research opportunities — milestone 1

Content Plan opens the research workspace. The earlier manual draft remains separately accessible. This milestone does not generate calendars, briefs, articles or publication dates.

## Workflow

1. Save shared planning settings. January 1, 2027 and 90 days are defaults. Capacity and mix are future scheduling inputs; objective and notes are reviewer context, not hidden scoring inputs.
2. Start research. Authenticated analysts/admins can run and review; team viewers can inspect.
3. The browser advances one saved step at a time: GSC pagination, PostHog, saved Semrush, saved Otterly, sitemap discovery, page reads, ranking. Pause/navigation saves the current step. Resume continues the same run; refresh alone does not resume it.
4. Review source coverage and the queue. Filter by wording, decision, action, product and confidence. Open evidence, then save Needs review/Keep/Defer/Reject with a reason. Keep is not publication approval.

Completed runs are immutable. Settings and reviews use optimistic versions. Review keys use normalized observed wording, so identical groups retain decisions across runs; changed group wording is not silently treated as previously approved. New evidence does not overwrite an old decision, and the detail panel indicates decisions carried from earlier runs.

## Sources and limits

- GSC: latest 90 finalized Google web days, joint query/page rows in 25,000-row pages, at most 100,000. Privacy exclusions and API omissions remain. No keyword-to-conversion attribution is inferred.
- PostHog: last 90 complete New York days, existing MedicareFAQ organic/CDN landing-page definitions, 2,500-page limit. Quote starts and engagement are contextual. Quote completion metrics are excluded from ranking.
- Semrush: latest valid saved campaign export by report end, retaining location/device/engine. No API credits are consumed and no fresh competitor keyword discovery is claimed.
- Otterly: latest saved US MedicareFAQ report, with monitored prompts/mentions/citations. Prompt counts are not search volume.
- Website: same-host HTTPS sitemap and landing pages; redirects revalidated; 80-sitemap and 2,500-page limits. Each HTML fetch is bounded to 1.5 MB/10 seconds. Titles, H1–H3, internal links, canonical, fetch timestamp, and up to 10,000 text characters are saved. Readable records younger than seven days can be reused; failed pages are retried. Missing reads/caps make coverage partial. Even complete discovered coverage is not proof that every site page is known.

Source periods are displayed separately. A saved source ending more than 14 days ago is marked stale. Candidate sources can fail independently; the run must have some candidate evidence before completing. Start a new run to retry failed source collection. All network calls remain server-side; no external page instructions are executed or passed to a model.

## Ranking v3.1

Observed GSC queries, Semrush keywords and Otterly prompts seed conservative normalized wording groups. Product/exclusion settings filter the pool. Rule-based transactional/commercial language or qualifying Semrush intent qualifies groups; service/navigation and clearly outdated-year queries are excluded; no minimum volume excludes a long tail. Up to 1,000 high-intent groups are evaluated. Monitored Semrush/Otterly groups are retained first (ordered by supported preliminary points if they alone exceed the cap), then broader GSC discoveries fill remaining places by supported intent/fit/competition/demand points before page matching. Final ordering uses all supported score components. Cap counts are visible. This avoids a large enrollment-query pool crowding out every commercial comparison or monitored long-tail prompt.

Weights: intent 35, product/state fit 25, competition proxy 20, demand band 10, coverage gap 10. Semrush difficulty is a proxy, not a live SERP assessment. Unknown factors yield a score interval and ordering uses supported points. GSC page-query impressions and Semrush volume are never summed; the strongest is used only for an ordinal demand band. Otterly counts are never used as volume. Page matching uses weighted primary-title coverage, supporting headings, product/carrier/plan/state identity, canonical URLs and observed query/page impressions. An observed URL alone does not guarantee a relevant target. Overlap requires two comparable pages with at least 70% primary-title coverage, 20 impressions each and 20% of group impressions each; it remains a research flag rather than a cannibalization verdict.

Limitations: this is an evidence-backed research queue, not an autonomous SEO expert. Broad semantic topic clustering, fresh competitive expansion, live SERP review, prior-period opportunity changes, and editorial acceptance are still future work. Generic intent rules can misclassify ambiguous terms; the user reviews them before planning. Scores are not forecasts of leads or revenue.

Explicit quote/application/purchase wording receives full transactional credit; enrollment timing and source-only transactional labels receive commercial-level credit. Grouping merges explicit product/carrier/generic-plan equivalents, NH/New Hampshire and plan-comparison variants. Specific plans, states, negation, review questions and switching direction remain distinct. Unknown competition is not zero difficulty. The highest attached KD is used consistently before and after the candidate cap.

Readability problems elsewhere on the website do not erase verified existing-page coverage. Uncertain targets and new-page gaps remain provisional. No High confidence tier is produced without additional validation.

Re-rank saved evidence creates a new immutable run from the selected run's original settings, evidence and inventory, without new external source calls. Source dates are preserved; available source reports older than 14 days are marked stale again. Original completed runs and reviews are retained. Unchanged groups retain their review key. Merged/split groups get a new key; earlier reviews are shown in the evidence panel as reference notes rather than inherited approval.

See [the individual top-20 audit](research-ranking-review.md) for the same-evidence comparison and remaining limitations.

## Storage / validation

Migration `20261113145339_research_opportunities.sql` adds `research_settings`, `research_runs`, and `research_reviews` with team RLS, actor stamping, optimistic versions, immutable completed runs and valid-candidate checks. Existing data tables are unchanged. `GET/POST /api/research` require verified team membership; mutations require analyst/admin and canonical dashboard origin.

Migration `20261113151509_research_evidence_chunks.sql` stores large evidence arrays in immutable, content-addressed batches below 350 KB each. Run records hold references and progress, not a growing multi-megabyte document. Existing unchanged batches are reused during the run; interrupted writes can be retried. Queue responses omit detailed evidence, which loads on demand when an opportunity is opened. Legacy in-record runs remain resumable.

Tests cover permissions, concurrent edits, immutability, invalid review references, source failures, resumability, missing-versus-zero evidence, long-tail candidates, UI collection/review flow and input bounds. Run `npm test` and `npm run build` before release.

Future work deliberately excluded: calendar generation, content creation, scheduled source refresh, new Semrush API integration, automatic website changes and revenue forecasting. Run-history payloads are retained; establish an explicit retention policy before enabling scheduled runs.
