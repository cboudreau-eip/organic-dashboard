# Work queue page assessments

Opening a task explicitly (calendar link, task row, Previous/Next, or suggested task)
loads its saved assessments and prepares its first result automatically. Merely
visiting Work queue does not generate assessments for every task. Readers can view
results; analysts/admins can generate. Failed attempts require an explicit retry.

The server reads the task and current source-plan edits, not client-supplied page
content. It reads the target MedicareFAQ page, discovers up to three related pages,
searches Medicare.gov/CMS.gov and directly retrieves up to three supported official
documents. Missing sources are explicit. Proposed changes reference supplied
passages where available; uncited tasks are always marked for verification and
cannot claim official support. Suggested links must be retrieved related pages. Recommendations remain
AI-assisted editorial proposals, not verified medical advice or publication approval.
A separate model review corrects the initial proposal before it is saved or offered
for use. The review uses Sonnet 4.5 by default (`WORK_ASSESSMENT_REVIEW_MODEL`
can override it); source search and drafting retain the existing model setting.
Conditional questionnaire branches cannot establish general eligibility.
Combined questionnaire answers are excluded from citation evidence. The independent
reviewer receives candidate section names rather than the draft's replacement prose.
Failure of either generation or review leaves no usable new proposal. A versioned
fingerprint invalidates results made before these review rules were introduced.
One bounded formatting repair can correct invalid references or oversized fields
after review; it cannot bypass the final validation or substitute the raw draft.

Results are stored separately in `content_work_assessments`, with RLS reads matching
the existing team roles and server-only writes. Each attempt retains its timestamp,
input fingerprint, status and generated evidence. A unique running-task index prevents
concurrent generation for one task. Abandoned jobs expire after five minutes; generation
is limited to 12 attempts per user per hour. Successful results are reused for seven
days when the saved instructions, current assignment and source-date metadata match.
Live page changes within that window require **Reassess page**. This is not a scheduled
crawler or an automatic refresh of analytics integrations.
Existing results that become stale ask for **Reassess page** rather than automatically
spending again when the editor saves an adopted brief or changes instructions.

No generation path writes `content_work_pilots` or `proposed_content_plans`. **Add proposal
to my instructions** appends text to the unsaved editor only. The user can edit, discard,
or save through the existing optimistic-version save flow. It never replaces existing
instructions automatically. The complete source queue and calendar are checked before
and after the live workflow test. Refreshing an assessment retains older versions.

Deployment requires applying `20261123162754_work_page_assessments.sql` first. Uses the
existing server-side Anthropic and Supabase service-role configuration; no browser
credentials or new public access are introduced. Endpoint: `/api/content-work/assessment`.

## Outstanding-item verification

**Verify outstanding items** processes flagged recommendations and the publication
checklist. Two bounded searches discover official sources; up to six allowlisted
government HTML or PDF documents are read directly. PDF.js extracts bounded documents
(8 MB, 100 pages, 20-second parsing budget); up to 14 relevant complete pages include
neighboring pages for table conditions. Saved references include PDF page numbers and
document page labels. Search excerpts, unreadable documents and flattened eligibility
questionnaires cannot establish support. Retrieval attempts and failures
are retained. A separate model review must agree that the exact official passages
support every material qualification in a ready instruction. Page-observation checks
can cite actual target text, while factual rules require government evidence. A
Partially resolved result saves a narrow supported instruction and a separate unanswered
question; it remains eligible for verification. Unsupported instructions stay out of
the Ready to implement brief. Existing results do not anchor reruns: only the original
questions are supplied with fresh evidence. This does not certify publication readiness.

Each run creates a new assessment with a parent ID, per-item evidence and decisions,
and a corrected Markdown brief. The old outline is replaced to avoid retaining its
unverified claims. Previously resolved decisions survive a retry of remaining items.
The server binds verification to the current saved assessment and checks the task
fingerprint again before saving. Existing role/origin checks, rate limits and the
single-running-job lock apply. Neither calendar rows nor saved editor instructions
are written. Adding a corrected proposal is still a separate unsaved editor action.
