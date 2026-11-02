# Otterly AI visibility

Status: deployed to production November 2, 2026. Read-only Otterly credentials are stored as sensitive production secrets; the first report was synced and verified in the signed-in dashboard.

The AI visibility navigation item is available to the existing Growth Hunter team membership. It reads saved reports, never calls Otterly on page views. The separate report period is 30 completed New York calendar days; these date strings are passed to Otterly, whose collection timezone is not supplied by the API. Saved snapshots overlap and must not be summed.

## Scope and source contract

- Workspace `01KVG663108Q1YK3G12YESDHEN`, report `01KVG7BNGPHG2M0RD4T9D9EVA3`, country `us`.
- Brand metadata must match MedicareFAQ and the expected workspace/report; reject other domain variations or wildcard domains.
- Citation requests filter to medicarefaq.com, then enforce exact medicarefaq.com/www.medicarefaq.com URL hosts locally. No credential-bearing URLs or alternate ports.
- Brand coverage is about mentions in monitored answers, including answers citing other sites. It is separate from page citation scope, human visits, leads and policies.
- Competitor share of voice and history come from `competitorBrandsAnalysis`, not the all-detected-brand denominator.
- All list pages must complete. Malformed or oversized pagination aborts the save. Unavailable engine reports remain null and are labeled unavailable.
- Snapshot payloads contain normalized report data, never provider keys or raw error responses.

Public API schema: https://data.otterly.ai/v1/openapi.json (reviewed November 2, 2026).

## Operation

`GET /api/cron/otterly` requires a timing-safe `Bearer CRON_SECRET` match. Vercel schedule: daily at 14:00 UTC. `POST /api/otterly/reports` requires same-origin and analyst/admin membership. `GET /api/otterly/reports` requires team membership and reads database snapshots.

The server-only writer uses the existing `SUPABASE_SERVICE_ROLE_KEY`; its imports are confined to server routes. The Otterly key should have read-only access to the selected workspace. Set `OTTERLY_API_KEY` and a random `CRON_SECRET` as private production secrets. Never prefix either with NEXT_PUBLIC_. Existing user sessions use publishable keys and RLS for reads.

The database claim prevents duplicate daily runs, allows at most three attempts per report date, spaced at least one hour apart. Provider calls have timeouts, reject redirects, and are capped at 40 per run. Typical use with four monitored engines is 19 calls/day plus extra list pages (about 570/month); seven monitored engines would use 25/day (about 750/month). Worst-case retries consume more; monitor the 2,000-request allowance. No provider-side writes occur. A failed sync retains the previous snapshot and records a safe failure status.

## Release verification checklist

1. Confirm key-creation approval and securely provision the key; do not rotate the existing key.
2. Test the authenticated API. Reconcile the exact same dates/country/engines with Otterly UI, including percentage units, metadata scope, pagination, and oldest returned history date.
3. Apply `20261102161744_otterly_daily_snapshots.sql` to the verified Organic Dashboard Supabase project; run advisors and verify access with team/outsider roles.
4. Configure production secrets, deploy the tested commit, trigger the first sync, and reconcile stored results with the source.
5. Verify AI visibility in the signed-in dashboard, history selection, missing-data states, and unauthorized API/cron denial. Check the scheduled job registration.

Local validation: the 126-test suite and production build passed before live credentials were available. Provider tests use synthetic fixtures and do not establish live correctness.

Live verification (November 2, 2026): October 3-November 1, US, 41 prompts; MedicareFAQ coverage 12%, 511 mentions, 866 citations across 67 own-domain URLs. Main-brand metrics come from the isMainBrand competitor-analysis row; the general summary includes other brands and is not used for MedicareFAQ totals. Platforms with zero monitored prompts show Unavailable. The saved report and signed-in UI match. Unauthenticated report/cron requests return 401; the authenticated cron endpoint returns 200 and skips the already-saved date. Daily 14:00 UTC scheduling is declared in the deployed vercel.json; automatic execution has not yet occurred. Targeted Otterly tests and the production build passed after live reconciliation.

Platform citations: each monitored engine uses its own fully paginated /citations request with the same report dates, US country, and exact own-domain validation. Missing or failed citation measurements remain null independently of mentions. Existing snapshots without the field render Unavailable. On November 2, the initial October 3-November 1 snapshot was enriched with verified citation counts only (ChatGPT 44, Google AI Overviews 10, Perplexity 253, Copilot 559; sum 866); original measurements and report dates were preserved. Routine syncs include the new field automatically.

Prompt opportunities: domainMentions is shown as MedicareFAQ citations, following Otterly prompt-monitoring documentation (https://help.otterly.ai/search-prompt-monitoring). Zero brand mentions with positive domain citations is cited-but-not-named; zero of both with competitor mentions is an observed visibility gap. Null measurements are incomplete evidence. Each monitored engine now receives a separately paginated prompts request with matching dates/country; missing prompt rows remain unavailable. Opportunities include cited-but-not-named prompts without competitor mentions, and order observed gaps before cited prompts, then competitor mentions descending (not predicted impact).

The server may enrich a pre-existing snapshot once via otterly_enrich_prompt_platforms after an operator explicitly re-queues that date through the existing bounded job lock. This adds only promptPlatforms and their retrieval timestamp; the original prompt counts, other measurements and original fetchedAt remain intact. Authenticated team users remain read-only. Normal completed jobs still cannot be re-run.
