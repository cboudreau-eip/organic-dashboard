import {primaryUrl} from '../research/primary-sources.js';

// Keep the actual unanswered question on retries; the original proposal is not evidence.
export function verificationQuestions(pending){
 return pending.map(i=>({id:i.id,section:i.section.replace(/\(?targetp\d+[^)]*\)?/g,'').trim(),question:i.question,remainingQuestion:i.remainingQuestion||'',previousReview:i.reviewReason||i.reason||'',previousInstruction:i.instruction||''}));
}
export function verificationSearches(title,items,plannedDate){
 return items.map(i=>({ids:[i.id],query:[title,plannedDate?`Planned publication: ${plannedDate}. Verify the applicable year; do not substitute earlier-year figures.`:'',i.section,i.question,i.remainingQuestion,i.previousReview,'Find the exact official rule, qualifying conditions and applicable year.'].filter(Boolean).join('\n')}));
}
// Round-robin results so one broad federal search cannot crowd out state/cost evidence.
export function verificationUrls(searches,fallback,max=10){
 const selected=[],seen=new Set();
 const add=value=>{const safe=primaryUrl(value);if(!safe)return;const u=new URL(safe);if(!u.hostname.endsWith('.gov')||/\.epub$/i.test(u.pathname))return;u.hash='';if(!seen.has(u.href)){seen.add(u.href);selected.push(u.href);}};
 for(let rank=0;rank<3&&selected.length<max;rank++)for(const results of searches){if(selected.length>=max)break;if(results[rank])add(results[rank].url);}
 for(const url of fallback){if(selected.length>=max)break;add(url);}
 return selected;
}
