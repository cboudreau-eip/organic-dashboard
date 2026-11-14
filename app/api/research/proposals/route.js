import {serverAuth} from '../../../../lib/auth/server';
import {authorizeGrowth,growthEnabled} from '../../../../lib/growth-hunter/access';
import {siteUrl} from '../../../../lib/auth/config';
import {proposalHandlers} from '../../../../lib/research/proposal-handlers';
export const dynamic='force-dynamic';
export const maxDuration=300;
const handlers=proposalHandlers({access:async action=>authorizeGrowth(await serverAuth(),growthEnabled(),action),origin:siteUrl});
export const GET=handlers.GET;
export const POST=handlers.POST;
