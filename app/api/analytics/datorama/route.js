import { serverAuth } from '../../../../lib/auth/server';
import { isTeamUser } from '../../../../lib/auth/config';
import { datoramaSnapshot } from '../../../../lib/datorama/snapshot';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
const reply = (body, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } });
export async function GET() {
  const client = await serverAuth();
  if (!client) return reply({ error: 'Sign in to view imported reports.' }, 401);
  const { data, error } = await client.auth.getUser();
  if (error || !isTeamUser(data.user)) return reply({ error: 'Sign in to view imported reports.' }, 401);
  try {
    const snapshot = datoramaSnapshot();
    return snapshot ? reply(snapshot) : reply({ error: 'No Datorama snapshot has been imported.' }, 404);
  } catch { return reply({ error: 'The imported report could not be loaded.' }, 503); }
}
