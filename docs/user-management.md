# Owner-only user management

`/admin` and `/api/admin/users` are restricted to the verified, active account with UUID `c8dad8c8-d33d-4b50-839f-f5d4021440dd`. Ownership is not derived from email, user metadata, or Growth Hunter role. No UI or API operation can transfer ownership or edit/disable this account.

Existing accounts were seeded into `dashboard_members` without expanding their permissions. New authentication accounts have no dashboard access until an owner operation creates their membership. General report routes, chat, login, and page authorization query current membership on every request. Disabling a user also disables Growth Hunter membership atomically; its RLS access helper checks current dashboard membership, even for an existing JWT. Data already downloaded cannot be recalled.

Available levels: dashboard only, Growth Hunter / AI viewer, and Growth Hunter / AI analyst. None grants access to user management. The owner can edit display names, levels, and enabled state. Email identifiers are shown read-only. Accounts are disabled rather than deleted to retain saved work and history.

Account creation uses the server-only Supabase Admin API to generate a private invitation link. Existing enabled accounts can get a new invite or recovery link. No email is sent automatically. Link secrets are returned only in no-store responses to the owner and kept in component memory, never database audit records or browser storage. The existing callback leads recipients to password setup. Treat links as credentials. If membership saving fails after auth creation, the unenabled account remains visible so the owner can complete setup; access fails closed.

User-management mutations enforce same-origin requests, bounded bodies, allowlisted fields, and fixed roles. The service role is instantiated only after owner authorization. Database mutation functions are service-role-only, protect the owner, use optimistic versions, and record an audit of access changes. `dashboard_members` and audit tables intentionally have no authenticated policies/grants. `dashboard_access` intentionally exposes only the caller's membership boolean through a fixed-search-path security-definer function.

Validation: `node --test tests/admin.test.mjs tests/auth.test.mjs tests/growth-contracts.test.mjs` and `npm run build`. Tests include unauthorized users, forged admin metadata, CSRF, owner lockout prevention, direct database privilege denial, stale edits, and existing-session revocation.
