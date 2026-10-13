# Google Search Console connection

Acquisition displays live Google organic web search performance for the URL-prefix property `https://www.medicarefaq.com/`. PostHog remains the source for on-site organic sessions. Conversion validation is deferred.

## Configuration

Set `GSC_SERVICE_ACCOUNT_JSON` to the complete service-account JSON, server-only, in the deployment environment. Never prefix this variable with `NEXT_PUBLIC`. The service account needs Restricted access to this exact Search Console property and the Search Console API enabled in its Google Cloud project. No Google Cloud project roles are needed.

The current uploaded Google credential expires October 13, 2027. Replace the credential in Vercel and redeploy before expiry; revoke the old key after verifying the replacement. Keep keys out of source control.

## Data contract

Authenticated route: `/api/analytics/search?days=28`, with allowed windows 7, 28, 30. The server obtains a short-lived OAuth token using `webmasters.readonly`, then POSTs to Google's `/webmasters/v3/sites/{encoded-property}/searchAnalytics/query` endpoint. Credentials and tokens never reach the client. Failures show unavailable data, with no sample fallback.

Every query uses `type: web`, `dataState: final`. A date-grouped request over the last 14 days discovers the latest day with finalized reported data. Inclusive current and immediately preceding windows have equal lengths, using Pacific calendar dates. Site totals and date/query dimensions use `byProperty`; page rows use `byPage` aggregation. Current/previous cards use separate ungrouped requests, preserving Google's weighted CTR and position rather than averaging row rates. Zero-impression rates and position are unavailable.

The trend requests both windows by date. Google omits dates without data; these are displayed as zero clicks within the finalized window. Query and page tables each request the top 20 rows by clicks. They are not exhaustive: query privacy and row limits prevent reconciliation to totals, and page aggregation differs from property aggregation. No geography or device filter is applied. Results cache for 15 minutes; the UI reports the retrieval time and source period.

Reference: https://developers.google.com/webmaster-tools/v1/searchanalytics/query

## Validation

Run `npm test`, `npm run build`, and `node scripts/test-auth-flow.mjs`. For an authorized live GSC smoke test using the ignored `.env.local` credential, add `--gsc` to the auth fixture command. The fixture mocks login only; the optional GSC request contacts Google. Use `--serve` for browser verification.
