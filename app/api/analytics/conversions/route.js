import {dashboardUser} from '../../../../lib/auth/access';
import {periodFromParams, reportingPeriod, DateRangeError} from '../../../../lib/posthog/period';
export const maxDuration = 120;
import { serverAuth } from '../../../../lib/auth/server';
import { isTeamUser } from '../../../../lib/auth/config';
import {after} from 'next/server';
import {readConversionReport,refreshConversionReport} from '../../../../lib/posthog/conversion-store';

export const dynamic = 'force-dynamic';
const reply = (body, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } });
export async function GET(request) {
  const client = await serverAuth();
  if (!client) return reply({ error: 'Sign in to view analytics.' }, 401);
  const { data, error } = await dashboardUser(client);
  if (error || !isTeamUser(data.user)) return reply({ error: 'Sign in to view analytics.' }, 401);
  let days;
  try { days=periodFromParams(new URL(request.url).searchParams); reportingPeriod(days); }
  catch(error) { if(error instanceof DateRangeError) return reply({error:error.message},400); throw error; }
  try {
    const period=reportingPeriod(days);
    const {view}=await readConversionReport(period);
    const retry=new URL(request.url).searchParams.get('retry')==='1';
    after(async()=>{try{await refreshConversionReport(period,retry);}catch{console.error('Conversion background refresh failed');}});
    return reply({...view,refreshing:view.refreshing||retry});
  }
  catch (error) { return reply({ error: error.message }, 503); }
}


