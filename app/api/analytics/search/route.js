import { serverAuth } from '../../../../lib/auth/server';
import { isTeamUser } from '../../../../lib/auth/config';
import { searchPerformance } from '../../../../lib/gsc/server';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
const reply = (body, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } });
export async function GET(request) {
  const client = await serverAuth();
  if (!client) return reply({ error: 'Sign in to view search performance.' }, 401);
  const { data, error } = await client.auth.getUser();
  if (error || !isTeamUser(data.user)) return reply({ error: 'Sign in to view search performance.' }, 401);
  const days = Number(new URL(request.url).searchParams.get('days') || 7);
  if (![7, 28, 30].includes(days)) return reply({ error: 'Choose 7, 28, or 30 days.' }, 400);
  try { return reply(await searchPerformance(days)); }
  catch { return reply({ error: 'Google Search Console data is unavailable. Try again shortly; if this continues, check the GSC connection.' }, 503); }
}
