import { serverAuth } from '../../../../lib/auth/server';
import { isTeamUser } from '../../../../lib/auth/config';
import { searchPerformance } from '../../../../lib/gsc/server';
import { DateRangeError, normalizeSelection } from '../../../../lib/gsc/dates';
export const maxDuration = 120;
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
const reply = (body, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } });
export async function GET(request) {
  const client = await serverAuth();
  if (!client) return reply({ error: 'Sign in to view search performance.' }, 401);
  const { data, error } = await client.auth.getUser();
  if (error || !isTeamUser(data.user)) return reply({ error: 'Sign in to view search performance.' }, 401);
  const params = new URL(request.url).searchParams;
  try {
    const selection = normalizeSelection({mode:params.get('mode')||'rolling',days:Number(params.get('days')||7),
      compare:params.get('compare')||'previous',month:params.get('month'),start:params.get('start'),end:params.get('end'),
      priorStart:params.get('priorStart'),priorEnd:params.get('priorEnd')});
    return reply(await searchPerformance(selection));
  }
  catch (error) {
    if(error instanceof DateRangeError) return reply({error:error.message},400); return reply({ error: 'Google Search Console data is unavailable. Try again shortly; if this continues, check the GSC connection.' }, 503); }
}
