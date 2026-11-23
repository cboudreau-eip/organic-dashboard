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
