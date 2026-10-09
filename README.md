# Organic Growth

Next.js App Router application for the Organic Growth team dashboard.

## Local development

Use Node.js 22 or newer. Run npm ci, copy .env.example to .env.local and supply your Supabase project URL and **publishable** key, then run npm run dev. Without credentials the login form is disabled and protected routes fail closed.

Run npm test for regression tests, npm run build for production, and npm start to serve it. After a build, node scripts/test-auth-flow.mjs checks real HTTP forms and cookies against an isolated local mock Auth API (ports 3002 and 3003). It never sends real emails or touches Supabase accounts.

## Authentication

- /: email/password sign-in. There is no public demo bypass or sign-up form.
- /dashboard: verified Supabase email session required on the server.
- /forgot-password: requests a recovery email without revealing account existence.
- /auth/callback: exchanges PKCE recovery codes or default invitation fragments for a cookie session. Invitation fragments landing at / are forwarded here. Invalid links show a recovery option.
- /update-password: authenticated password setup/reset, minimum 12 characters, followed by local sign-out.
- Sign out in the dashboard header revokes the current refresh session.
- Proxy refreshes cookies; requireUser checks the Auth server before protected rendering/actions. Future private API/data operations must also enforce this check and database row-level security.

### Supabase / Vercel setup

Connect the Supabase integration to the Vercel production project. Supported environment names: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_URL; NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, NEXT_PUBLIC_SUPABASE_ANON_KEY or SUPABASE_ANON_KEY. Never supply a service-role/secret key as a public key. No database password or admin key is needed for these login flows.

SITE_URL defaults to https://organic-dashboard-psi.vercel.app. Set it explicitly for another deployment. In Supabase, use that origin for Site URL and allow these exact redirect URLs:

- https://organic-dashboard-psi.vercel.app/auth/callback
- https://organic-dashboard-psi.vercel.app/update-password

For local email-flow testing, set SITE_URL to your actual localhost origin and add its /auth/callback URL to the Supabase allowlist. Preview deployments also need matching environment variables and an allowed callback URL.

In Authentication → Sign In / Providers, enable Email, disable new user signups and anonymous sign-ins, and keep email confirmation enabled. **Disabling Supabase public signups is necessary to make this team-only**, since the API is public even without a signup form. All verified email users in this Supabase project have the same dashboard access; roles are not implemented yet.

Create the first account privately in Supabase → Authentication → Users → Add user → Create new user (choose email/password and confirm the email). Alternatively, invite users so they can set their own password through the callback. Do not share passwords in chat or commit them.

Supabase default SMTP is restricted to project-team recipients and low sending limits. Configure custom SMTP before relying on invitations/reset emails for the broader team. PKCE reset links should be opened in the browser that requested them. Default Supabase email templates are supported; this application does not implement custom token_hash templates.

After deployment verify with a real account: login, refresh, sign out, direct /dashboard redirect, and an actual recovery/invitation email. Automated checks use a mock provider and do not confirm real email delivery.

## Dashboard and hosting

Charts and Ask Charlie still use synthetic sample data. Saved views are browser-local. Auth does not yet add live PostHog data or database-backed application records.

The existing imperative demo renderer lives inside a React boundary. Charlie's animations and chat remain intact. The original files in legacy/ are migration references and are not served by Next.js.

Vercel deploys codex/nextjs-migration. GitHub Pages on main remains a separate public static prototype; this login protects the Vercel Next.js application only. /index.html and /dashboard.html redirect to the current Next.js routes.

## Live organic overview (PostHog)

The Overview page now has five source-backed cards for MedicareFAQ: visitors, page views,
sessions, average session duration, and bounce rate. Its own selector supports the last
7, 28, or 30 complete calendar days (America/New_York), compared with the preceding
period of equal length. Existing filters, charts, and Ask Charlie remain explicitly
labeled sample data; they do not control the live cards.

Set these **server-only** variables in `.env.local` and in Vercel → project → Settings →
Environment Variables for Production (and Preview only if that environment should have access):

- `POSTHOG_HOST`: `https://us.posthog.com`
- `POSTHOG_PROJECT_ID`: `452683`
- `POSTHOG_PERSONAL_API_KEY`: project-restricted personal key with `query:read`

Redeploy after changing Vercel variables. Never commit the key or prefix it with
`NEXT_PUBLIC_`. The server rejects hosts/projects other than the configured MedicareFAQ
integration and checks the Supabase user before fetching or returning cached analytics.
No PostHog credential, raw SQL, or individual visitor data reaches the browser.

Source: PostHog `WebOverviewQuery`, with session `$channel_type` exactly `Organic Search`
and event `$host` exactly `www.medicarefaq.com` or `medicarefaq.com`. Other subdomains,
paid traffic, direct traffic, referral, social, and AI channels are excluded. Native
project timezone, test-user defaults, session and bounce definitions apply. These are
PostHog's standard definitions, not independently approved company KPI definitions.
Bounce-rate deltas are percentage points; other changes are relative percentages.
A zero prior value displays “No prior baseline”; null is unavailable, never zero.

A bounded five-minute server cache deduplicates queries; PostHog may also return cached
results. The UI shows retrieval/source calculation times. Failures display unavailable
cards and retry, never sample fallback values. `/api/analytics/overview?days=7` returns
401 without a verified signed-in user, 400 for unsupported periods, and 503 for provider
or configuration failures.

### Organic traffic details

The live section includes a daily organic `$pageview` trend against the preceding
period, and ten landing pages ranked by distinct visitors. Both reuse the overview's
channel/hostname filters and reporting-period selector. The daily table exposes exact
values for keyboard and screen-reader access. Landing-page visitor counts are not
additive across pages. Trends bucket by event date; sessions crossing period boundaries
can cause small differences from the session-based overview totals.

`/api/analytics/details?days=7` has the same authentication, allowed periods, provider
timeout, and private response policy as the overview. Current trend, prior trend, and
native `WebStatsTableQuery` (InitialPage) results are cached for five minutes and fetched
separately from overview cards. Incomplete daily buckets are reported as unavailable,
not filled with fabricated zeros. Existing sample workspace charts remain labeled.
