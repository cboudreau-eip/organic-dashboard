import 'server-only';
import { gunzipSync } from 'node:zlib';
export function datoramaDaily() {
  const value=process.env.DATORAMA_DAILY_GZIP;
  if(!value)return null;
  if(value.length>100000)throw new Error('Daily dataset exceeds limit');
  const data=JSON.parse(gunzipSync(Buffer.from(value,'base64'),{maxOutputLength:2000000}).toString('utf8'));
  if(data.scopeId!=='medicarefaq-production')throw new Error('Unverified website scope');
  return data;
}
