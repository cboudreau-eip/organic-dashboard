import {serverAuth} from '../../../../../lib/auth/server';
import {dashboardUser,isOwner} from '../../../../../lib/auth/access';
import {siteUrl} from '../../../../../lib/auth/config';
import {createImportHandler} from '../../../../../lib/datorama/import-handler';
import {datoramaDaily} from '../../../../../lib/datorama/daily';
import {importStore} from '../../../../../lib/datorama/store';
import {checkpointRows} from '../../../../../lib/datorama/checkpoints';
export const runtime='nodejs';
export const maxDuration=60;
export const POST=createImportHandler({origin:siteUrl,load:datoramaDaily,authorize:async()=>{const client=await serverAuth();if(!client)return null;const {data,error}=await dashboardUser(client);return !error&&isOwner(data.user)?data.user:null;},save:async(report,user,current)=>{
 const client=importStore();
 // Save both old and new cohort facts before activating the new report. Repeated imports are idempotent.
 for(const d of [current,report.data].filter(Boolean)){const result=await client.from('datorama_cohort_checkpoints').upsert(checkpointRows(d),{onConflict:'id',ignoreDuplicates:true});if(result.error)throw Error('Checkpoint save failed');}
 const result=await client.from('datorama_imports').insert({id:report.id,filename:report.filename,exported_at:report.data.exportedAt,imported_by:user.id,payload:report.data});
 if(result.error&&result.error.code!=='23505')throw Error('Import save failed');return {duplicate:result.error?.code==='23505'};
}});
