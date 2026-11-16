import {serverAuth} from '../../../../lib/auth/server';
import {authorizeGrowth,growthEnabled} from '../../../../lib/growth-hunter/access';
import {siteUrl} from '../../../../lib/auth/config';
import {paidImportHandler} from '../../../../lib/research/paid-search-handler';
export const runtime='nodejs';
export const maxDuration=60;
export const POST=paidImportHandler({access:async action=>authorizeGrowth(await serverAuth(),growthEnabled(),action),origin:siteUrl});
