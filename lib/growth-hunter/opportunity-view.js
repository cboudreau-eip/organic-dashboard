// Labels describe observed signals, not a diagnosis or forecast.
export function opportunitySignal(finding){
 const a=finding.prior,b=finding.current;
 if(b.position-a.position>=1)return {id:'position',label:'Position worsened',description:'Average search position moved lower. Review which queries changed before choosing an edit.'};
 if(Math.abs(b.position-a.position)<=0.5&&b.ctr-a.ctr<=-0.005)return {id:'ctr',label:'Lower click-through rate',description:'CTR fell while average position was similar. Review search appearance and query mix.'};
 if(b.impressions<a.impressions*0.8)return {id:'impressions',label:'Fewer impressions',description:'Search impressions fell. Check demand, seasonality, indexing, and query mix.'};
 return {id:'review',label:'Needs investigation',description:'Clicks fell, but these page-level measurements do not identify a clear explanation.'};
}
export function pageLabel(url){
 try{const parts=decodeURIComponent(new URL(url).pathname).split('/').filter(Boolean);const label=(parts.at(-1)||'Homepage').replace(/[-_]+/g,' ');return label.charAt(0).toUpperCase()+label.slice(1);}catch{return url;}
}
export function visibleOpportunities(findings,{query='',signal='all',sort='lost'}={}){
 const search=query.trim().toLowerCase();
 return findings.filter(f=>(signal==='all'||opportunitySignal(f).id===signal)&&(!search||`${pageLabel(f.url)} ${f.url}`.toLowerCase().includes(search))).sort((a,b)=>sort==='percent'?b.declinePercent-a.declinePercent||b.lostClicks-a.lostClicks:sort==='page'?pageLabel(a.url).localeCompare(pageLabel(b.url)):b.lostClicks-a.lostClicks||a.url.localeCompare(b.url));
}
export function contactLabel(evidence){
 if(!evidence)return 'Not checked';
 if(!evidence.current||!evidence.previous)return 'Unavailable';
 const change=evidence.current.contactSessions-evidence.previous.contactSessions;
 if(!Number.isFinite(change))return 'Unavailable';
 return change<0?`${Math.abs(change)} fewer contacts`:change>0?`${change} more contacts`:'Contacts unchanged';
}
