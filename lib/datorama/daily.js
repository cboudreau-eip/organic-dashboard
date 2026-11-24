import 'server-only';
import { gunzipSync } from 'node:zlib';
import {importStore} from './store';
export function legacyDaily() {
  const value=process.env.DATORAMA_DAILY_GZIP;
  if(!value)return null;
  if(value.length>100000)throw new Error('Daily dataset exceeds limit');
  const data=JSON.parse(gunzipSync(Buffer.from(value,'base64'),{maxOutputLength:2000000}).toString('utf8'));
  if(data.scopeId!=='medicarefaq-production')throw new Error('Unverified website scope');
  return data;
}
export async function datoramaDaily(){
 const old=legacyDaily();
 const {data,error}=await importStore().from('datorama_imports').select('payload').order('exported_at',{ascending:false}).limit(1);
 if(error)throw Error('Imported report storage unavailable');
 const latest=data[0]?.payload;
 return latest&&(!old||Date.parse(latest.exportedAt)>Date.parse(old.exportedAt))?latest:old;
}
