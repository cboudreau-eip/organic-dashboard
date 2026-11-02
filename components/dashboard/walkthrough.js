export const leadPolicySteps = [
 {
  "title": "Open Leads & funnel",
  "target": "[data-nav=\"leads\"]",
  "text": "Select Leads & funnel to review MedicareFAQ lead and policy reporting. This tour will help you identify which figures you can use and which need more evidence.",
  "ready": "#organic-leads-host:not([hidden])",
  "reveal": [],
  "missing": "Select Leads & funnel to continue."
 },
 {
  "title": "Choose the lead reporting dates",
  "target": ".datorama-period-form",
  "text": "Choose Calendar month or Custom dates, select a comparison, and click Apply comparison. Read the dates printed under the controls to confirm what loaded. Latest month to date follows the imported data, which may lag today. These controls are independent of the PostHog dates and the fixed historical archive.",
  "ready": ".datorama-meta",
  "reveal": [
   ".datorama-periods"
  ],
  "missing": "This report is not available yet. Wait for it to load, use its Retry control if an error appears, or skip and note the gap."
 },
 {
  "title": "Confirm MedicareFAQ scope and freshness",
  "target": "[data-tour=\"lead-scope\"]",
  "text": "Read Website scope and confirm MedicareFAQ.com and the source organic/SEO filter before using the figures. Check Lead data through, then expand Source & freshness for the import date and available history. This is an imported snapshot, not a live feed. If the scope or coverage does not match your question, note the gap before drawing a conclusion.",
  "ready": ".datorama-meta",
  "reveal": [
   ".datorama-periods"
  ],
  "missing": "This report is not available yet. Wait for it to load, use its Retry control if an error appears, or skip and note the gap."
 },
 {
  "title": "Separate submissions from EIP leads",
  "target": "#organic-leads-host .organic-conversions .conversion-cards",
  "text": "These PostHog cards count tracked website activity. Contact submissions count sessions with a contact-step event; phone clicks are not confirmed calls. They have not been matched to CRM lead records. Check this section’s own dates. Do not use these submissions as the denominator for Datorama policies or expect them to equal EIP leads.",
  "ready": null,
  "reveal": [
   "#organic-leads-host .organic-conversions"
  ],
  "missing": "This report is not available yet. Wait for it to load, use its Retry control if an error appears, or skip and note the gap."
 },
 {
  "title": "Read leads and policy statuses",
  "target": ".datorama-conversion",
  "text": "Use EIP leads and Policies in the same Datorama row. Gross and approved are separate statuses; do not add them together or assume either is a count of signatures in these calendar dates. MS means Medicare Supplement; MA means Medicare Advantage. All Medicare combines MS and MA, so do not add that total to its component rows.",
  "ready": null,
  "reveal": [
   ".datorama-periods"
  ],
  "missing": "This report is not available yet. Wait for it to load, use its Retry control if an error appears, or skip and note the gap."
 },
 {
  "title": "Interpret the lead-to-policy rate",
  "target": "[aria-label=\"Lead-to-policy conversion\"]",
  "text": "The rate is policies from leads created during the selected dates divided by EIP leads. Policies may be signed later, and recent leads have had less time to convert. This is policy counts per lead, not the percentage of unique people who bought. Compare the same status and coverage; rate changes use percentage points (pp). A recent lower rate alone does not establish a performance decline.",
  "ready": null,
  "reveal": [
   ".datorama-periods"
  ],
  "missing": "This report is not available yet. Wait for it to load, use its Retry control if an error appears, or skip and note the gap."
 },
 {
  "title": "Check incomplete values before comparing",
  "target": ".datorama-totals",
  "text": "Review Period totals and changes. Reported subtotal means some daily values are missing, not zero. Rates need complete lead and policy values; changes need complete values in both periods. Do not calculate a replacement rate from partial counts. If data is incomplete, record the affected metric and missing days, and request a source check or refreshed export.",
  "ready": null,
  "reveal": [
   ".datorama-periods",
   ".datorama-totals"
  ],
  "missing": "This report is not available yet. Wait for it to load, use its Retry control if an error appears, or skip and note the gap."
 },
 {
  "title": "Prepare your finding for Pepper",
  "target": ".datorama-conversion",
  "text": "Use this outline: “For MedicareFAQ organic leads created [dates], the imported report shows [EIP leads] and [gross OR approved] [MS, MA, or all Medicare] policies. The policy-per-lead rate is [rate, or unavailable because…]. Data is through [date]. Compared with [dates], [supported change or comparison unavailable]. Next we will [specific check or action].” Label subtotals and allow for lead maturity. Write this in your review notes; finishing the tour does not save a report.",
  "ready": null,
  "reveal": [
   ".datorama-periods"
  ],
  "missing": "This report is not available yet. Wait for it to load, use its Retry control if an error appears, or skip and note the gap."
 }
];

