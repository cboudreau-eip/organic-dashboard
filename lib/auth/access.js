import {isTeamUser} from './config.js';

// Ownership is bound to the existing account, never to editable profile fields.
export const OWNER_ID = 'c8dad8c8-d33d-4b50-839f-f5d4021440dd';
export const isOwner = user => isTeamUser(user) && user.id === OWNER_ID;

export async function dashboardUser(client) {
 const result = await client.auth.getUser();
 if(result.error || !isTeamUser(result.data?.user)) return {data:{user:null},error:result.error};
 const access = await client.rpc('dashboard_access');
 if(access.error || access.data !== true) return {data:{user:null},error:access.error};
 return result;
}
