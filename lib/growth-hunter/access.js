import { isTeamUser } from '../auth/config.js';
import { GrowthError } from './contracts.js';

export const growthEnabled = (env = process.env) => env.GROWTH_HUNTER_ENABLED === 'true';
export async function authorizeGrowth(client, enabled, action = 'read') {
  if (!enabled) throw new GrowthError('Growth Hunter is not enabled.', 404, 'disabled');
  if (!client) throw new GrowthError('Sign in to use Growth Hunter.', 401, 'unauthenticated');
  const { data, error } = await client.auth.getUser();
  if (error || !isTeamUser(data?.user)) throw new GrowthError('Sign in to use Growth Hunter.', 401, 'unauthenticated');
  const result = await client.rpc('growth_access');
  if (result.error) throw new GrowthError('Growth Hunter storage is not ready. Ask an administrator to finish setup.', 503, 'storage_unavailable');
  const role = result.data;
  if (!['viewer', 'analyst', 'admin'].includes(role) || (['import', 'run'].includes(action) && role === 'viewer') || !['read', 'import', 'run'].includes(action)) throw new GrowthError('You do not have access to this Growth Hunter action.', 403, 'forbidden');
  return { client, user: data.user, role };
}