export const organicPerformanceSteps = [
 {
  "title": "Open Overview",
  "target": "[data-nav=\"overview\"]",
  "text": "Select Overview. Compare MedicareFAQ organic traffic, understand Google search changes, and choose one finding to investigate.",
  "ready": "#organic-live-host:not([hidden])",
  "reveal": [],
  "missing": "Select Overview to continue."
 },
 {
  "title": "Choose your traffic dates",
  "target": "#organic-live-host .gsc-date-controls",
  "text": "Choose Last 28 days and the previous period, then Apply dates. Confirm the dates printed below the controls actually loaded. You can keep an existing comparison if it fits your review.",
  "ready": "#organic-live-host .organic-live > .dashboard-section-content > .organic-freshness",
  "reveal": [
   "#organic-live-host .organic-live"
  ],
  "missing": "This report is not available yet. Wait for it to load, use Try again if an error appears, or skip this step and note the gap."
 },
 {
  "title": "Read the traffic comparison",
  "target": "#organic-live-host .overview-kpis",
  "text": "Compare Visitors, Sessions, and Page views with their prior values. Read both the numerical and percentage change: large percentages can come from small starting values. Missing values do not mean zero. Session duration and single-page session rate describe engagement, not policy conversions.",
  "ready": "#organic-live-host .organic-live > .dashboard-section-content > .organic-freshness",
  "reveal": [
   "#organic-live-host .organic-live"
  ],
  "missing": "This report is not available yet. Wait for it to load, use Try again if an error appears, or skip this step and note the gap."
 },
 {
  "title": "Check whether the change persists",
  "target": "#organic-live-host .organic-trend",
  "text": "Is the traffic change spread across several days or driven by one spike? Open View exact values to inspect dates and values. The comparison aligns day numbers, not weekdays. A trend shows what happened; it does not establish why.",
  "ready": "#organic-live-host .organic-trend svg",
  "reveal": [
   "#organic-live-host .organic-live",
   "#organic-live-host .organic-trend"
  ],
  "missing": "This report is not available yet. Wait for it to load, use Try again if an error appears, or skip this step and note the gap."
 },
 {
  "title": "Open Acquisition",
  "target": "[data-nav=\"acquisition\"]",
  "text": "Select Acquisition to see MedicareFAQ performance in Google organic web search. Google clicks measure activity on search results; PostHog sessions measure activity on the website. Their totals are not expected to match.",
  "ready": "#gsc-live-host:not([hidden])",
  "reveal": [],
  "missing": "Select Acquisition to continue."
 },
 {
  "title": "Confirm your search dates",
  "target": ".gsc-performance .gsc-date-controls",
  "text": "Set the search reporting period and comparison, then Apply dates. These controls are separate from Overview. Check the loaded dates and GSC data-through date. Google uses Pacific time and finalized data can lag; Overview uses America/New_York. Use matching custom dates to compare the same calendar period across sources.",
  "ready": ".gsc-data-through",
  "reveal": [
   ".gsc-performance"
  ],
  "missing": "This report is not available yet. Wait for it to load, use Try again if an error appears, or skip this step and note the gap."
 },
 {
  "title": "Understand the search cards",
  "target": ".gsc-performance .gsc-cards",
  "text": "Clicks show search traffic; impressions show how often results appeared. CTR is the share of impressions that became clicks; its change is in percentage points. Lower average position is better. More impressions with flat clicks is a reason to investigate CTR and query mix, not proof that a title change is needed.",
  "ready": ".gsc-data-through",
  "reveal": [
   ".gsc-performance"
  ],
  "missing": "This report is not available yet. Wait for it to load, use Try again if an error appears, or skip this step and note the gap."
 },
 {
  "title": "Find a page gain or loss",
  "target": "[aria-label=\"Page gains and losses comparison table\"]",
  "text": "Use the Page performance filter above this table: try Losers, then Gainers. Compare Clicks, Prior clicks, and Click change. Read actual counts before percentages. One period only means a row was not reported in both periods; do not assume its missing value is zero.",
  "ready": null,
  "reveal": [
   ".gsc-performance",
   ".gsc-comparison"
  ],
  "missing": "This report is not available yet. Wait for it to load, use Try again if an error appears, or skip this step and note the gap."
 },
 {
  "title": "Investigate queries and summarize",
  "target": "[aria-label=\"Search query gains and losses comparison table\"]",
  "text": "Review query Gainers and Losers for another clue. This is a site-wide query table, not queries filtered to the page you just reviewed. Loaded rows may be limited and do not sum to the cards. Write a note: “Over [dates] versus [comparison], [metric] changed by [amount]. [Page or query] is worth investigating because [evidence]. Next I will check [question].” Separate observations from explanations.",
  "ready": null,
  "reveal": [
   ".gsc-performance",
   ".gsc-comparison"
  ],
  "missing": "This report is not available yet. Wait for it to load, use Try again if an error appears, or skip this step and note the gap."
 }
];

