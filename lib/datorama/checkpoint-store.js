import 'server-only';
import {createClient} from '@supabase/supabase-js';
import {checkpointRows} from './checkpoints';
import {datoramaDaily} from './daily';

function store(){
 const url=process.env.SUPABASE_URL||process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!url||!key)throw Error('Checkpoint storage unavailable');
 return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
}
export async function saveCurrentCheckpoints(){
 const data=datoramaDaily();if(!data)throw Error('No imported source');
 const rows=checkpointRows(data);
 const {error}=await store().from('datorama_cohort_checkpoints').upsert(rows,{onConflict:'id',ignoreDuplicates:true});
 if(error)throw Error('Checkpoint save failed');
 return {cohorts:rows.length,sourceExportedAt:data.exportedAt};
}
export async function readCheckpoints(month){
 const {data,error}=await store().from('datorama_cohort_checkpoints').select('id,source_exported_at,saved_at,lead_data_through,report').eq('scope_id','medicarefaq-production').eq('cohort_month',month+'-01').order('source_exported_at',{ascending:false}).order('saved_at',{ascending:false}).order('id',{ascending:false}).limit(101);
 if(error)throw Error('Checkpoint read failed');return data;
}
