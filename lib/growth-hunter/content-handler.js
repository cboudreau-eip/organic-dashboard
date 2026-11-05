import {authorizeGrowth} from './access.js';
import {GrowthError} from './contracts.js';
import {readBody,reply,errorReply} from './handlers.js';
import {uuid} from './actions.js';
import {QUERY_VERSION,compareQueryEvidence} from './keywords.js';
import {safePage,readPublicPage,pageText,contentSources} from '../otterly/content-sources.js';
import {growthRecommendation} from './content.js';

export async function growthSources(page,topic){
 const target=await readPublicPage(page),text=pageText(target.html);
 if(text.length<300)throw new GrowthError('The selected page could not be read. Review it manually or retry later.',422);
 let related=[];try{related=await contentSources(topic);}catch{/* The selected page still supports a focused review. */}
 return [{id:'target',url:target.url,text,truncated:text.length===18000},...related.filter(p=>p.url!==target.url).slice(0,4)];
}
export function growthContentHandler({getClient,enabled,origin,configured,generate,sources=growthSources}){
 const limits=new Map();
 return async request=>{try{
  if(request.headers.get('origin')!==new URL(origin()).origin)throw new GrowthError('Generate suggestions from the dashboard.',403);
  const active=enabled(),{client,user}=await authorizeGrowth(active?await getClient():null,active,'run');
  if(!configured())throw new GrowthError('Charlie is not configured. Ask your administrator to check the AI connection.',503);
  const input=await readBody(request,4096);
  if(!input||Object.keys(input).some(k=>!['runId','page'].includes(k))||!uuid(input.runId)||!safePage(input.page))throw new GrowthError('Choose a page from a saved analysis.');
  const {data:run,error}=await client.from('growth_decline_runs').select('id,result,prior_snapshot_id,current_snapshot_id').eq('id',input.runId).maybeSingle();
  if(error)throw new GrowthError('Saved analysis is unavailable.',503);
  const finding=run?.result?.findings?.find(f=>f.url===input.page);
  if(!finding)throw new GrowthError('This page is not a finding in that analysis.',404);
  const now=Date.now();for(const [key,value] of limits)if(value.until<now)limits.delete(key);
  const limit=limits.get(user.id)||{count:0,until:now+60000};if(limit.count>=3)throw new GrowthError('Please wait a minute before generating another suggestion.',429);limit.count++;limits.set(user.id,limit);
  const research=await client.from('growth_query_research').select('id,payload').eq('run_id',run.id).eq('page',finding.url).eq('version',QUERY_VERSION).maybeSingle();
  if(research.error)throw new GrowthError('Keyword evidence is temporarily unavailable. Please retry.',503);
  const keywords=research.data?compareQueryEvidence(research.data.payload).matched.filter(q=>q.lostClicks>0).slice(0,10):[];
  const evidence={runId:run.id,priorSnapshotId:run.prior_snapshot_id,currentSnapshotId:run.current_snapshot_id,priorPeriod:run.result.priorPeriod,currentPeriod:run.result.currentPeriod,finding,keywordResearchId:research.data?.id||null,keywords};
  const topic=new URL(finding.url).pathname+' '+keywords.slice(0,3).map(k=>k.query).join(' ');
  const pages=await sources(finding.url,topic);
  if(!pages.some(p=>p.id==='target'))throw new GrowthError('The selected page could not be read.',422);
  const output=await generate({...evidence,pages});
  return reply({suggestion:growthRecommendation(output,pages,evidence),evidence,sources:pages.map(({id,url,truncated})=>({id,url,truncated})),generatedAt:new Date().toISOString()});
 }catch(error){return errorReply(error);}};
}
