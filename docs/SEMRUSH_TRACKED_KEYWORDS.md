# Semrush tracked keywords
First release: Excel/CSV preview, authorized persistent imports, duplicate prevention, paginated history and keyword search, sort, observed-position comparison.
Open Acquisition, then Tracked keywords. Existing Growth Hunter members can view. Analysts/admins can save; existing feature gates apply.

Upload original MedicareFAQ Position Tracking Rankings Overview export (up to 5 MB XLSX; 2 MB CSV; 5,000 keywords). Keep metadata ID, report type, period and the supplied twelve headers. Enter actual campaign location/device/search engine and attest cleared filters. Preview before saving.
The browser reads the workbook; server revalidates worksheet rows. No workbook or customer dataset is committed to GitHub. Stored snapshots are immutable to application roles. Identical inputs/settings are rejected by a generated content fingerprint.

The date column is an observation date. Report comparison start remains metadata, not an inferred prior rank. Original differences and share of voice are retained without interpreting unverified units/sign. Numeric position display is limited to 1–100. Empty, dash, n/a, zero, 101 and >100 markers remain unavailable with raw source preserved. Two saved snapshots compare only matching campaigns/location/device/engine and strictly increasing dates. Absent keywords are not zero ranked.

This first release does not automate Semrush, create Growth Hunter tasks or backfill history. Intended target mapping is not yet implemented. The supplied October 22 workbook could not be read in the agent environment; acceptance against that actual export is pending user upload into this browser flow. Synthetic XLSX fixtures and API validation are covered in tests/semrush.test.mjs.

Supabase migration version was copied from hosted migration history after applying through the authorized connector because the local CLI cannot start. Access uses existing growth_access membership and gate; no service key required.
