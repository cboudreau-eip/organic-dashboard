# Cohort checkpoint identity and retry safety

Checkpoint IDs serialize period.start then period.end explicitly. JSONB round trips may reorder object keys; key order must never create a new source revision. Daily values, source dates, missing values, and actual corrections still participate in identity.

The import route saves the file and its checkpoints through save_datorama_import in one transaction. Identical file fingerprints return duplicate before any checkpoint writes. Concurrent imports serialize, and stale or narrower reports cannot replace a newer import. The function is invoker-security and executable only by service_role; the route still requires the dashboard owner and same-origin requests.

Confirmed historical duplicates are retained using duplicate_of, referencing the canonical row. History queries exclude those audit copies before applying pagination or calculating changes. All original IDs, values, source dates, and capture timestamps remain intact. Do not automatically merge matching monthly totals: two genuinely different daily reports can have equal monthly sums.

## November 24, 2026 repair

Reproduced the defect from the imported workbook at export time 13:35 UTC. Original period order generated source hash 20909f28f0a384ae79b38d6dc7cb4b308084452b518e46afd0cd39ec8d69ee8b; reordered period fields generated 1d240740466492d12f9a6fc9992b06059f14b5b19ca4439dae14dfbf7c62f46d. Both had identical reports for all 23 cohorts.

The guarded repair required exactly 23 pairs with equal scope, cohort month, export time, lead coverage and complete report JSON. Only duplicate_of was set on the reordered copies. Total retained rows: 92; visible rows: 69; audit copies: 23. The hash of all original IDs and report contents remained f5851fd1d67c42ca7746995e4afc1024 before and after. The imported workbook payload was not changed.

Regression tests cover JSONB reordering, equivalent timestamp formats, real corrections, atomic rollback, retrying a file with a different export timestamp, stale writes, audit-copy retention, and access restrictions.
