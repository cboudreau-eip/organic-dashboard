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
