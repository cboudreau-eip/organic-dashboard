# Top-20 validation and content assignments

Content Plan → Content assignments validates the top 20 from a completed research run. It consolidates canonical target pages, retaining every original question and its separate source evidence. It does not generate articles, briefs, outlines or a calendar.

Validation reads up to three MedicareFAQ pages per assignment and runs one bounded independent web search through the configured Anthropic account. Search citations are a limited sample, not measured Google/Bing rankings. Exact quotations are checked against the supplied page text before a proposed change can be retained. Source metrics keep their original research dates; validation does not refresh those imports.

Ready for review means the required checks passed, not that content is approved. Missing pages, unsupported findings, stale supporting evidence or unavailable search results remain Needs research. Existing coverage can yield No change suggested. Keep is available only for Ready for review; all completed assignments can be deferred, rejected or left for review.

Progress saves after each two-assignment batch. Keep the section open until completion, or resume later. A server lease prevents concurrent tabs repeating a batch. Loading completed validation does not call AI again. Retry failed checks creates a new snapshot, retaining successful assessments and retrying only failed checks. Review decisions are versioned and tied to their validation snapshot; they are not automatically carried into a retry.

Only authorized analysts/admins can run checks or save decisions. Verified viewers can inspect results. Completed snapshots are immutable. The schema is in `20261113174628_research_validation_assignments.sql`.

Remaining milestones include review of proposed assignments, refreshed evidence collection, scheduling constraints and explicit authorization to generate a calendar. No calendar or publishing automation is enabled here.
