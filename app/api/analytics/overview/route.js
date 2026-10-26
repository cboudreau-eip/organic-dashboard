import {periodFromParams, reportingPeriod, DateRangeError} from '../../../../lib/posthog/period';
export const maxDuration = 120;
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
  let days;
  try { days=periodFromParams(new URL(request.url).searchParams); reportingPeriod(days); }
  catch(error) { if(error instanceof DateRangeError) return reply({error:error.message},400); throw error; }
  try { return reply(await organicOverview(days)); }
  catch (error) { return reply({ error: error.message }, 503); }
}
