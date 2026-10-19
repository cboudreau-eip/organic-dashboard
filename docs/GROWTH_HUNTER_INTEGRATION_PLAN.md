# Growth Hunter: architecture audit and integration plan

Date: October 16, 2026
Status: Audit complete; proposed implementation plan, no feature code implemented.
Repository: `cboudreau-eip/organic-dashboard`
Audited branch: `codex/nextjs-migration`
Audited commit: `4d1c90f`

## 1. Direction and scope

Add Growth Hunter as a bounded module inside Organic Dashboard. Reuse existing authentication, source clients, npm conventions, CSS, and hosting patterns. The October 16 integration handoff defines the pilot; the original production blueprint supplies longer-term context. Its standalone setup, replacement authentication, ORM, package manager, and broader feature list do not override the handoff.

The pilot must produce recommendations Charlie can inspect, trust, and assign. Its complete workflow is source snapshots -> deterministic findings -> scored opportunity and concrete plan -> revision-specific review -> Markdown task package -> verified implementation and baseline -> frozen summary and outcome status.

Scope includes three opportunity families: existing-page declines, striking-distance page/query pairs, and new keywords checked against existing content. Give both existing and new opportunities meaningful research attention without a forced 50/50 recommendation quota.

This audit inspected tracked application code, documentation, tests, installed framework guides, Git state, and dependency metadata. No production service health, database schema, deployment settings, API entitlements, or historical source coverage was verified remotely. No credential values were read or printed. The working tree was clean at the start.

## 2. Verified local architecture

| Capability | Evidence in repository | Integration decision |
| --- | --- | --- |
| Framework | `package.json`: Next.js 16.4.0, React 19.3.0; App Router; JavaScript/JSX; npm lockfile | Retain framework and npm. No whole-app TypeScript migration prerequisite. |
| Authentication | `lib/auth/server.js`, `lib/auth/config.js`, `proxy.js`: Supabase SSR, server-side `getUser`, verified nonanonymous email check | Reuse identity/session flow; add action-specific membership and permissions for Growth Hunter. |
| Authorization | Any verified nonanonymous email user in the configured Supabase project passes `isTeamUser`; no app roles or membership tables found | Existing sign-in is insufficient to authorize approvals. Enforce explicit read/run/review/verify/admin capabilities on server and database. |
| GSC | `lib/gsc/server.js`: read-only service-account token, final Web data, current/prior totals, daily site trend, separate current top-100 query and page lists; direct page totals | Extend shared client for bounded page/query and historical acquisition. Keep current UI response contracts stable. |
| PostHog | `lib/posthog/server.js`, `query.js`, domain query modules: aggregate traffic, engagement, conversions and direct page lookups; bounded process cache/retries | Reuse transport and definitions; add explicit snapshot/date-range adapters. Do not rerun full dashboard reports per candidate. |
| Semrush | `components/dashboard/runtime.js`: source card explicitly says Not connected; no client or import implementation found | Start with validated aggregate keyword CSV imports. API capability requires separate entitlement/budget verification. |
| Datorama | `lib/datorama/snapshot.js`: server-side compressed environment snapshot | Historical context only. It is not a database, live feed, or compatible lead denominator. |
| Ask Charlie | `app/api/chat/route.js`, `lib/chat.js`: Anthropic narration grounded in current aggregate reports; user-scoped local chat history | Reuse evidence conventions. Keep scoring/workflow independent; optional structured narration later. |
| Persistent application records | No application database schema, migrations, repository layer, or database queries found; chat history is browser-local | Add persistent snapshots, revisions, decisions, implementations and reports. Supabase Auth use does not prove database readiness. |
| Background execution | Analytics are request-driven; cache, concurrency and chat limits are process-local; no durable jobs/scheduler found | Add persisted manual runs and recoverable worker execution before weekly activation. |
| UI | `Dashboard.jsx` mounts React report portals into markup controlled by `runtime.js`; current navigation: Overview, Acquisition, Leads & funnel, Data sources | Add a React-owned Growth Hunter host using existing style tokens. Do not place workflow logic in imperative renderer. |
| Tests/CI | Node test runner, jsdom, mock-auth HTTP script; no tracked CI workflow, lint script or dedicated typecheck configuration | Retain regression tests; add focused database/workflow/UI tests and CI during implementation. |
| Hosting | README describes Vercel deployment from current branch and separate public GitHub Pages prototype; `next.config.mjs` redirects legacy URLs | Verify actual deployment settings before release. Keep business data out of public/static previews. |

### Documentation drift

