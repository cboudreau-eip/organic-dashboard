import 'server-only';
import {createClient} from '@supabase/supabase-js';
export function importStore(){
 const url=process.env.SUPABASE_URL||process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!url||!key)throw Error('Import storage unavailable');
 return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
}
