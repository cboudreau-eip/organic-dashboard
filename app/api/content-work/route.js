import {serverAuth} from '../../../lib/auth/server';
import {authorizeGrowth,growthEnabled} from '../../../lib/growth-hunter/access';
import {siteUrl} from '../../../lib/auth/config';
import {workQueueHandlers} from '../../../lib/work-queue/handlers';
export const dynamic='force-dynamic';
export const maxDuration=60;
const handlers=workQueueHandlers({access:async action=>authorizeGrowth(await serverAuth(),growthEnabled(),action),origin:siteUrl});
export const GET=handlers.GET;
export const POST=handlers.POST;