export const opportunitySteps = [
 {title:'Open Acquisition', target:'[data-nav="acquisition"]', text:'Select Acquisition to review Google search performance and your tracked keywords.', ready:'#gsc-live-host:not([hidden])', missing:'Select Acquisition in the navigation to continue.'},
 {title:'Choose your reporting dates', target:'.gsc-performance .gsc-date-controls', text:'Choose a reporting period and comparison, then Apply dates. Last 28 days versus the previous period is a useful starting point.', ready:'.gsc-data-through', missing:'Wait for GSC to load. If it fails, use Try again in Search performance, or skip this step.'},
 {title:'Load your tracked keywords', target:'.tracked-keywords', text:'Your latest saved report normally opens automatically. If no report is loaded, open Saved snapshots and select Open. If no snapshots exist, an authorized analyst must import a Position Tracking export.', ready:'[data-tour="page-opportunities"]:not(:disabled)', missing:'A keyword report must load before Page opportunities is available. Check Saved snapshots or the error message in Tracked keywords.'},
 {title:'Explore Page opportunities', target:'[data-tour="page-opportunities"]', text:'Click Page opportunities. Use Needs attention and Sort pages to investigate click losses, near-top-10 rankings, and potential CTR issues.', ready:'[aria-label="Page opportunities"]', missing:'Click Page opportunities to switch from keywords to pages.'},
 {title:'Review lead impact', target:'[data-tour="lead-impact"] > summary', ready:'[data-tour="lead-impact"][open] [aria-label="Landing-page lead impact"]', text:'Expand Lead impact to review organic landing sessions and tracked contact sessions. Look for pages with contact history. Missing data is not zero, and small samples need caution.', missing:'Select Page opportunities first. Lead impact appears inside that view. You can skip if lead data is unavailable.'},
 {title:'Save a page you want to improve', target:'[data-tour="save-opportunity"]:not(:disabled)', text:'Review the page URL and evidence, then click its Save opportunity button. This creates a real saved action. The tour never saves for you. You may skip if you are only exploring.', missing:'No available save button is visible. Clear filters, load Page opportunities, or check your analyst access. Already saved? Continue to Saved actions.'},
 {title:'Record your planned work', target:'#growth-action-list', text:'Open your saved action, keep its status Planned, add your work notes, and click Save changes. Add a publication date only after the work goes live. Later, use a 7-day or 28-day review to measure observed results.', missing:'Saved actions is inside Tracked keywords. If it is unavailable, check your team access or reload the report.'}
];

export function visibleTarget(selector, root=document) {
 return [...root.querySelectorAll(selector)].find(node=>{
  for(let parent=node;parent;parent=parent.parentElement){
   if(parent.hidden)return false;
   const style=parent.ownerDocument.defaultView.getComputedStyle(parent);
   if(style.display==='none'||style.visibility==='hidden')return false;
   if(parent.tagName==='DETAILS'&&!parent.open&&!parent.querySelector(':scope > summary')?.contains(node))return false;
  }
  return true;
 }) || null;
}

// Only expand presentation controls. Never submit forms or create records.
export function revealStep(index, root=document, steps=opportunitySteps) {
 const selectors=steps!==opportunitySteps?steps[index].reveal||[]:index===1?['.gsc-performance']:index>=2?['.tracked-keywords', ...(index===6?['#growth-action-list']:[])]:[];
 for(const selector of selectors) for(const section of root.querySelectorAll(selector)) section.querySelector(':scope > .dashboard-section-header button[aria-expanded="false"]')?.click();
}
