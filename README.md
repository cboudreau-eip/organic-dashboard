# Organic Growth

Next.js App Router application for the existing Organic Growth prototype.

## Local development

Use Node.js 22 or newer. Run `npm ci`, then `npm run dev` and visit http://localhost:3000.
Run `npm run build` for a production build; `npm start` serves that build.

## Routes and implementation

- `/`: React login preview. No authentication provider is connected.
- `/dashboard`: interactive dashboard with synthetic data only.
- `/index.html` and `/dashboard.html`: redirects for previous URLs.
- `components/Login.jsx`: login component.
- `components/dashboard/Dashboard.jsx`: React lifecycle boundary for the prototype.
- `components/dashboard/runtime.js`: preserved demo calculations and rendering.
- `components/dashboard/markup.js`: trusted static dashboard shell.
- Route styles are scoped to prevent login/dashboard CSS collisions.
- `legacy/`: original static files retained as migration references; Next.js does not serve them.

The dashboard still uses its existing imperative renderer within a React-owned boundary. It is not yet decomposed into React chart/table components. Event listeners are scoped to the dashboard and removed on unmount. Existing saved views remain browser-local. Browser storage on the old GitHub Pages origin does not transfer to a Vercel domain.

## Vercel

Import this repository, select the Next.js framework preset, and leave the root directory at the repository root. Use the default build/output settings. No environment variables are required for the demo. No deployment or provider configuration is included in this migration.

This is a server-capable Next.js app, not a GitHub Pages static export. The existing GitHub Pages deployment remains a separate static prototype until hosting is switched; do not use its branch-root publishing workflow to deploy this app.

## Authentication and data

The login screen remains a preview, and `/dashboard` is public sample data. This migration does not add access protection, database connections, or live PostHog data. Configure authentication and enforce authorization in backend/database access before adding private data. Keep service credentials out of public client configuration.
