# Growth Hunter keyword investigations

Open a saved connected-GSC decline analysis and choose Investigate keywords on a finding. No exports or new credentials are needed.

The server derives both date ranges from the frozen page snapshots, validates that the page is a finding in the selected run, and requests finalized Web queries using an exact page filter. Only active analyst/admin members can fetch and save; active viewers can read saved investigations. Manual-export runs are rejected because their filters cannot be independently matched.

Each period is paginated in 1,000-row batches with a 2,000-query limit and overflow probe. Overflow or invalid data fails without saving a partial investigation. Empty responses remain empty. No missing query is converted to zero.

The first investigation for a run/page/version is immutable and reused. Reopening does not call Google again. Capture time is recorded because this later query fetch can reflect revisions after the original page snapshot. There is no refresh/overwrite action in this version.

The comparison table includes lost clicks, clicks, impressions, CTR and average position. Queries are matched by exact text and ranked by absolute lost clicks with a deterministic text tie-break. Unmatched queries are separate views with unavailable comparison metrics.

Pattern labels apply only to declining matched queries with at least 20 impressions in both periods: position worsening by at least 1; position stability within 0.5; impressions falling at least 20%; CTR falling at least 0.5 percentage points. These pilot rules suggest investigations and do not establish cause.

Google omits privacy-sensitive queries and may impose reporting limits. Query totals cannot be treated as a complete decomposition of page totals.

Storage: growth_query_research with RLS and read grants only; private, membership-gated writer through public security-invoker RPC. Migration: 20261019203559_growth_keyword_research.sql.

Verification: growth-keywords.test.mjs covers dates, filters, pagination, missing rows, calculations, permissions, reuse and failures. growth-keyword-database.test.mjs covers linked finding/date validation, immutability, direct-write denial, viewer/outsider/anon restrictions and disabled rollout.
