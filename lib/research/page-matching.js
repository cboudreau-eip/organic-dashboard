import {pageKey} from './inventory.js';
import {tokens,normalizedTopic,entities} from './topics.js';
const matchText=text=>normalizedTopic(text).replace(/\b(apply|applying|enroll|enrolment|enrollment|sign up)\b/g,'enrollment').replace(/\b(chart|comparison)\b/g,'compare');
const words=text=>new Set(tokens(matchText(text)));
export function prepareInventory(inventory){
 const pages=inventory.map(p=>({...p,primary:words(p.title||p.headings?.[0]||''),head:words(p.title+' '+(p.headings||[]).join(' ')),identity:entities((p.title||p.headings?.[0]||'')+' '+new URL(p.url).pathname.replaceAll('-',' ')),headingTokens:(p.headings||[]).map(h=>words(h))}));
 const frequency=new Map();for(const p of pages)for(const t of p.primary)frequency.set(t,(frequency.get(t)||0)+1);
 return {pages,weight:t=>1+Math.log((pages.length+1)/((frequency.get(t)||0)+1))};
}
export function matchPages(group,{pages,weight}){
 const termTokens=tokens(matchText(group.term)),identity=entities(group.term),denominator=termTokens.reduce((s,t)=>s+weight(t),0)||1;
 const observations=new Map(),semrush=new Set(group.semrush.map(r=>pageKey(r.landing)).filter(Boolean));
 for(const r of group.gsc){const key=pageKey(r.keys[1]);if(!key)continue;const o=observations.get(key)||{impressions:0,clicks:0};o.impressions+=r.impressions||0;o.clicks+=r.clicks||0;observations.set(key,o);}
 // Resolve observations against canonical pages before calculating landing-page shares.
 const canonical=new Map();for(const p of pages)for(const u of [p.url,p.requested,p.canonical].filter(Boolean))canonical.set(pageKey(u),pageKey(p.canonical||p.url));
 const totals=new Map();for(const [url,o] of observations){const key=canonical.get(url)||url,t=totals.get(key)||{impressions:0,clicks:0};t.impressions+=o.impressions;t.clicks+=o.clicks;totals.set(key,t);}
 const semPages=new Set([...semrush].map(u=>canonical.get(u)||u));
 const allImpressions=[...totals.values()].reduce((s,o)=>s+o.impressions,0);
 const coverage=set=>termTokens.reduce((s,t)=>s+(set.has(t)?weight(t):0),0)/denominator*100;
 const ranked=pages.map(page=>{
  const key=pageKey(page.canonical||page.url),observed=totals.get(key)||{impressions:0,clicks:0},direct=totals.has(key)||semPages.has(key);
  const primaryMatch=coverage(page.primary),match=coverage(page.head),share=allImpressions?observed.impressions/allImpressions:0;
  const carrierFit=identity.carriers.every(c=>page.identity.carriers.includes(c)||direct&&tokens(c).every(t=>page.head.has(t)));
  // A carrier page can cover its plan variants, but a different named plan is not a match.
  const planFit=!identity.plans.length||identity.plans.every(p=>page.identity.plans.includes(p))||identity.carriers.length>0&&!page.identity.plans.length&&page.primary.has('medigap');
  const partFit=!identity.parts.length||identity.parts.every(p=>page.identity.parts.includes(p));
  const productFit=group.product!=='Medigap'||page.primary.has('medigap')||page.identity.plans.length>0||direct&&page.head.has('medigap');
  const stateFit=identity.states.length?identity.states.every(s=>page.identity.states.includes(s)):page.identity.states.length===0;
  const fits=carrierFit&&planFit&&partFit&&productFit&&stateFit;
  const relevant=fits&&(primaryMatch>=55||direct&&match>=35||direct&&page.status!=='read');
  const extraIdentity=(!identity.carriers.length&&page.identity.carriers.length?15:0)+(page.identity.plans.some(p=>!identity.plans.includes(p))?15:0)+(page.identity.parts.some(p=>!identity.parts.includes(p))?10:0);
  const strength=primaryMatch*.65+match*.15+share*20+(semPages.has(key)?10:0)-extraIdentity;
  const sameScope=fits&&identity.plans.length===page.identity.plans.length&&identity.carriers.length===page.identity.carriers.length&&identity.parts.length===page.identity.parts.length;
  return {url:page.url,canonical:page.canonical,title:page.title,status:page.status,match:Math.round(match),primaryMatch:Math.round(primaryMatch),direct,relevant,strength,sameScope,impressions:observed.impressions,clicks:observed.clicks,share,headings:page.headings,headingTokens:page.headingTokens};
 }).filter(p=>p.direct||p.relevant).sort((a,b)=>Number(b.relevant)-Number(a.relevant)||b.strength-a.strength||a.url.localeCompare(b.url));
 const seen=new Set(),matches=ranked.filter(p=>{const key=p.canonical||p.url;if(seen.has(key))return false;seen.add(key);return true;});
 const target=matches.find(p=>p.relevant)||null;
 // Related pages are not automatically competing. Require two comparable pages,
 // strong primary-title coverage and material query impressions on each.
 const competitors=matches.filter(p=>p.relevant&&p.status==='read'&&p.sameScope&&p.primaryMatch>=70&&p.impressions>=20&&p.share>=.2);
 return {matches:matches.slice(0,5).map(({headingTokens,...p})=>({...p,headings:(p.headings||[]).filter((h,i)=>termTokens.some(t=>headingTokens[i].has(t))).slice(0,4)})),target,overlap:competitors.length>1,allImpressions};
}
