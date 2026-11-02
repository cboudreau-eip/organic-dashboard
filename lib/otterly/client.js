import {REPORT_ID,ENGINES,validateReport,normalizeStats,normalizeReport,reportPeriod} from './report.js';
export function otterlyClient(key,fetcher=fetch) {
  if(!key?.trim())throw Error('Otterly API access is not configured.');
  let requests=0;
  const get=async(path,params={})=>{
    if(++requests>40)throw Error('Otterly sync exceeded its request budget.');
    const url=new URL('https://data.otterly.ai/v1/reports/brand/'+REPORT_ID+path);
    for(const [k,v]of Object.entries(params))url.searchParams.set(k,String(v));
    const response=await fetcher(url,{headers:{Authorization:'Bearer '+key.trim(),Accept:'application/json'},cache:'no-store',redirect:'error',signal:AbortSignal.timeout(25000)});
    if(!response.ok)throw Error(response.status===429?'Otterly request allowance is temporarily unavailable.':'Otterly could not provide the report.');
    return response.json();
  };
  const list=async(path,params)=>{
    const rows=[];let offset=0;
    for(let page=0;page<10;page++){
      const data=await get(path,{...params,offset,limit:100});
      if(!Array.isArray(data.items)||!data.paging||data.paging.offset!==offset||!Number.isSafeInteger(data.paging.limit)||data.paging.limit<1||data.paging.limit>100||typeof data.paging.hasMore!=='boolean')throw Error('Unexpected Otterly pagination.');
      rows.push(...data.items);
      if(!data.paging.hasMore)return rows;
      if(!data.items.length)throw Error('Incomplete Otterly page.');
      offset+=data.paging.limit;
    }
    throw Error('Otterly report exceeds the supported page limit; no partial totals saved.');
  };
  return {async sync(now=new Date()){
    const period=reportPeriod(now),params={startDate:period.start,endDate:period.end,country:'us'};
    const meta=await get('');validateReport(meta);
    const stats=await get('/stats',params);normalizeStats(stats);
    const citations=await list('/citations',{...params,domains:'medicarefaq.com'});
    const prompts=await list('/prompts',params);
    const engines=[];
    // Sequential requests bound quota use and avoid a burst against the provider.
    for(const [id,label]of Object.entries(ENGINES)){
      try {const r=normalizeStats(await get('/stats',{...params,engines:id}));engines.push({id,label,available:true,coverage:r.coverage,mentions:r.mentions,totalPrompts:r.totalPrompts});}
      catch {engines.push({id,label,available:false,coverage:null,mentions:null,totalPrompts:null});}
    }
    return normalizeReport({meta,stats,citations,prompts,engines,period},now);
  }};
}
