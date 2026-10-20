import 'server-only';
import { gunzipSync } from 'node:zlib';
export function datoramaDaily() {
  const value=process.env.DATORAMA_DAILY_GZIP;
  if(!value)return null;
  if(value.length>100000)throw new Error('Daily dataset exceeds limit');
  return JSON.parse(gunzipSync(Buffer.from(value,'base64'),{maxOutputLength:2000000}).toString('utf8'));
}