README still describes sample charts and native bounce metrics. Current runtime exposes source-backed views only, and current engagement code reports a custom single-page session rate. GSC.md says top 20 rows; current code requests top 100. ASK_CHARLIE.md mentions top 10 contact pages; code returns up to 100. These documents need reconciliation during implementation. Local code is the authority for this audit, not those older descriptions.

## 3. Data constraints that affect recommendations

1. **Separate query and page lists cannot establish query/page relationships.** Current GSC lists are current-period top 100 only. Add paired page/query records, compatible prior windows, bounded pagination, and coverage metadata. Pagination still cannot guarantee complete GSC query coverage.
2. **Current windows are limited.** Both integrations expose 7/28/30-day reports. The UI has no 56/84-day or year-over-year historical registry. Source history availability remains unverified. Build explicit start/end snapshot acquisition without silently changing dashboard selectors.
3. **Source calendars differ.** GSC uses Pacific dates and latest finalized data; PostHog reporting uses New York complete days. Store each source's exact boundaries and timezone. Never equate daily clicks and sessions or present their windows as identical.
4. **Traffic and conversions use different cohorts.** Traffic filters to GTM/CDN events. Custom engagement measures CDN sessions and duration coverage; conversions use organic landing sessions and cross-domain form events without the same CDN restriction. Preserve independent metric-definition versions and denominators.
5. **Lead qualification remains unavailable in current PostHog code.** Contact-submission sessions, raw contact events, ZIP starts, ordered completions, and phone clicks are distinct. Phone clicks are not completed calls. Page conversion context cannot identify which organic query generated a lead.
6. **Session metric fallback deserves explicit lineage.** `withEngagement` replaces native session counts with custom measured-cohort totals when available, while retaining native totals when engagement is unavailable. Growth Hunter must store which definition supplied each value and block comparisons across differing definitions.
7. **Missing rows need source-specific meaning.** GSC site totals currently use zero counts when no row is returned; direct page lookup returns null. New detectors must preserve whether absence means unavailable, omitted, or validated zero and cannot infer a decline from table absence.
8. **There is no known full content inventory in this application.** A GSC top-pages list cannot substitute for all URLs and their content intent. Capture URL/canonical/title/H1/topic/content evidence and its completeness. Insufficient evidence yields overlap-review status, not a definitive new-page instruction.

## 4. Proposed boundaries and architecture

Use the existing dashboard shell with one Growth Hunter navigation item. Within that React module provide Opportunities, Runs, Reviews, Implementations, and Reports as focused subviews. Add a new portal host and lifecycle wiring in `Dashboard.jsx`, `markup.js`, and `runtime.js`; preserve existing reports and Charlie lifecycle. UI persistence is authoritative on the server, not localStorage.

| Proposed path | Responsibility |
| --- | --- |
| `components/growth-hunter/` | Queue, evidence/detail view, plan review, run state, implementation record, reports |
| `lib/growth-hunter/contracts/` | Runtime input/output schemas, metric definitions, snapshot contracts |
| `lib/growth-hunter/sources/` | Adapters around shared GSC/PostHog services; Semrush import and content inventory |
| `lib/growth-hunter/detection/` | Three pure detector modules; overlap evidence; deduplication/conflict handling |
| `lib/growth-hunter/scoring/` | Versioned rubrics, deterministic score, confidence, explanation |
| `lib/growth-hunter/repository/` | Server-only persistence, safe DTOs, transactional commands |
| `lib/growth-hunter/workflow/` | Review, exact-revision approval, implementation verification, audit |
| `lib/growth-hunter/reporting/` | Frozen executive summary and Markdown task/report exports |
| `lib/growth-hunter/jobs/` | Persisted run stages, retry rules, checkpoint/resume and worker adapter |
| `app/api/growth-hunter/` | Thin authenticated, feature-gated routes for reads, imports, runs, decisions and exports |
| `supabase/migrations/` | Proposed additive application tables, RLS policies, indexes and transactional functions |
| `tests/growth-hunter/` | Detector, scoring, import, persistence, authorization, workflow and UI coverage |

These paths are a plan, not instructions to create empty scaffolding. Add each with a functioning slice.

### Storage and dependencies

First verify whether the existing Supabase project can support application tables and an isolated development/staging database. Prefer its PostgreSQL and existing SDK, SQL migrations and narrowly scoped transactional functions. Do not introduce Drizzle, a second database, or Entra solely to match the original blueprint. Inspect the actual remote schema and policies before applying migrations; never assume the project is empty.

