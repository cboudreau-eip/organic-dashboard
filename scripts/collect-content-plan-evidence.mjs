// Read-only aggregate source extraction. Run with node --env-file=.env.local.
import {createSign} from 'node:crypto';
import {writeFile,mkdir} from 'node:fs/promises';
import {sessionRows,metrics} from '../lib/posthog/conversions.js';
const dir=new URL('../docs/content-plan/evidence/',import.meta.url);
await mkdir(dir,{recursive:true});
const credential=JSON.parse(process.env.GSC_SERVICE_ACCOUNT_JSON||'{}');
const encode=v=>Buffer.from(JSON.stringify(v)).toString('base64url');
const now=Math.floor(Date.now()/1000);
const unsigned=`${encode({alg:'RS256',typ:'JWT'})}.${encode({iss:credential.client_email,scope:'https://www.googleapis.com/auth/webmasters.readonly',aud:'https://oauth2.googleapis.com/token',iat:now,exp:now+3600})}`;
const assertion=`${unsigned}.${createSign('RSA-SHA256').update(unsigned).sign(credential.private_key,'base64url')}`;
const auth=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',assertion}),signal:AbortSignal.timeout(30000)});
if(!auth.ok)throw Error(`GSC authentication HTTP ${auth.status}`);
const {access_token}=await auth.json();
async function gsc(startDate,endDate,dimensions,startRow=0){
 const r=await fetch('https://www.googleapis.com/webmasters/v3/sites/https%3A%2F%2Fwww.medicarefaq.com%2F/searchAnalytics/query',{method:'POST',headers:{Authorization:`Bearer ${access_token}`,'Content-Type':'application/json'},body:JSON.stringify({startDate,endDate,dimensions,startRow,rowLimit:25000,type:'web',dataState:'final'}),signal:AbortSignal.timeout(60000)});
 if(!r.ok)throw Error(`GSC query HTTP ${r.status}`);return (await r.json()).rows||[];
}
const available=await gsc('2026-10-29','2026-11-11',['date']);
const end=available.map(r=>r.keys[0]).sort().at(-1);
if(!end)throw Error('No finalized GSC dates');
const start=new Date(Date.parse(end)-89*86400000).toISOString().slice(0,10);
for(const dimensions of [['query'],['page']]){
 let rows=[],offset=0,batch;
 do{batch=await gsc(start,end,dimensions,offset);rows.push(...batch);offset+=batch.length;}while(batch.length===25000&&offset<100000);
 const data={source:'GSC',site:'https://www.medicarefaq.com/',start,end,timezone:'America/Los_Angeles',fetchedAt:new Date().toISOString(),dimensions,coverage:'Final web-search rows; anonymized queries omitted; API may omit rows. Not exhaustive.',capped:batch.length===25000,rows};
 await writeFile(new URL(`gsc-live-${dimensions[0]}-2026-11-12.json`,dir),JSON.stringify(data,null,2));
 console.log(JSON.stringify({source:'GSC',dimensions,start,end,rows:rows.length,capped:data.capped}));
}
const startPH='2026-10-13',endPH='2026-11-11';
const query={kind:'HogQLQuery',query:`SELECT landing, ${metrics} FROM (${sessionRows(startPH,endPH)}) GROUP BY landing ORDER BY quote_starts DESC LIMIT 500`};
const response=await fetch('https://us.posthog.com/api/projects/452683/query/',{method:'POST',headers:{Authorization:`Bearer ${process.env.POSTHOG_PERSONAL_API_KEY}`,'Content-Type':'application/json'},body:JSON.stringify({query,name:'Content Plan read-only quote-start evidence'}),signal:AbortSignal.timeout(60000)});
if(!response.ok)throw Error(`PostHog HTTP ${response.status}`);
const result=await response.json();
if(!Array.isArray(result.results)||result.error||result.query_status?.complete===false)throw Error('PostHog incomplete response');
await writeFile(new URL('posthog-starts-2026-11-12.json',dir),JSON.stringify({source:'PostHog',project:452683,start:startPH,end:endPH,timezone:'America/New_York',fetchedAt:new Date().toISOString(),query,limitations:'Organic main-site landing sessions only. Quote starts are session counts, not unique people or qualified leads. Completion attribution is unreliable and must not be used for ranking.',columns:result.columns,rows:result.results},null,2));
console.log(JSON.stringify({source:'PostHog',rows:result.results.length,start:startPH,end:endPH}));
