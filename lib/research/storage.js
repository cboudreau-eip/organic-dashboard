import {createHash} from 'node:crypto';
const PATHS=[['evidence','gsc','rows'],['evidence','posthog','rows'],['evidence','semrush','rows'],['evidence','otterly','prompts'],['inventory','pages'],['inventory','cachedPages'],['results','items']];
const MAX_BYTES=350000;
const parent=(value,path)=>path.slice(0,-1).reduce((v,k)=>v?.[k],value);
export function packPayload(payload){
 const packed=structuredClone(payload),assets=[];
 if(Array.isArray(packed.inventory?.pages))packed.inventory.readCount=packed.inventory.pages.filter(p=>p.status==='read').length;
 for(const path of PATHS){const owner=parent(packed,path),field=path.at(-1),rows=owner?.[field];if(!Array.isArray(rows)||!rows.length)continue;
  let batch=[],bytes=2;const keys=[];
  const flush=()=>{if(!batch.length)return;const key=createHash('sha256').update(JSON.stringify(batch)).digest('hex');keys.push(key);assets.push({key,payload:batch});batch=[];bytes=2;};
  for(const row of rows){const size=Buffer.byteLength(JSON.stringify(row))+1;if(size>MAX_BYTES)throw Error('An evidence record exceeds the storage limit');if(bytes+size>MAX_BYTES)flush();batch.push(row);bytes+=size;}flush();
  owner[field]={assetKeys:keys,count:rows.length};
 }
 return {payload:packed,assets:[...new Map(assets.map(a=>[a.key,a])).values()]};
}
function db(result){if(result.error){console.error('Research storage failed',{code:result.error.code||'transport',status:result.status});throw Error('Research storage unavailable');}return result.data;}
export async function saveAssets(client,runId,assets){
 const existing=new Set((db(await client.from('research_evidence_chunks').select('key').eq('run_id',runId).limit(5000))||[]).map(a=>a.key));
 const pending=assets.filter(a=>!existing.has(a.key));
 for(let i=0;i<pending.length;i+=4)await Promise.all(pending.slice(i,i+4).map(async asset=>{const result=await client.from('research_evidence_chunks').insert({run_id:runId,...asset});if(result.error?.code!=='23505')db(result);}));
}
export async function hydratePayload(client,run,parts=null){
 const payload=structuredClone(run.payload),selected=PATHS.filter(path=>!parts||parts.some(p=>path.join('.').startsWith(p)));
 const keys=[...new Set(selected.flatMap(path=>parent(payload,path)?.[path.at(-1)]?.assetKeys||[]))],assets=new Map();
 for(let i=0;i<keys.length;i+=8){const rows=db(await client.from('research_evidence_chunks').select('key,payload').eq('run_id',run.id).in('key',keys.slice(i,i+8)));for(const row of rows||[])assets.set(row.key,row.payload);}
 for(const path of selected){const owner=parent(payload,path),field=path.at(-1),ref=owner?.[field];if(!ref?.assetKeys)continue;
  const rows=ref.assetKeys.flatMap(key=>{if(!assets.has(key))throw Error('Missing saved evidence');return assets.get(key);});if(rows.length!==ref.count)throw Error('Incomplete saved evidence');owner[field]=rows;
 }
 return payload;
}
export const stepParts=stage=>stage==='gsc'?['evidence.gsc']:stage==='sitemaps'?['evidence.gsc','evidence.semrush','inventory.cachedPages']:stage==='pages'?['inventory']:stage==='rank'?null:[];
