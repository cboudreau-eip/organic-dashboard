import {otterlyClient} from './client.js';
import {reportPeriod} from './report.js';
export async function syncOtterly({store,key,now=new Date(),fetcher=fetch}){
 const period=reportPeriod(now);
 const {data:claimed,error}=await store.rpc('otterly_claim_sync',{p_end:period.end});
 if(error)throw Error('Otterly report storage is unavailable.');
 if(!claimed)return {synced:false,message:'Today’s sync has already run or is waiting before retrying.'};
 try{
  const payload=await otterlyClient(key,fetcher).sync(now);
  const saved=await store.from('otterly_snapshots').insert({period_end:period.end,payload});
  if(saved.error&&saved.error.code!=='23505')throw Error('The Otterly report could not be saved.');
  const finished=await store.from('otterly_sync_runs').update({status:'complete',finished_at:new Date().toISOString(),message:null}).eq('period_end',period.end);
  if(finished.error)throw Error('The Otterly sync status could not be saved.');
  return {synced:true,period};
 }catch(e){
  await store.from('otterly_sync_runs').update({status:'failed',finished_at:new Date().toISOString(),message:'Sync failed. The previous saved report remains available; check Otterly access and report scope.'}).eq('period_end',period.end);
  throw e;
 }
}
