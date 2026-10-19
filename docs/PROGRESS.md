# Growth Hunter progress

## October 19, 2026: preview source publication underway

- GitHub browser sign-in restored repository write access. Created codex/growth-hunter-preview-20261019 from production head 4d1c90f. Source, API, UI, tests and migration files are being committed through the authenticated GitHub upload UI.
- Production branch remains unchanged. Remote CI and preview verification are pending; Growth Hunter remains disabled.

## October 19, 2026, afternoon: preview release prepared; GitHub write access blocked

- Confirmed the current production branch is codex/nextjs-migration at 4d1c90fdcf6c2ef52f3ef67420baf94e6a302f06. Vercel browser access works.
- Prepared 28 explicit Growth Hunter source, test and documentation files; local credentials and unrelated assets are excluded. Added preview branch matching to CI push triggers.
- Attempted to create codex/growth-hunter-preview-20261019 from the verified production commit using GitHub. GitHub rejected it with HTTP 403, Resource not accessible by integration. No branch, commit or deployment was created.
- Browser fallback reached GitHub sign-in. Awaiting the user to sign in with repository write access before source upload and remote build can continue.

## October 19, 2026: hosted database ready; application release blocked

- Applied foundation and decline migrations to the existing, inspected Supabase project `organic-dashboard` (`xjhwhlzaikukpfvuxbvh`). Public schema was empty before setup. Hosted versions: `20261019145752_growth_foundation`, `20261019145804_growth_declines`. Local filenames now match hosted history.
- Added manual, deterministic decline research over two immutable GSC page snapshots, persistent run reuse, a gated API and dashboard findings panel. Requires adjacent, equal 7/28/56/84-day periods and explicit matching-scope attestation. Missing pages are excluded, not zero-filled. Findings retain evidence, thresholds and seasonality/causality limitations.
- Granted analyst membership to the verified existing `cboudreau@teameip.com` Auth user. Database rollout remains disabled until the application is built and verified.
- Executed the actual hosted database functions in a rolled-back transaction: import validation/deduplication, decline arithmetic, excluded missing pages, idempotent runs, invalid scope/windows/IDs, viewer/anonymous/revoked-member restrictions and direct-write denial passed. Verified afterward: zero snapshots, zero runs, zero audit events, database flag false.
- Six local contract/API check groups passed in-process (four existing import/access checks and two new run endpoint checks). Added repeatable SQL checks and a PGlite test wrapper for CI. The new PGlite wrapper itself could not run here: WebAssembly generation is disabled in the Node tool. No full-suite result is claimed for this date.
- Full build and JSX compilation remain unverified: command runner fails before process creation with a Windows sandbox backend error; in-process Next SWC loading failed with `exports is not defined`. No browser end-to-end result is claimed.
- Vercel project listing works, but scoped project inspection returns HTTP 403 for team `elite-insurance-partners` (`team_wqAbpobSWCLfGVtqSUc1dWVQ`). Local CLI fallback also cannot start because of the sandbox error. No Vercel environment settings, deployment, commit or push changed.
- Supabase security advisors: RLS-without-policy on settings/members is intentional deny-by-default; three signed-in SECURITY DEFINER RPC notices correspond to intentionally exposed, identity/membership-gated functions with empty search paths and revoked anonymous execution. Existing leaked-password protection is disabled; account setting was not changed. References: [RPC advisor](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable), [RLS advisor](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy), [password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

Next: restore Vercel authorization for the exact team/project, verify hosted app environment, build and deploy a reviewed preview, enable the database gate for the controlled pilot, and test signed-in imports/research plus denial paths. Real GSC evidence import, full browser verification, concrete recommendation revisions, approval/task export, implementation tracking, the other two research families and weekly scheduling remain pending.


## October 16, 2026: first foundation increment implemented locally

Current status: **M1 partially implemented and locally validated; hosted setup remains blocked.** Read `GROWTH_HUNTER_SETUP.md` for the exact activation and staging checks. Do not treat this as the completed three-family research pilot.

- Added a server-gated Growth Hunter dashboard section with validated GSC Pages CSV preview, atomic save, duplicate detection, saved evidence list and snapshot inspection.
- Added session authentication, explicit viewer/analyst/admin membership, safe errors, bounded import bodies, origin checks, database feature gate and RLS. Existing dashboard behavior remains the default while the feature flag is false.
- Added a transactional Supabase migration for settings, memberships, immutable-to-app snapshots and audit events. Direct client writes, self-promotion, malformed metrics and unauthorized import calls are denied.
- Added exact-version PGlite 0.5.8 as a development-only test dependency. The real SQL migration passed against local WASM PostgreSQL, including access policies, rejected partial imports, deduplication, restart persistence and access by a second permitted identity. Supabase Auth roles/functions are modeled in the test, not live-verified.
- Added a GitHub Actions workflow for normal tests, build and existing mock-auth HTTP checks. It has not been pushed or run remotely.
- Validation: `node --test --test-isolation=none tests/*.test.mjs` passed **40 tests, 0 failures**. Next.js compiled successfully, but `npm run build` could not finish page-data collection because this environment blocks child-process spawning (`EPERM`). Full build, hosted database, browser visual QA and mock-auth HTTP suite remain unverified.
- Local configuration check found no Supabase URL/publishable-key pair, database URL, management token or database CLI/container tools. No hosted schema, credential, production data or deployment was changed. The feature remains disabled by default. No commit/push was made.

Next: configure an inspected development/staging Supabase target, apply the reviewed migration and grant explicit membership. Verify the app-to-hosted-database path. Continue M1 with persistent run/checkpoint records as needed for the first detector, then M2 decline detection, concrete plans, revision-scoped reviews, task exports and baseline/implementation tracking. Those workflow features are not implemented in this increment.

## October 16, 2026: audit and integration planning

Read this file and `GROWTH_HUNTER_INTEGRATION_PLAN.md` before continuing Growth Hunter work. Follow repository `AGENTS.md` and the installed Next.js guidance before code changes.

- Completed the requested local architecture audit at commit `4d1c90f` on `codex/nextjs-migration`.
- The October 16 handoff defines the pilot scope; standalone instructions in the original blueprint are superseded.
- Confirmed implemented local GSC/PostHog clients, Supabase authentication, Anthropic chat, historical Datorama snapshot support and existing React/imperative dashboard boundary.
- Identified gaps in persistent research records, permission roles, paired GSC page/query history, Semrush imports, content inventory, durable jobs and CI.
- Created a phased integration plan with boundaries, proposed persistence model, acceptance tests, open decisions and the first complete workflow.
- Validation: all 35 tests passed using Node's no-isolation mode. Normal test subprocesses and production page-data build workers were blocked by `spawn EPERM`; build compilation succeeded, full build remains unverified.
- Only planning documentation was added. No application behavior, dependencies, credentials, remote schema, production source, deployment or schedule was changed. No commit or push was made.

## Original milestone direction (retained for context)

M1: establish persistent snapshots and explicit Growth Hunter access behind a server-enforced feature gate, reusing Supabase if its database setup is suitable. First verify the safe development/staging database target and existing remote schema. Then build the existing-page-decline path through evidence, review, task export, baseline and actual implementation tracking.

External verification still needed: database setup/policies, source history and live health, content inventory, reviewer identities, approved scoring rubrics, worker resources and weekly schedule/budgets. These are not claims of missing remote infrastructure; they were not remotely inspected during this audit.
