# Datorama period comparisons

Open Leads & funnel. The new daily comparison appears above the archived July-September 2026 landing-page report. Choose a calendar month, latest month to date, or custom dates; compare with the previous period, the same dates a year earlier, or custom dates. Apply comparison refreshes the authenticated report. Monthly history has a metric selector. Existing PostHog reporting controls remain separate.

## Source and scope

The source is the Datorama SEO Overview Dashboard, page 4666697 in workspace 72141/collection 1278224. Import the Performance Over Time - Gross and Performance Over Time - Approved tables with Day as the dimension. Confirm the same date range and cohort on both. Policies are reported on lead-created date, not policy issue date. The source cohort includes multiple/unknown landing hosts and is not MedicareFAQ-only. Source timezone is unconfirmed; calendar dates are preserved exactly. Filtered leads and sold leads retain the source definitions and are not independently verified qualified leads or total policy sales.

Eight metrics: all, filtered, sold and EIP lead counts; gross MS/MA and approved MS/MA policy counts. Do not add gross and approved statuses together. No cost, revenue, customer identities or raw URLs are required for this feature. Older lead cohorts have had more time to produce policies.

## Data handling

Daily version 1 is a server-only gzip/base64 JSON snapshot in DATORAMA_DAILY_GZIP, separate from the unchanged DATORAMA_SNAPSHOT_GZIP archive. Keep both out of public source and client bundles. The authenticated periods endpoint returns period/month aggregates only. Auth matches existing team analytics access. Failed requests never render zeros. Input is bounded to 366 days per period and imported history. Daily rows must be contiguous, unique, ordered, nonnegative safe integer counts or null; all eight observed daily sums must match source control totals.

Blank source cells stay null. Reported subtotals display the count of unreported days. Percentages, numerical changes and daily averages are suppressed when either comparison period has missing numeric values (averages require the corresponding period to be complete). This is deliberately conservative pending a confirmed source definition for blank policy cells. Do not silently replace blanks with zero. Full export totals reconcile but do not by themselves establish the meaning of each blank daily cell.

Month-to-date uses leadDataThrough, the latest verified day with lead counts, not the current date or export upper bound. Full months have their actual calendar lengths and a daily average. Previous custom periods have equal calendar-day length; previous MTD uses the same calendar day with month-end clamping. Prior-year February dates clamp to the prior-year month end. Display both period lengths and overlap warnings. Outside-history requests are rejected, never extrapolated. Zero previous values have no percentage baseline.

## Refresh procedure

1. Export both daily tables for the intended history, plus the full workbook with control totals. Validate source filter, day dimension, lead-created date basis and matching report ranges.
2. Extract the eight explicit columns. Preserve nulls, distinguish approved/gross, reject duplicate/missing dates and invalid counts. Reconcile daily sums to each source table's totals. Do not combine unrelated widgets.
3. Build version 1 with period, leadDataThrough, exportedAt, scope, dateBasis, timezone, source URL, metrics, rows and totals. Run validateDaily and representative comparisons.
4. Replace the server-only DATORAMA_DAILY_GZIP in Production and redeploy reviewed code. Retain original source exports securely and retain the previous deployment for rollback. Never publish data in GitHub.
5. Verify signed-in UI plus anonymous denial and reconcile a chosen month against Datorama. Record export timestamp and incomplete-source limitations.

## Validation

Tests in tests/datorama-periods.test.mjs cover calendar boundaries, leap years, MTD and custom ranges, monthly coverage, missing versus zero values, reconciliation, authorization, duplicate parameters and error redaction. Full npm test and Next.js build run in CI. Use synthetic fixtures in public tests. No production data is stored in this document or test fixtures.

Lead-to-policy conversion uses EIP leads as the denominator, matching the source closing ratios. Gross and approved rates are separate, with MS, MA and combined MS+MA rows. Rates use summed policy counts divided by summed EIP leads (not averaged daily rates or unique-person conversion). Missing numerator or denominator values suppress the rate; either incomplete period suppresses the percentage-point change. Zero EIP leads has no rate. Lead-created dates and cohort maturity still apply.
