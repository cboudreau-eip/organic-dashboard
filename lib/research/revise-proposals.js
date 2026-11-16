import {enrichPaidPlan,paidScope} from './paid-search.js';
import {publicProposalPlan} from './proposals.js';
import {prepareInventory,matchPages} from './page-matching.js';
import {productFor} from './topics.js';

// Editorial rules select observed queries, never manufacture demand. Each rule is
// conditional on usable paid evidence; the original slot and calendar survive.
const rules=[
 ['medicare supplement plan j','aarp medicare supplement plans','Compare AARP Medicare Supplement plans: coverage, premiums and quote options','Compare available plan letters, premium factors, membership requirements and how to request a personalized quote.','Replace a legacy-plan topic with a paid-supported current buying decision.'],
 ['best supplemental health insurance','most affordable medicare supplement plans','How to compare affordable Medicare Supplement plans','Build a comparison of premiums versus out-of-pocket exposure, rating methods and quote inputs; avoid declaring one cheapest plan for everyone.','Narrow an ambiguous health-insurance topic to a Medicare buying decision.'],
 ['medicare supplement comparison','medicare supplement rates by age','Medicare Supplement rates by age: what changes your quote?','Plan an age-based comparison explaining rating methods, location, tobacco use and underwriting; use verified examples with dates and assumptions.','Replace a duplicate general comparison with a distinct pricing question.'],
 ['medicare supplement plans vs advantage plans','usaa medicare supplement','USAA Medicare Supplement: compare eligibility, coverage and costs','Review eligibility, available plan letters, premium factors and quote steps; verify the current insurer and state availability before implementation.','Replace a repeated Advantage-versus-Medigap comparison with a carrier decision.'],
 ['medicare supplement plans wyoming','cigna medicare supplement','Cigna Medicare Supplement: compare plans and quote factors','Review current branding, underwriting company, available plans, pricing factors and quote options; verify availability rather than assuming nationwide coverage.','Replace a narrow state proposal with stronger observed commercial evidence.'],
 ['plan g supplement','medicare plan n vs plan g','Plan G vs. Plan N: compare premiums and out-of-pocket trade-offs','Specify a decision table covering standardized benefits, copays, excess charges and premium trade-offs, with a personalized quote next step.','Replace overlapping Plan G overview coverage with a concrete plan comparison.'],
 ['enroll in medicare part d','medicare plan g pricing by state','How does Medicare Plan G pricing vary by state?','Plan a state comparison with dated quote assumptions and links to relevant state guides; explain why a national average cannot substitute for an individual quote.','Keep the separate Part D signup assignment and replace this overlap with an observed long-tail pricing question.'],
 ['what is medicare supplement plan c','medigap plans for seniors over 70','How do you compare Medigap plans after age 70?','Outline the buying decision around age-related pricing, enrollment rights, underwriting and existing coverage; verify state-specific protections.','Replace a legacy-plan explainer with a specific older-buyer question.'],
 ['aetna medicare supplement plan g reviews','cost of plan g medicare supplement for seniors 70 up','What affects the cost of Plan G after age 70?','Specify an age-70-plus pricing section with comparable quote assumptions, rating methods and underwriting factors; distinguish this pricing task from the broader over-70 enrollment guide.','Replace overlapping Aetna Plan G coverage with a distinct age-and-price question.'],
 ['medicare supplement plans in idaho','aarp medicare supplement plan g','How do you compare AARP Plan G premiums and eligibility?','Plan a carrier-specific comparison of quote factors, membership requirements, standardized benefits and current availability.','Replace a narrow state proposal with an observed carrier-and-plan decision.'],
 ['medicare supplement plans in new hampshire','how much does humana medicare supplement cost per month','How much does Humana Medicare Supplement cost per month?','Specify a monthly-cost section with plan, age and location assumptions, quote steps and links to the main carrier guide.','Replace a narrow state proposal with an observed long-tail cost question.'],
 ['medicare supplement plans in utah','medicare plan g cost in florida','What affects Medicare Plan G costs in Florida?','Plan a Florida-specific quote comparison with dated age and location assumptions, underwriting considerations and relevant state guidance.','Prioritize an observed state-and-plan pricing query.'],
 ['best medicare supplement plan g in texas','medigap plan g price table by age 2027','How should you compare Plan G prices by age in 2027?','Plan a dated age-based price table with verified 2027 quote inputs and clearly stated assumptions; coordinate with the over-70 pricing section to avoid repeating it.','Keep the existing Texas Plan G assignment and replace its duplicate with an observed age-table query.'],
 ['medical alert devices covered by medicare','when should i apply for medicare','When should you apply for Medicare? Enrollment planning checklist','Plan a durable timing checklist covering initial eligibility, employer coverage and where to verify enrollment deadlines; link to relevant enrollment guides.','Keep one medical-alert resource and replace repeated coverage with an enrollment foundation.'],
 ['medical alerts covered by medicare','sign up for medicare online','Signing up for Medicare online: what to prepare','Plan a preparation checklist and official enrollment links; distinguish Medicare enrollment from applying for a private plan.','Replace a third medical-alert variant with a practical enrollment resource.'],
 ['medicare $90','how to apply for medicare','Applying for Medicare: documents, eligibility and next steps','Plan an application guide that explains preparation, official application channels and next steps for coverage decisions; coordinate with the online checklist.','Replace an ambiguous dollar-benefit topic with a durable enrollment resource.'],
 ['$90 medicare refund','what is the best medicare plan that covers everything','Does any Medicare plan cover everything? How to compare coverage gaps','Plan a balanced explanation of coverage exclusions and cost-sharing, then link to plan comparisons; do not imply that any option covers everything.','Replace a repeated refund topic with an observed coverage question that supports plan selection.'],
];
const refinements={
 'compare medicare supplement plans':['Compare Medicare Supplement plans: benefits, costs and quote checklist','Specify a plan-selection comparison and quote checklist; separate standardized benefits from carrier-specific prices.'],
 'medicare supplement plans comparison chart':['Medicare Supplement comparison chart: benefits side by side','Update the existing chart as a supporting asset, with verified plan-letter benefits and links to the main comparison guide; avoid a competing overview article.'],
 'humana medicare supplement':['Humana Medicare Supplement: plans, eligibility and quote options','Review carrier availability, plan choices, eligibility and quote steps; keep detailed monthly-cost comparisons in the dedicated cost section.'],
 'medicare supplement plan f':['Medicare Plan F: eligibility, coverage and alternatives','Clarify who can buy Plan F, its benefits and comparison links; verify eligibility rules before drafting.'],
 'medicare supplement plan f benefits':['Medicare Plan F benefits: coverage checklist for buyers','Improve the benefit checklist within the Plan F guide; cross-link the eligibility and pricing sections instead of creating another overview.'],
 'average cost of medicare supplement':['Average Medicare Supplement costs: how to interpret a quote','Specify a dated cost benchmark with location, age and plan assumptions; distinguish averages from a personalized quote.'],
 'how much do medigap plans cost':['How much do Medigap plans cost? Build your coverage budget','Focus on total coverage budgeting, premiums and out-of-pocket exposure; link to the cost benchmark rather than repeat its price table.'],
 'how much does plan g cost':['How much does Plan G cost? Premiums and quote factors','Improve the Plan G pricing explanation and quote inputs; link to state and age comparisons and verify any price examples.'],
 'medicare plan n cost':['Plan N costs: premiums, copays and quote comparison','Plan a total-cost comparison with verified benefit rules, premium assumptions and a quote next step.'],
 'blue cross blue shield medicare supplement':['How do Blue Cross Blue Shield Medicare Supplement options compare?','Compare the relevant local insurers, benefits and quote factors; verify state availability rather than treating all Blue plans as one insurer.'],
 'bcbs medicare supplement plan g':['How do you compare Blue Cross Blue Shield Plan G quotes?','Specify a Plan G quote checklist by local insurer, with comparable age and location assumptions and links to the carrier overview.'],
 'medicare plan f versus g':['How do Medicare Plan F and Plan G costs and benefits compare?','Plan a side-by-side comparison of eligibility, benefits and total cost, including a dated quote example with explicit assumptions.'],
 'cigna medicare supplement insurance plan g':['What affects Cigna Medicare Supplement Plan G costs?','Review current carrier branding, state availability and pricing factors; add a clear path to request a comparable quote.'],
 'mutual of omaha medicare supplement plans reviews':['How should you evaluate Mutual of Omaha Medicare Supplement plans?','Specify evaluation criteria for plan options, quotes, service and rate history; source claims and separate verified facts from customer opinions.'],
 'aetna medicare supplement plan g':['How do you compare Aetna Medicare Supplement Plan G quotes?','Review current carrier branding, underwriting company, availability and quote assumptions before proposing a comparison section.'],
 'medicare supplement plans':['Medicare Supplement basics: coverage, choices and next steps','Improve the evergreen overview with a benefit summary and clear links to plan comparisons, costs and enrollment; keep detailed buying decisions in their dedicated sections.'],
 'medicare':['Medicare coverage choices: a starting guide for new buyers','Narrow the broad homepage-style topic to a durable decision path through Original Medicare, Advantage, Medigap and Part D, with links to detailed guides.'],
};
const norm=s=>String(s||'').toLowerCase().trim();
const usable=r=>['MFAQ','MC+MFAQ'].includes(r.account)&&!r.qualityIssue&&r.clicks>=20&&r.leads>=5&&r.sales>0;
export function revisePaidProposals(plan,snapshot,inventory=[],settings={}){
 if(plan?.payload?.items?.length!==90||!snapshot?.payload?.rows?.length)throw Object.assign(Error('A saved 90-assignment plan and paid-search workbook are required.'),{status:422});
 const payload=structuredClone(plan.payload),prepared=prepareInventory(inventory),enriched=enrichPaidPlan(publicProposalPlan(plan),snapshot);
 const matched=new Map(enriched.payload.items.map(i=>[i.id,i.paidSearch.matches.filter(usable)]));
 const rows=snapshot.payload.rows.filter(usable),used=new Set(payload.items.flatMap(i=>i.terms.map(norm))),changes=[];
 const excluded=settings.excluded||[];
 for(const item of payload.items){
  if(Object.hasOwn(plan.edits||{},item.id)||item.category==='AI citations')continue;
  // Repeat runs do not overwrite an earlier revision with the same workbook.
  if(item.revision?.sourceId===snapshot.id)continue;
  const before={title:item.title,action:item.action,terms:item.terms,targetUrl:item.targetUrl};
  const rule=rules.find(r=>r[0]===norm(item.title));
  let title,work,reason,selected=[],kind='Refined';
  if(rule){
   const row=rows.find(r=>norm(r.term)===rule[1]);
   if(row&&!used.has(norm(row.term))&&!excluded.some(x=>norm(row.term).includes(norm(x)))&&(!settings.products?.length||settings.products.includes(productFor(row.term))||productFor(row.term)==='General Medicare')){
    selected=[row];title=rule[2];work=rule[3];reason=rule[4];kind='Replaced';
   }
  }
  const refinement=refinements[norm(item.title)];
  if(!title&&refinement&&(matched.get(item.id)||[]).length){selected=matched.get(item.id).slice(0,3);[title,work]=refinement;reason='Turn matching paid-search demand into a specific buying-decision or supporting-page improvement.';}
  if(!title)continue;
  if(kind==='Replaced'){
   const term=selected[0].term,target=matchPages({term,product:productFor(term),gsc:[],semrush:[]},prepared).target;
   // Removed-topic evidence must never appear to support the replacement.
   item.evidence={gsc:[],semrush:[],otterly:[],posthog:null};item.sourceKey=null;item.priority=null;
   item.terms=selected.map(r=>r.term);used.add(norm(term));
   const applicationFit=!/apply|sign up/.test(term)||/apply|application|sign.?up/i.test(target?.title||'');
   item.targetUrl=target?.status==='read'&&target.sameScope&&target.primaryMatch>=85&&applicationFit?target.url:'';
  }
  item.title=title;item.editorialTitle=true;item.action=`${work} ${item.targetUrl?'Audit the matched existing page first; this may be a section update rather than a new article.':'Check existing MedicareFAQ coverage before choosing a new page or update.'}`;
  item.type=item.targetUrl?'Existing-page investigation':'New-page investigation';item.basis='Observed opportunity';
  item.verification='Tentative assignment. Verify organic intent, page overlap, current carrier availability and factual sources before implementation. Historical paid attribution is directional, not organic demand or Salesforce policy counts. Verify 2027 facts and prices separately; source-query years are preserved.';
  item.revision={kind,sourceId:snapshot.id,sourcePlanId:plan.id,before,reason,period:snapshot.payload.period,rows:selected};
  item.evidence.paidSearch=selected.map(r=>({...r,accountLabel:paidScope(r.account)}));
  changes.push({id:item.id,kind,before:before.title,after:title,reason});
 }
 if(!changes.length)throw Object.assign(Error('No further supported revisions were found. Saved assignments are unchanged.'),{status:422});
 payload.sourceDates={...payload.sourceDates,paidSearch:{period:snapshot.payload.period,status:'Historical paid-search evidence; mixed accounts; directional attribution'}};
 payload.revision={version:'paid-revision-v1',sourcePlanId:plan.id,sourceVersion:plan.version,sourceId:snapshot.id,changes,replaced:changes.filter(c=>c.kind==='Replaced').length,refined:changes.filter(c=>c.kind==='Refined').length,manualPreserved:Object.keys(plan.edits||{}).length,unchanged:90-changes.length};
 return {payload,edits:structuredClone(plan.edits||{}),calendar:structuredClone(plan.calendar)};
}
