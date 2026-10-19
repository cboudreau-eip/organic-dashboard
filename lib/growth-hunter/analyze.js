import { authorizeGrowth } from './access.js';
import { GrowthError } from './contracts.js';
import { reply, errorReply, readBody } from './handlers.js';
export function createAnalyzeHandler({getClient,enabled,origin,loadEvidence}) {
 return async function POST(request) {
  try {
   const allowed=enabled();
   const {client}=await authorizeGrowth(allowed?await getClient():null,allowed,'run');
   if(request.headers.get('origin')!==new URL(origin()).origin) throw new GrowthError('Run analysis from the dashboard.',403,'origin_rejected');
   const body=await readBody(request,1024);
   if(!body||Object.keys(body).length!==1||![7,28].includes(body.days)) throw new GrowthError('Choose a 7 or 28 day comparison.');
   const {prior,current}=await loadEvidence(body.days);
   const {data,error}=await client.rpc('growth_analyze_gsc',{prior_input:prior,current_input:current});
   if(error) throw new GrowthError(error.code==='42501'?'Research permission changed. Reload before continuing.':'Analysis could not be saved. Please retry.',error.code==='42501'?403:503,'storage_unavailable');
   const {created_by,...run}=data.run;
   return reply({run,reused:data.reused},data.reused?200:201);
  } catch(error) { return errorReply(error); }
 };
}
