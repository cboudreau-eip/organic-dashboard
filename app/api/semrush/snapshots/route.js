
import { serverAuth } from '../../../../lib/auth/server';
import { siteUrl } from '../../../../lib/auth/config';
import { authorizeGrowth, growthEnabled } from '../../../../lib/growth-hunter/access';
import { semrushHandlers } from '../../../../lib/semrush/handlers';
export const dynamic='force-dynamic';
export const runtime='nodejs';
const handlers=semrushHandlers({access:async action=>authorizeGrowth(await serverAuth(),growthEnabled(),action),origin:siteUrl});
export const GET=handlers.GET;
export const POST=handlers.POST;
