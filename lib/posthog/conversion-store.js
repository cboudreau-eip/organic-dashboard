import 'server-only';
import {createClient} from '@supabase/supabase-js';
import {randomUUID} from 'node:crypto';
import {reportKey,newJob,advanceJob,publicReport,FRESH_MS} from './async-conversions.js';

const table='conversion_report_cache';
function store(){
 const url=process.env.SUPABASE_URL||process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!url||!key||!process.env.POSTHOG_PERSONAL_API_KEY)throw Error('Conversion report storage is not configured.');
 if((process.env.POSTHOG_HOST||'https://us.posthog.com').replace(/\/$/,'')!=='https://us.posthog.com'||(process.env.POSTHOG_PROJECT_ID||'452683')!=='452683')throw Error('PostHog configuration does not match the MedicareFAQ project.');
 return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
}
function checked(r){if(r.error)throw Error('Saved conversion reports are temporarily unavailable.');return r.data;}
export async function readConversionReport(period){
 const db=store(),id=reportKey(period);
 checked(await db.from(table).upsert({id},{onConflict:'id',ignoreDuplicates:true}));
 const row=checked(await db.from(table).select('*').eq('id',id).single());
 return {row,view:publicReport(row,period)};
}
export async function refreshConversionReport(period,retry=false){
 const db=store(),id=reportKey(period),owner=randomUUID(),now=Date.now();
 // A database lease deduplicates work across browser tabs and Vercel instances.
 const row=checked(await db.from(table).update({lease_owner:owner,lease_until:new Date(now+45000).toISOString()}).eq('id',id).lt('lease_until',new Date(now).toISOString()).select('*').maybeSingle());
 if(!row)return;
 try{
  let job=row.job;
  if(!job||job.done){
   if(!retry&&row.report&&now-Date.parse(row.report.fetchedAt)<FRESH_MS)return;
   if(!retry&&job?.done&&now-job.startedAt<FRESH_MS)return;
   job=newJob(now);
  }
  const next=await advanceJob(job,period,{key:process.env.POSTHOG_PERSONAL_API_KEY.trim()});
  const update={job:next.job,partial:next.report,updated_at:new Date().toISOString()};
  // Keep a complete last-successful report intact throughout a failed refresh.
  if(next.report.status==='complete')update.report=next.report;
  checked(await db.from(table).update(update).eq('id',id).eq('lease_owner',owner));
 }finally{
  checked(await db.from(table).update({lease_until:new Date(Date.now()+2000).toISOString(),lease_owner:null}).eq('id',id).eq('lease_owner',owner));
 }
}
