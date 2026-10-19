import 'server-only';
import { serverAuth } from '../../../../lib/auth/server';
import { siteUrl } from '../../../../lib/auth/config';
import { growthEnabled } from '../../../../lib/growth-hunter/access';
import { createGrowthHandlers } from '../../../../lib/growth-hunter/handlers';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
const handlers = createGrowthHandlers({ getClient: serverAuth, enabled: growthEnabled, origin: siteUrl });
export const GET = handlers.GET;
export const POST = handlers.POST;
