# Growth Hunter foundation: setup and validation

## Delivered scope

This increment adds a disabled-by-default Growth Hunter dashboard section, authenticated snapshot API, strict GSC Pages CSV preview/import, PostgreSQL persistence and database-enforced membership. Snapshot records and audit events are immutable to application users. Identical normalized imports return the existing snapshot ID; different evidence for the same dates remains separate. A bounded manual decline detector compares saved snapshots and persists findings. Review approvals, background jobs, live GSC snapshot capture and weekly scheduling are not implemented.

The application still uses its existing Supabase session client and publishable key. Do not introduce a service-role key into the browser or the import route. PGlite is a development-only PostgreSQL test dependency, not a replacement application database.

## Configuration gate

October 19: both migrations are applied to the existing organic-dashboard Supabase project. The verified owner account has analyst membership, and hosted SQL permission/calculation checks passed with all test data rolled back. The database flag remains false. Vercel project access returns a team-scoped 403, so application configuration, build, deployment and browser verification are pending. See PROGRESS.md for exact evidence and limitations. The steps below describe setup on a new target; do not reapply existing migrations.

Before activation, an administrator must identify an isolated development/staging Supabase target and inspect its existing schema. The migration intentionally creates new `growth_` objects without dropping or overwriting existing objects; a conflicting name should stop setup for investigation.

1. Confirm the intended development/staging project and its backup/restore approach. Inspect existing tables, policies, grants and functions with the `growth_` prefix. Do not apply this migration blindly to production.
2. Review and apply `supabase/migrations/20261019145752_growth_foundation.sql` followed by `supabase/migrations/20261019145804_growth_declines.sql`, using an authorized database administration connection or Supabase SQL editor. The migration is transactional and starts with `growth_settings.enabled=false`.
3. Find the intended existing user's UUID in Supabase Auth. Add an explicit membership with an administrative SQL command. For example, replace the placeholder UUID in the following statement before execution:

```sql
insert into public.growth_members (user_id, role, active)
values ('REPLACE_WITH_VERIFIED_AUTH_USER_UUID'::uuid, 'analyst', true);
```

`viewer` can inspect evidence; `analyst` and `admin` can import and run decline comparisons. `admin` can also read audit records through database policy. No UI for granting roles or review/publishing capabilities exists yet. Membership is managed by the database administrator, not user-editable profile metadata.

4. Enable the database gate with `update public.growth_settings set enabled=true where id=true;` on the reviewed target. Set server-only `GROWTH_HUNTER_ENABLED=true` in that environment. Both gates must permit access. Retain the existing Supabase environment names and set `SITE_URL` to the actual dashboard origin for mutation origin checks.
5. Sign in as the authorized member. The Growth Hunter navigation item appears only after server-side membership validation. Import an authorized GSC Pages export, preview it, save it, reload and inspect it from a second permitted account. A viewer must be unable to import; a nonmember must be unable to read or import even through direct requests.
6. Test disablement and membership revocation through both the app and Supabase REST/RPC. Complete the normal CI build, auth smoke test and real browser checks before release. Production migration, deployment and schedule activation remain separate actions.

The application environment flag controls app routing/navigation. The database flag independently controls direct Supabase access. For a full feature shutdown, disable **both**, particularly the database flag. Removing the navigation item alone is not access control.

## Import contract

- Supported input: aggregate GSC Web search Pages CSV for `https://www.medicarefaq.com/`, without country/device/page filters, with exact reporting dates supplied by the user. Source scope and dates are user declarations, not verified against Google.
- Header set, in any order: `Top pages, Clicks, Impressions, CTR, Position`. Additional columns and other datasets are rejected. This does not ingest raw visitor exports or beneficiary records.
- Positive impressions; whole, nonnegative clicks no greater than impressions; CTR with `%` consistent with counts (rounding tolerance); average position at least 1. Stored CTR is recomputed per page. No site totals are inferred from page rows.
- Complete Pacific reporting dates, at most 366 days; up to 2,000 unique pages and 1 MB. UTF-8/BOM, standard quoted cells and CRLF are supported. Thousands separators and localized number formats are rejected with an explicit error.
- HTTPS URLs must use the exact property host. Query strings, fragments, credentials and duplicate normalized URLs are rejected. All rows must validate; no silent row dropping.
- Only validated metrics and provenance fields are persisted. Original CSV bytes and filenames are not stored. Coverage is explicitly `manual_pages_export_not_exhaustive`; absence does not mean zero performance. Decline comparisons require adjacent equal periods of 7, 28, 56 or 84 days, with user-confirmed matching scope. Historical findings are dated and do not establish present-day eligibility for edits.
- Preview is non-mutating. Commit validates again on the server and again inside the database transaction. The server streams and bounds request size rather than trusting Content-Length alone.
- SHA-256 of canonical JSON identifies identical imports, independent of row order and filename. A successful new insert and its audit record commit atomically. Snapshots do not contain approval or implementation status.

## API

- `GET /api/growth-hunter/snapshots`: newest 50 metadata records for authorized members.
- `GET /api/growth-hunter/snapshots?id=<uuid>`: one saved snapshot, protected by membership and RLS.
- `POST /api/growth-hunter/snapshots`: `{csv,start,end,mode}` with mode `preview` or `commit`, authenticated analyst/admin and exact configured Origin required.
- Responses are `private, no-store`. Disabled application gate returns 404; unauthenticated returns 401; missing permissions returns 403; storage setup/provider failure returns a safe 503. No provider details or credentials are returned.

- `GET /api/growth-hunter/runs`: newest 20 saved research reports for members.
- `POST /api/growth-hunter/runs`: `{priorId,currentId,scopeConfirmed:true}`; analyst/admin and matching Origin required. Reuses the saved run for an identical snapshot pair and detector version.

## Tests and limits

`npm test` includes existing tests, contract/HTTP authorization tests and the actual migration executed in PGlite. The database test models Supabase's `auth.users`, `auth.uid`, `anon` and `authenticated` roles, verifies RLS and direct-write denial, tests malformed imports and duplicate handling, closes/reopens the database, and confirms another permitted identity sees the same snapshot. It also verifies feature disablement and membership revocation. It does not verify hosted Supabase Auth/PostgREST behavior or truly concurrent PostgreSQL sessions; those require staging.

In environments blocking subprocess creation, `node --test --test-isolation=none tests/*.test.mjs` can run the same suites without child processes. CI retains normal process isolation and runs the build and existing mock-auth HTTP script. The CI definition is added locally; no remote CI run is claimed until pushed and observed.

## Disablement and rollback

Disable the database flag first, then the application flag, to stop direct database imports and reads as well as app access. Revoke individual membership with `active=false`. Existing snapshots remain stored. Do not delete them as a feature rollback. The migration is additive; a future cleanup or schema correction needs a reviewed backup and migration. An administrator can recover records outside app permissions, so client-level immutability is not a claim of tamper-proof storage against database owners.

## Next increment

Complete the hosted app and browser verification for the implemented snapshot comparison. Then add immutable recommendation revisions, explicit scoring examples, exact-plan approvals and task export. Baselines and actual implementation records follow in that same first complete workflow. Do not present the evidence foundation as a complete research pilot.
