import { serverAuth } from '../../../../../lib/auth/server';
import { isTeamUser } from '../../../../../lib/auth/config';
import { datoramaDaily } from '../../../../../lib/datorama/daily';
import { createPeriodsHandler } from '../../../../../lib/datorama/periods';
export const dynamic='force-dynamic';
export const runtime='nodejs';
export const GET=createPeriodsHandler({load:datoramaDaily,authorize:async()=>{
 const client=await serverAuth();if(!client)return false;
 const {data,error}=await client.auth.getUser();return !error&&isTeamUser(data.user);
}});
