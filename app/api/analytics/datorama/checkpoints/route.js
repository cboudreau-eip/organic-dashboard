import {serverAuth} from '../../../../../lib/auth/server';
import {dashboardUser} from '../../../../../lib/auth/access';
import {createCheckpointHandler} from '../../../../../lib/datorama/checkpoints';
import {saveCurrentCheckpoints,readCheckpoints} from '../../../../../lib/datorama/checkpoint-store';
export const dynamic='force-dynamic';
export const runtime='nodejs';
export const GET=createCheckpointHandler({save:saveCurrentCheckpoints,read:readCheckpoints,authorize:async()=>{
 const client=await serverAuth();if(!client)return false;
 const result=await dashboardUser(client);return !result.error&&!!result.data.user;
}});
