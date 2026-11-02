import {createClient} from '@supabase/supabase-js';
import {serverAuth} from '../auth/server';
import {authorizeGrowth,growthEnabled} from '../growth-hunter/access';
import {syncOtterly} from './sync.js';
export async function otterlyAccess(action='read') {
 const client=await serverAuth();
 const result=await authorizeGrowth(client,growthEnabled(),action);
 return {client,role:result.role};
}
export async function runOtterlySync(){
 const url=process.env.SUPABASE_URL||process.env.NEXT_PUBLIC_SUPABASE_URL;
 const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!url||!key||!process.env.OTTERLY_API_KEY)throw Error('Otterly sync is not configured.');
 const store=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
 return syncOtterly({store,key:process.env.OTTERLY_API_KEY});
}
