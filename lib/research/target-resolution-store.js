import {createClient} from '@supabase/supabase-js';
export function targetResolutionStore(){
 const url=process.env.SUPABASE_URL||process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!url||!key)throw Error('Page-target evidence storage is not configured.');
 return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
}
