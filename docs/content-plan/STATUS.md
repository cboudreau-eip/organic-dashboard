# Content Plan work status

Goal: a dashboard Content Plan section with an unscheduled opportunity list, calendar, filters, statuses, owners, and briefs. January 1–March 31, 2027 dates must not be assigned until the user reviews the ranked shortlist.

## Evidence collected November 12, 2026
- Semrush snapshot a67305ac-f317-4537-bbeb-a6c952b282c2: 547 tracked keywords, Google US mobile, October 27–November 2. Fresh Semrush MCP access returned no_api_units. Do not repeat API requests until credits change. This campaign is not the universe of ranking keywords and must not be compared directly to the older desktop snapshot.
- Otterly snapshot 3773daae-ae7c-4cb6-a6ee-5b613627555b: October 13–November 11, retrieved November 12. Saved prompts, citations, platform details and page evidence locally. Prompt counts are not search demand.
- GSC saved page snapshots: October 6–November 2 compared with September 8–October 5 (713 and 893 rows). Not exhaustive. Current GSC read-only credentials are configured locally; fresh longer-range query/page evidence is the next extraction.
- PostHog read-only credentials configured locally. Prior verification found organic cross-domain completion attribution missing November 2 onward in the checked range; do not rank by completion rates. Use dated quote starts and engagement only, with tracking limitations.

## Ranking contract
Commercial/transactional intent 40%; product and lead-generation relevance 25%; demand/visibility evidence 20%; feasibility 15%. Explain scoring components. Keep confidence separate from priority. Label analyst-inferred intent and suggested long-tail wording separately from observed search queries. Unknown volume is not zero. Group by intent and inspect existing content before recommending new URLs.

## Remaining work
1. Fresh extraction completed: GSC August 13–November 10, 62,780 query rows and 1,009 page rows; PostHog October 13–November 11, top 500 landing pages by quote starts. Completion fields collected but excluded from ranking. Add engagement if useful and validate candidate query-to-page attribution with filtered GSC queries.
2. Initial 15-item draft saved in shortlist-draft.json. Semrush intent codes are i/c/t/n, not full words. All proposals currently target existing pages; broaden research before declaring this the final opportunity universe.
3. Four live pages reviewed: comparison tools, Plan G, switching FAQ, Plan G companies. Existing Plan G pages already link to a quote worksheet; do not propose recreating it. Review remaining candidate pages, refine scoring to account for business-action evidence as well as impressions, add explicit long-tail brief questions, and inspect overlap before final recommendations.
4. Present shortlist for approval; implement the Content Plan section with unscheduled items and calendar capabilities, preserving the review gate on scheduling.

Local Content Plan implementation now exists in components/dashboard/ContentPlan.jsx and content-plan.css, exposed via navigation/runtime integration and authenticated GET /api/content-plan using existing Growth Hunter read authorization. It renders the draft shortlist, filters by text/confidence, shows briefs and source windows, and displays the empty January–March calendar. This is not deployed. Persistent approval/status/owner/brief/date editing is still required; do not claim the section complete. Local JSON files contain aggregate source evidence only. Review their size and necessity before committing; keep the 11 MB raw GSC queries out of the client bundle and preferably out of Git.

Verification: content-plan-ui and existing dashboard tests passed (2 tests); calendar January 31 / February 28 / March 31 and empty schedule checked. Initial build compiled but worker spawn failed with EPERM; a rerun with normal process permissions was started. Check its authoritative result before claiming production build success. Browser visual verification still required.

Extraction script: scripts/collect-content-plan-evidence.mjs (read-only remote calls; local evidence output). Draft builder: scripts/build-content-shortlist.mjs. GSC unusually verbose prompt-like query strings should not be treated as proof of AI usage or automatically prioritized; only explicit short candidate query matches are included in the draft. Score and confidence are provisional and intentionally separate. Next work should improve this draft and implement the section; this is not a completion checkpoint.

## Save workflow implementation (local, November 12)
- Added lib/content-plan/contracts.js and handlers.js; API now reads saved content_plan_items and supports PATCH with same-origin checks, existing team authorization, bounded request parsing and optimistic versions. No source evidence/rank overwrite from editor.
- Added ContentPlanEditor and connected owner, brief, approval, status and planned date fields. Date requires explicit approval and is restricted to Q1 2027; no actual opportunities approved or scheduled by the agent. Added status filter.
- Created migration through official CLI: supabase/migrations/20261112211531_content_plan_items.sql. NOT APPLIED to hosted DB yet. API will need this migration before live use. RLS allows existing team viewers read, analysts/admins write; anonymous and outsiders cannot read. Trigger stamps actor/time and increments versions; constraint enforces approval before dates/production statuses.
- Contract and PGlite database tests passed; UI calendar test passed after editor wiring. Full editor save/error/conflict tests and handler authorization tests still needed. Build passed before this save-workflow change; rerun after completing the workflow. Hosted schema/advisors, visual verification and deployment still pending.
- Supabase executable absent; npx supabase@2.79.4 nonexistent. Official npx supabase worked and created migration. Do not repeat failed version attempts.

## Hosted storage verification
- content_plan_items migration applied successfully November 12. Confirmed table has RLS enabled and zero rows: no user approvals/dates fabricated. Security advisors report no content_plan_items/stamp_content_plan_item finding; existing unrelated advisories remain (access RPCs, private service tables, leaked-password protection).
- Six focused tests passed including handler save/read round trip, conflicting edits, view-only/outsider/origin denial, storage failure, contracts, database RLS and calendar. Full production build passed after save-workflow implementation.
- Four additional public-page observations saved in page-review-notes.json. Florida Plan G has internal date/price inconsistencies; Aetna needs availability validation; high-deductible Plan G needs scenario/label review; price article already has matching-assumptions content. Incorporate these into shortlist scoring/briefs. No website content changed.
- Remaining: complete editor interaction testing and browser visual verification; improve bespoke briefs and long-tail targeting for all 15; finalize evidence-weighting; clean raw extracts from commit; deploy and present ranked shortlist for actual user review. No deployment yet.

## Brief refinement completed
- Initial public-page inspection now covers all 15 candidates. Added scripts/content-plan-briefs.mjs with individual suggested long-tail questions, content-review observations, outline, semantic internal links, reader next step, publication verification and success measure. These are proposals, not new observed keywords. UI renders this detail and attached Semrush metrics/intent code explanation.
- Evidence score now combines GSC page visibility (up to 2/5), PostHog quote starts (up to 2/5), and attached Semrush/Otterly evidence (0.5 each). Weights stay intent 40%, business fit 25%, evidence 20%, feasibility 15%. Missing records stay null. All confidence Moderate given dated Semrush, attribution limits, and no full competitor/content audit.
- Ranked top six: comparison tools 97; Plan G companies 93; national Plan G 91; Florida Plan G 91; switching to Medigap 91; Plan G price comparisons 91. Quotes are a proxy, not leads. Ranking is not an estimate of future business results.
- Raw evidence directory now gitignored; compact shortlist retains selected source metrics and dates. Extraction data remains local for reproducibility. Rebuild script depends on those files; it is not a production build step.
- Five UI/contract/handler tests passed after brief refinement. No dates/approvals saved. Remaining next: complete editor test, visual review, deployment, live read/save verification, and present full shortlist for user approval. Do not stop at another status-only summary; move toward deployment and the actual review gate.
