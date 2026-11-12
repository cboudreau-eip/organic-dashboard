import {serverAuth} from '../../../lib/auth/server';
import {authorizeGrowth,growthEnabled} from '../../../lib/growth-hunter/access';
import shortlist from '../../../docs/content-plan/shortlist-draft.json';
import {siteUrl} from '../../../lib/auth/config';
import {planHandlers} from '../../../lib/content-plan/handlers';
export const dynamic='force-dynamic';
const handlers=planHandlers({access:async action=>authorizeGrowth(await serverAuth(),growthEnabled(),action),origin:siteUrl,shortlist});
export const GET=handlers.GET;
export const PATCH=handlers.PATCH;