Keep npm, current CSS and the Node test runner. Add runtime schema validation at new boundaries after verifying compatibility. Use checked JSDoc or scoped TypeScript for new domain contracts as an implementation decision; do not claim current JavaScript has strict TypeScript coverage. Add lint and browser tests proportionately. Evaluate a durable runner when implementing jobs; the vendor is unresolved, and Inngest is not pre-approved.

### Minimal persistent model

- Project membership/capabilities and versioned configuration, including server-enforced feature enablement.
- Imports/source snapshots: source, schema/definition version, dimensions/grain, property, timezone, date boundaries, retrieval time, digest, completeness and rejected-row counts. Persist validated aggregate records behind immutable snapshot IDs.
- Runs/run steps: frozen configuration and inputs, idempotency key, state, lease/checkpoint, attempts, errors and budget usage.
- Opportunities/immutable revisions: stable fingerprint, detector version, exact evidence, feature inputs, score version, confidence, concrete action plan and conflicts.
- Decisions: actor, exact revision and plan hash, decision, reason, time and concurrency precondition.
- Implementations/evaluations: actual affected URLs, change description, verified go-live evidence, prepared baseline and frozen eligible baseline, confounders, outcome windows/status.
- Reports/audit events: immutable report content with snapshot references; append-only workflow and permission history.

Use additive `growth_`-prefixed tables where practical. Unique keys enforce duplicate boundaries. Approval and decision append occur in one transaction, with the current revision checked again inside that transaction. Enforce authorization in the database as well as route handlers. Protect privileged worker credentials separately from browser clients. Add rollback/disable procedures and a local/staging migration test before any production schema change.

### Run and review behavior

Opening the module reads saved results only. Explicit Run starts a durable job, returns an ID, and exposes progress. Workers checkpoint each stage, enforce persisted concurrency/budget limits, and resume safely after failure. A process-local Map and a long route timeout are not durable execution.

Feature disablement applies to APIs, exports and jobs as well as navigation. Signed-in users without granted Growth Hunter membership/capabilities cannot use the module. Mutations use origin/CSRF controls, bounded schemas, idempotency and revision checks. Untrusted source text never authorizes execution.

Prepare the full plan and baseline evidence before review. Approve, reject, defer and request-changes reference the exact revision. Editing scope requires new approval. Exporting a task does not mark implementation complete. Verified implementation freezes eligible pre-change evidence and starts measurement. Missing retrospective baseline evidence is explicitly insufficient, never reconstructed as certainty.

## 5. Smallest complete workflow

Start with **one existing-page decline** sourced from validated GSC page comparisons, with optional compatible PostHog conversion context. Use imports if live source configuration is unavailable. Persist evidence, explain the decline and unknowns, create a concrete task plan, review it, export it, record actual implementation and preserve its baseline. Produce a frozen report with outcome status pending or insufficient data as appropriate.

This slice is complete only when it survives reload/restart and a second authorized reviewer can inspect the same evidence and decision. It needs no LLM to calculate scores, no paid Semrush request, and no website publishing. Extend the same pipeline to paired-query striking-distance and keyword import/inventory research to complete the three-family pilot.

## 6. Phased delivery and acceptance gates

| Milestone | Deliverable | Dependencies | Acceptance evidence |
| --- | --- | --- | --- |
| M0: Audit and plan | Current architecture, gaps, boundaries, decisions | None | This document and baseline checks; completed locally |
| M1: Persistence and access | Additive schema, memberships, feature gate, validated snapshot/import path, run records, CI foundation | Confirm safe database development target | Anonymous/nonmember/disabled access denied; atomic malformed-import rejection; duplicate input deduped; reload/restart preserves records; migration/RLS tests |
| M2: First complete path | Decline detector, explicit scoring rubric, evidence/detail, plan review, task export, implementation/baseline record and frozen summary | M1 | One real authorized dataset yields inspectable work; fixtures remain isolated; identical rerun is stable; revised plan invalidates approval; concurrent review cannot duplicate work; export is not implementation |
| M3: Full pilot research | GSC page/query history, striking-distance detector, Semrush CSV, content inventory and new-keyword classification | M2; source coverage sufficient per detector | Known existing page reclassifies keyword; sparse/ambiguous evidence abstains; separate streams visible; scores reproducible and comparable; conflicting actions surfaced |
| M4: Recoverable execution and results | Source refresh adapters, durable worker, manual runs, evaluation snapshots and report archive | Persisted run model; worker choice and approved resources | Failed stage resumes without duplicate commits; repeat starts collapse; persisted budgets bound calls; source outage degrades only supported paths; historical reports remain unchanged |
| M5: Owner pilot and release readiness | Assignable recommendation review, keyboard/error-state checks, staging verification, runbooks and backup/restore proof | M1-M4 and resolved operational gates | Charlie can select and assign useful tasks; no regression to existing reports/login/chat; build/CI/E2E pass in unrestricted environment; explicit release decision |

