import {hash} from './topics.js';
import {pageKey} from './inventory.js';
import {safePage} from '../otterly/content-sources.js';
export const REFINEMENT_VERSION='task-refinement-v2';
const normalize=s=>String(s||'').toLowerCase().replace(/[^a-z0-9]+/g,' ').replace(/medicare supplement|medigap/g,'supplement').replace(/prescription (drug )?plans?/g,'part d').replace(/blue cross blue shield|blue cross/g,'bcbs').replace(/cigna/g,'healthspring').replace(/[^a-z0-9]+/g,' ').trim();
const carriers=['lumico','aetna','healthspring','humana','mutual of omaha','bcbs','anthem','united american','bankers fidelity','usaa'];
export function matchPages(topic,inventory,originalTarget=null){
 const query=normalize(topic.title),terms=[...new Set(query.split(' ').filter(t=>t.length>2&&!['medicare','supplement','what','does','with','plans','plan','the','and','for','how'].includes(t)))];
 const brand=carriers.find(b=>query.includes(b)),product=query.match(/(?:plan|part) [a-z]\b/)?.[0];
 const ranked=inventory.filter(p=>safePage(p.url)).flatMap(p=>{
  const url=pageKey(p.canonical||p.url),path=new URL(url).pathname;
  if(/^\/(?:sitemap|faqs|blog|videos|podcasts|client-care-team)?\/?$/.test(path))return [];
  const title=normalize(p.title+' '+path),body=normalize((p.headings||[]).join(' '));
  let score=terms.filter(t=>title.split(' ').includes(t)).length*3+terms.filter(t=>body.split(' ').includes(t)).length;
  const reasons=[];
  if(brand){if(title.includes(brand)){score+=15;reasons.push('Named carrier in title or URL');}else score-=12;}
  if(product){if(title.includes(product)){score+=12;reasons.push('Exact plan or Medicare part');}else if(/(?:plan|part) [a-z]\b/.test(title))score-=12;}
  if(query.includes('supplement')){if(title.includes('supplement')){score+=10;reasons.push('Medicare Supplement product');}else if(title.includes('advantage'))score-=30;}
  if(query.includes('part d')&&/advantage/.test(title)&&!title.includes('part d'))score-=30;
  if(title.includes(query)){score+=8;reasons.push('Exact question or phrase');}
  if(url===pageKey(originalTarget)){score+=1;reasons.push('Earlier target; still requires verification');}
  return score>0?[{url,title:p.title,score,reasons:reasons.length?reasons:['Related question terms']}]:[];
 }).sort((a,b)=>b.score-a.score||a.url.localeCompare(b.url));
 return [...new Map(ranked.map(p=>[p.url,p])).values()].slice(0,6);
}
export function separateTasks(a,inventory){
 return a.topics.map(t=>{
  const matches=matchPages(t,inventory,a.targetUrl),split=a.topics.length>1;
  return {...a,key:split?hash(a.key+':task:'+t.key):a.key,title:t.title,priority:t.score??a.priority,topics:[t],
   parentAssignment:{key:a.key,title:a.title,topics:a.topics.map(t=>({key:t.key,title:t.title}))},
   originalTarget:a.targetUrl||null,targetUrl:null,rematch:true,pageMatches:matches,
   candidateUrls:matches.map(p=>p.url),resolutionUrls:matches.map(p=>p.url),state:'pending',primaryVerification:true,
   result:null,splitFrom:split?a.key:null,businessReason:t.intent+'. Independently reviewed task; page metrics are not keyword conversions.'};
 });
}
