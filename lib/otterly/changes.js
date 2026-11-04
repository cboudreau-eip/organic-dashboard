import {ENGINES,REPORT_ID,WORKSPACE_ID} from './report.js';
const numeric=n=>Number.isSafeInteger(n)&&n>=0;
const days=p=>(Date.parse(p?.end)-Date.parse(p?.start))/86400000+1;
const index=rows=>new Map((rows||[]).map(r=>[r.id,r]));
export function compareReports(current,previous){
 const unavailable=reason=>({available:false,reason});
 if(!previous)return unavailable('No earlier saved report is available yet. Changes will appear after another report is saved.');
 if(!current||[current,previous].some(r=>r.reportId!==REPORT_ID||r.workspaceId!==WORKSPACE_ID||r.domain!=='medicarefaq.com'||r.country!=='us')||!Number.isFinite(days(current.period))||days(current.period)!==days(previous.period)||days(current.period)<1||previous.period.end>=current.period.end)return unavailable('These reports do not have matching scope and comparable date ranges.');
 const before=index(previous.prompts),after=index(current.prompts),rows=[];
 let excluded=0,matched=0;
 const totals={mentions:{up:0,down:0,unchanged:0},domainMentions:{up:0,down:0,unchanged:0}};
 for(const [engine,label] of Object.entries(ENGINES)){
  const a=index(current.promptPlatforms?.find(e=>e.id===engine)?.prompts);
  const b=index(previous.promptPlatforms?.find(e=>e.id===engine)?.prompts);
  for(const id of new Set([...a.keys(),...b.keys()])){
   const now=a.get(id),prior=b.get(id),prompt=after.get(id),old=before.get(id);
   if(!prompt||!old||prompt.prompt!==old.prompt||!now||!prior||now.prompt!==prior.prompt||now.prompt!==prompt.prompt){excluded++;continue;}
   const changes={};
   for(const key of ['mentions','domainMentions']){
    if(numeric(now[key])&&numeric(prior[key])){
     const delta=now[key]-prior[key];changes[key]={before:prior[key],after:now[key],delta};
     totals[key][delta>0?'up':delta<0?'down':'unchanged']++;
    }
   }
   if(!Object.keys(changes).length){excluded++;continue;}
   matched++;
   if(Object.values(changes).some(c=>c.delta!==0))rows.push({id,engine,label,prompt:prompt.prompt,changes});
  }
 }
 if(!matched)return unavailable('No matching platform-level prompt measurements are available in both saved reports yet. Missing measurements are never treated as zero.');
 rows.sort((a,b)=>Math.max(...Object.values(b.changes).map(c=>Math.abs(c.delta)))-Math.max(...Object.values(a.changes).map(c=>Math.abs(c.delta)))||a.prompt.localeCompare(b.prompt)||a.engine.localeCompare(b.engine));
 return {available:true,rows,totals,matched,excluded,current:current.period,previous:previous.period,overlap:previous.period.end>=current.period.start,currentFetchedAt:current.promptPlatformsFetchedAt||current.fetchedAt,previousFetchedAt:previous.promptPlatformsFetchedAt||previous.fetchedAt};
}