Manual imported-data processing may be bounded during M2, but broad live research must use M4's durable worker. No production weekly schedule until timing, budgets, permissions and recovery behavior are agreed and verified.

### Test priorities

- Malformed numbers/columns, PII-like raw export schemas, duplicate input and conflicting dates: fail before atomic import commit.
- Source date/grain/cohort incompatibility, partial query coverage and missing conversion data: visible limitations; no fabricated zeros or leads.
- Stable detector output, threshold boundaries and equal-score ordering; new keywords are not doubly penalized for lacking site history.
- Anonymous, revoked member, viewer mutation, forged role, disabled feature and direct export/job access: fail closed.
- Stale revision, changed plan, concurrent approval, replay and duplicate job: no unauthorized or duplicate transition.
- Implementation recorded without verification or baseline: no unsupported success claim. Changed definition or overlapping intervention: flag measurement incompatibility.
- Report freeze and export escaping; hostile source text cannot change permissions, facts or workflow state.
- Existing dashboard navigation, chat, source availability and auth regressions; accessible filters, keyboard reviews and empty/error states.

## 7. Scoring decisions before ranking

The blueprint weights (30/20/20/15/10/5) are proposed defaults, not approved findings. Before M2 ranking, document explicit 0-100 feature rubrics, eligibility requirements, missing-data behavior and worked examples. Store exact inputs and independent confidence dimensions with every score.

Existing-page observed performance and new-keyword estimated demand need distinct source-aware feature calculations on a comparable decision scale. Unknown conversion performance cannot become zero business value. Do not automatically renormalize missing features to reward weak evidence. Preserve the system score separately from any reasoned human priority override. Product-line priorities and calls-versus-forms economics require current owner confirmation, not assumptions from unrelated research tasks.

## 8. Decisions and external verification

| Decision | What is already known | Next action / owner |
| --- | --- | --- |
| Database target | Supabase identity exists; application persistence absent in local code | Engineering verifies available project schema, RLS, safe local/staging target and migration access |
| Source availability | GSC/PostHog clients implemented; Semrush explicitly disconnected | Engineering performs authorized connection/history checks; Charlie supplies approved Semrush exports or confirms API entitlement if needed |
| Content inventory | No importer or full inventory found | Charlie identifies maintained content source; engineering verifies sitemap/content coverage |
| Lead definition | Contact-submission sessions and phone clicks already defined in code | Charlie/business owner confirms accepted pilot outcome labels; qualification remains unavailable until validated |
| Permissions | Existing verified users share dashboard access | Charlie identifies initial reviewer/implementer/verifier; engineering maps explicit capabilities |
| Scoring/business priorities | Weights and observation windows proposed only | Engineering presents worked scoring examples; Charlie validates priorities and effort/risk assumptions |
| Worker/schedule/budgets | No durable runner found; weekly cadence requested, timing unspecified | Engineering proposes smallest reliable runner; Charlie selects timing and operating limits before activation |
| Deployment/operations | Vercel conventions documented; actual settings not inspected | Verify branch, preview isolation, monitoring, backups and rollback before release |

These do not all block local development. Use explicit unavailable states and fixture-backed contracts while external setup remains blocked. Do not create accounts, consume new paid services or activate recurring work as a side effect of the audit.

## 9. Baseline verification and limits

- `npm test`: could not launch test subprocesses (`spawn EPERM`). This is an execution-environment limitation, not 12 observed assertion failures.
- `node --test --test-isolation=none tests/*.test.mjs`: **35 passed, 0 failed**. Reduced-isolation execution is useful evidence, not a replacement for normal CI isolation.
- `npm run build`: compilation succeeded; page-data worker creation failed with `spawn EPERM`. Full production build is **not verified**.
- Existing mock-auth HTTP script was inspected but not run because the build did not complete. No live provider smoke test, browser audit or remote schema inspection performed.
- No lint script, dedicated typecheck configuration or tracked GitHub Actions workflow exists. Next's brief TypeScript build phase is not evidence of strict type coverage.
- Installed Next route-handler and data-security guidance was consulted. New private operations must authorize at the server data boundary, independent of page-level access and navigation visibility.

## 10. Deferred work

Automated publishing/PR creation, additional detector families, adaptive scoring, predictive models, CRM/call integrations, multi-brand support and replacement infrastructure remain outside the initial pilot. Collect trustworthy decision and outcome history now so later learning has evidence. Approval alone is never a successful business outcome.
