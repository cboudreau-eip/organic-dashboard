// Editorial suggestions are explicitly distinct from observed query/prompt data.
const questions={
 'compare-plans':['How can I compare Medicare plans side by side using my doctors and prescriptions?','Which comparison tool should I use for Medigap versus Medicare Advantage?'],
 'plan-g':['How do I compare Plan G quotes using the same coverage start date?','What should I compare besides the monthly Plan G premium?'],
 'g-companies':['Which Plan G companies are available in my ZIP code?','How should I compare rate history, discounts and complaint records?'],
 switch:['Can I switch from Medicare Advantage to Medigap without underwriting?','What should I confirm before ending my Medicare Advantage coverage?'],
 'g-price':['Why do two companies charge different prices for the same Plan G benefits?','Which assumptions must match when I compare Medicare Supplement quotes?'],
 aetna:['Is Aetna Medicare Supplement available for new applicants in my state?','Which company underwrites the Aetna or Accendo quote I received?'],
 'high-g':['When could high-deductible Plan G cost less overall than standard Plan G?','Which costs count toward the high-deductible Plan G deductible?'],
 'plan-n':['How do I compare Plan N premium savings against copays and other costs?','Can I change from Plan N to Plan G without health questions?'],
 underwriting:['What health questions might I be asked when applying for Medigap?','How do I check whether I have a protection that avoids medical underwriting?'],
 'g-f':['How should I compare keeping Plan F with switching to Plan G?','What eligibility and underwriting checks come before changing my Medigap plan?']
};
const observations={
 'compare-plans':'Comparison tool guide already exists. Clarify product-specific workflows and verify tool coverage claims rather than creating another tools article.',
 'plan-g':'National coverage page already links to a quote worksheet. Preserve that path; verify benefit limits, pricing assumptions and 2027 figures before refreshing.',
 'g-companies':'Company comparison already links to the worksheet and reviews guide. Strengthen verifiable selection criteria rather than inventing a national best carrier.',
 switch:'Switching FAQ and a separate switching blog both exist in source evidence. Check their query overlap before expanding either; no redirect or consolidation is authorized.',
 'g-price':'Existing article already explains matching applicant assumptions and rating methods. Focus on measured query opportunities and useful navigation rather than duplicate explanations.',
 aetna:'Existing page makes carrier availability, subsidiary, discount and rating claims. Current carrier verification is a prerequisite to a refreshed buying recommendation.',
 'high-g':'Existing page labels its deductible as an out-of-pocket maximum and gives simplified savings examples. Review labels and arithmetic before expanding the comparison.',
 'plan-n':'National page already presents cost sharing and a quote action. Review comparison accuracy and internal links; weak rankings alone do not prove a content gap.',
 underwriting:'Existing article already targets 2027. A year-only refresh is unnecessary; prioritize specific application questions and state/carrier verification.',
 'g-f':'Existing carrier-specific comparison already covers eligibility. Keep its carrier scope clear and distinguish it from a general Plan G/Plan F guide.'
};
const links={g:['Plan G coverage','/medicare-supplement-plans/plan-g/'],n:['Plan N coverage','/medicare-supplement-plans/plan-n/'],companies:['Compare Plan G companies','/blog/best-medicare-supplement-plan-g-companies/'],price:['Why Plan G prices differ','/blog/why-two-medigap-plan-g-policies-cost-different-amounts/'],switch:['Switching from Medicare Advantage to Medigap','/faqs/switch-medicare-advantage-to-medicare-supplement/'],underwriting:['Prepare for Medigap underwriting','/blog/pass-medigap-underwriting/']};
export function briefFor(id,targetUrl){
 const states={'florida-g':['Florida','G'],'texas-g':['Texas','G'],'california-g':['California','G'],'pennsylvania-g':['Pennsylvania','G'],'florida-n':['Florida','N']};
 const state=states[id];
 const longTailQuestions=state?[`How do I compare Medicare Supplement Plan ${state[1]} quotes in ${state[0]}?`,`Which local pricing and eligibility details should I check before changing my ${state[0]} Medigap policy?`]:questions[id];
 const finding=state?`Existing ${state[0]} Plan ${state[1]} page already has pricing, benefits and quote controls. Verify the year-labelled deductible amounts and price assumptions. ${id==='florida-n'?'The introductory description of Plan N cost sharing needs specific review against official benefits.':'Reconcile headline rates with the comparison table and cite the quote methodology.'}`:observations[id];
 const selected=id==='switch'||id==='underwriting'?['switch','underwriting','g']:id==='plan-n'||id==='florida-n'?['n','g','price']:['g','companies','price'];
 return {longTailQuestions,longTailLabel:'Suggested editorial questions — not asserted search volume',contentReview:finding,
  outline:[`Answer: ${longTailQuestions[0]}`,'What to compare: a concise decision table with explicit assumptions',`Eligibility and cost checks: ${longTailQuestions[1]}`,'Documents, details and questions to prepare before requesting a quote','Relevant next step, FAQs and dated source notes'],
  internalLinks:selected.map(key=>({label:links[key][0],url:`https://www.medicarefaq.com${links[key][1]}`})).filter(link=>link.url!==targetUrl),
  nextAction:'Compare relevant local options or request a licensed-agent eligibility review; avoid promises of acceptance, savings or full-market coverage.',
  verification:'Before publication, validate 2027 benefit figures with Medicare.gov/CMS, applicable state rules with the state regulator, and carrier-specific availability/rates with current carrier sources. Do not copy unsupported numbers from existing pages.',
  successMeasure:'Track this page’s GSC clicks and relevant queries, plus organic landing-session quote starts. Use dated baselines; no revenue or completion-rate claims until attribution is validated.'};
}
