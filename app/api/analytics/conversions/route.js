import { serverAuth } from '../../../../lib/auth/server';
import { isTeamUser } from '../../../../lib/auth/config';
import { organicOverview } from '../../../../lib/posthog/server';

export const dynamic = 'force-dynamic';
const reply = (body, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } });
export async function GET(request) {
  const client = await serverAuth();
  if (!client) return reply({ error: 'Sign in to view analytics.' }, 401);
  const { data, error } = await client.auth.getUser();
  if (error || !isTeamUser(data.user)) return reply({ error: 'Sign in to view analytics.' }, 401);
  const days = Number(new URL(request.url).searchParams.get('days') || 7);
  if (![7, 28, 30].includes(days)) return reply({ error: 'Choose 7, 28, or 30 days.' }, 400);
  try { return reply(await organicOverview(days, 'conversions')); }
  catch (error) { return reply({ error: error.message }, 503); }
}


