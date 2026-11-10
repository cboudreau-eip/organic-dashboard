// Run before replacing DATORAMA_DAILY_GZIP and again after importing a new validated source.
// node --env-file=.env.local scripts/save-datorama-checkpoints.mjs
import {gunzipSync} from 'node:zlib';
import {createClient} from '@supabase/supabase-js';
import {checkpointRows} from '../lib/datorama/checkpoints.js';
export async function preserveCheckpoints(data){
 const url=process.env.SUPABASE_URL||process.env.NEXT_PUBLIC_SUPABASE_URL;
 const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!url||!key)throw Error('Checkpoint storage must be configured before replacing an import.');
 const rows=checkpointRows(data);
 const store=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
 const {error}=await store.from('datorama_cohort_checkpoints').upsert(rows,{onConflict:'id',ignoreDuplicates:true});
 if(error)throw Error('Could not preserve cohort checkpoints; import stopped.');
 return rows.length;
}
if(process.argv[1]?.replaceAll('\\','/').endsWith('/save-datorama-checkpoints.mjs')){
 const source=JSON.parse(gunzipSync(Buffer.from(process.env.DATORAMA_DAILY_GZIP,'base64')));
 console.log(JSON.stringify({cohorts:await preserveCheckpoints(source),sourceExportedAt:source.exportedAt}));
}
