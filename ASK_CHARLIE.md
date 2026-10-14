# Ask Charlie

Authenticated same-origin POST `/api/chat` uses Anthropic Messages with server-only `ANTHROPIC_API_KEY`. Optional `ANTHROPIC_MODEL` defaults to `claude-haiku-4-5-20251001`. No API keys or provider errors are returned to the browser. Provider data retention follows the Anthropic account terms. No automatic OpenAI fallback is used.

Each request sends the user's bounded conversation and aggregated PostHog overview/landing-page/trend and GSC reports to Anthropic. It does not send credentials or Supabase user identity. The UI discloses this transmission. Chat has its own 7/28/30-day selector; changing it or starting a new chat clears history and cancels the browser request. No browser-persisted conversation storage. Prior assistant answers are not treated as evidence. Conversion/CRM data is intentionally excluded pending validation.

Reports retain individual source periods, timezone, caching, and coverage restrictions. Unavailable sources are explicit. No sample fallback, arbitrary queries, write tools, or browser access. Model answers render as text, never HTML.

Authentication, input size/role checks, output limits and timeouts bound requests. The per-process 10/minute/user limiter is best-effort, not a global spending cap; set an Anthropic project budget for cost control.

Tests: `npm test`, `npm run build`, `node scripts/test-auth-flow.mjs`. Optional `--chat` performs a real Anthropic request with the ignored local credentials and analytics; `--serve` retains the isolated mock-login fixture for UI checks.

API reference: https://platform.claude.com/docs/en/api/messages
