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
 const result=await client.rpc('save_datorama_import',{p_import:{id:report.id,filename:report.filename,exported_at:report.data.exportedAt,imported_by:user.id,payload:report.data},p_checkpoints:[current,report.data].filter(Boolean).flatMap(checkpointRows)});
 if(result.error)throw Error('Import save failed');return result.data;
}});
