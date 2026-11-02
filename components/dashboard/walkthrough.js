export const aiVisibilitySteps = [
  {
    "title": "Open AI visibility",
    "target": "[data-nav=\"ai\"]",
    "ready": "#ai-visibility-host:not([hidden])",
    "text": "Select AI visibility to see how MedicareFAQ appears in monitored AI answers. This walkthrough helps you choose an opportunity and record your work.",
    "missing": "Select AI visibility to continue."
  },
  {
    "title": "Check the report dates",
    "target": ".ai-visibility .ai-toolbar",
    "ready": ".ai-visibility .organic-freshness",
    "text": "Choose Latest report or a saved report. Check the dates and sync time below. Otterly uses its own reporting dates. If the report is behind, an analyst can Sync latest report; the walkthrough never starts a sync for you.",
    "missing": "Wait for a saved Otterly report to load. If none is available, an analyst can sync it, or you can skip this step."
  },
  {
    "title": "Understand mentions and citations",
    "target": "[data-tour=\"ai-platforms\"]",
    "text": "Compare the platforms. A mention names MedicareFAQ in an answer; a citation references a MedicareFAQ page as a source. An answer can cite us without naming the brand. Unavailable is not zero. These counts describe monitored answers, not website visits, leads, or policies.",
    "missing": "Load an Otterly report to view platform evidence, or skip if it is unavailable."
  },
  {
    "title": "Choose a prompt to investigate",
    "target": "[aria-labelledby=\"prompt-opportunities-heading\"]",
    "text": "Read Prompts to investigate. Choose a question where competitors appear but MedicareFAQ is missing, or where we are cited without being named. Expand View platform evidence on that prompt, then use Review answers in Otterly to inspect the answers and sources. Competitor counts help prioritize investigation; they do not prove the cause or business impact.",
    "missing": "Load a report to see prompt opportunities. If none are returned, skip and revisit after a later report."
  },
  {
    "title": "Track your chosen opportunity",
    "target": "[aria-labelledby=\"prompt-opportunities-heading\"]",
    "text": "On your chosen prompt, click Track this opportunity. This creates a real Growth Hunter action with the original dates, mentions, citations, competitors, and available platform evidence. An already tracked prompt keeps its original baseline. Analyst access is required. You can skip if you are only exploring; Next does not save anything.",
    "missing": "No opportunity report is visible. Return to AI visibility, load a report, or skip."
  },
  {
    "title": "Open Growth Hunter",
    "target": "[data-nav=\"growth\"]",
    "ready": "#growth-hunter-host:not([hidden])",
    "text": "Select Growth Hunter, or use Open Growth Hunter on your saved prompt. Find Tracked AI opportunities to continue working on the action.",
    "missing": "Select Growth Hunter to continue."
  },
  {
    "title": "Open your tracked AI action",
    "target": "#growth-ai-action-list",
    "ready": "#growth-ai-action-list [aria-label=\"Saved Otterly baseline\"]",
    "reveal": [
      "#growth-ai-action-list"
    ],
    "text": "Find your prompt in Tracked AI opportunities and click Open action. Check the full prompt and original baseline dates. The baseline stays unchanged when Otterly refreshes. If your list is empty, return to AI visibility and track a prompt, or skip to preview the remaining guidance.",
    "missing": "Open an AI action to continue. Clear the status filter if needed. If none is saved, track a prompt first or skip."
  },
  {
    "title": "Plan the improvement",
    "target": "#growth-ai-action-list [data-tour=\"action-work\"]",
    "reveal": [
      "#growth-ai-action-list"
    ],
    "text": "In What changed / work notes, record the MedicareFAQ page you plan to improve, the evidence you found, the specific change, owner, and target date. Keep the action Planned or In progress and click Save changes. The walkthrough does not edit your website or save notes automatically.",
    "missing": "Open a tracked AI action first, or skip to preview this guidance."
  },
  {
    "title": "Record publication and progress",
    "target": "#growth-ai-action-list [data-tour=\"action-work\"]",
    "reveal": [
      "#growth-ai-action-list"
    ],
    "text": "Once the website change is actually live, record what changed, enter its publication date in Pacific time, choose Published or Monitoring, and click Save changes. Keep unfinished work Planned or In progress. Automatic AI before/after comparisons are not available yet; record follow-up observations and their report dates in your notes. Finishing this walkthrough does not save changes.",
    "missing": "Open a tracked AI action to record progress. You can finish without saving if you are only exploring."
  }
];

export const pepperReviewSteps = [
 {
  "title": "Start with Overview",
  "target": "[data-nav=\"overview\"]",
  "text": "Select Overview. Build a review with a clear period, supported findings, three opportunities, and available results. Open Review draft below at any step to take notes. Save draft explicitly before leaving or refreshing.",
  "ready": "#organic-live-host:not([hidden])",
  "reveal": [],
  "missing": "Use the highlighted navigation or load the report to continue. If the source or team feature is unavailable, skip and record that limitation in the draft."
 },
 {
  "title": "Set dates and summarize performance",
  "target": "#organic-live-host .gsc-date-controls",
  "text": "Apply your review dates and comparison, then read the loaded dates, traffic cards, and trend. In Review draft, record those dates and one or two findings with current/prior values. Note source freshness and missing data; do not treat blanks as zero.",
  "ready": "#organic-live-host .organic-live > .dashboard-section-content > .organic-freshness",
  "reveal": [
   "#organic-live-host .organic-live"
  ],
  "missing": "Use the highlighted navigation or load the report to continue. If the source or team feature is unavailable, skip and record that limitation in the draft."
 },
 {
  "title": "Open lead reporting",
  "target": "[data-nav=\"leads\"]",
  "text": "Select Leads & funnel to gather business outcomes. These reports have their own dates; match your review dates where data allows and note any differences.",
  "ready": "#organic-leads-host:not([hidden])",
  "reveal": [],
  "missing": "Use the highlighted navigation or load the report to continue. If the source or team feature is unavailable, skip and record that limitation in the draft."
 },
 {
  "title": "Record leads, policies, and limitations",
  "target": ".datorama-conversion",
  "text": "Check MedicareFAQ scope, imported data-through date, and comparison dates. Record EIP leads and a clearly named policy status and coverage. Label reported subtotals; do not derive rates from incomplete counts. Keep PostHog submissions separate. Add missing data and lead-maturity limits to the draft.",
  "ready": ".datorama-meta",
  "reveal": [
   ".datorama-periods"
  ],
  "missing": "Use the highlighted navigation or load the report to continue. If the source or team feature is unavailable, skip and record that limitation in the draft."
 },
 {
  "title": "Open Acquisition",
  "target": "[data-nav=\"acquisition\"]",
  "text": "Select Acquisition for Google search findings, tracked keywords, page opportunities, and saved actions.",
  "ready": "#gsc-live-host:not([hidden])",
  "reveal": [],
  "missing": "Use the highlighted navigation or load the report to continue. If the source or team feature is unavailable, skip and record that limitation in the draft."
 },
 {
  "title": "Add search evidence",
  "target": ".gsc-performance .gsc-cards",
  "text": "Confirm the GSC dates and finalized data-through date. Record clicks and impressions versus the comparison, then investigate page/query changes. Use the source dates in your notes. Semrush snapshots have their own dates and device/location scope; do not mix incompatible snapshots.",
  "ready": ".gsc-data-through",
  "reveal": [
   ".gsc-performance"
  ],
  "missing": "Use the highlighted navigation or load the report to continue. If the source or team feature is unavailable, skip and record that limitation in the draft."
 },
 {
  "title": "Choose three defensible opportunities",
  "target": "[data-tour=\"page-opportunities\"]",
  "text": "Click Page opportunities. Select three pages using the available search, ranking, and lead-impact evidence. For each draft entry, record the URL, source/date and numbers, why it matters, next action, owner, target date, and success measure. If evidence supports fewer than three, record the remaining gaps instead of inventing opportunities.",
  "ready": "[aria-label=\"Page opportunities\"]",
  "reveal": [
   ".tracked-keywords"
  ],
  "missing": "Use the highlighted navigation or load the report to continue. If the source or team feature is unavailable, skip and record that limitation in the draft."
 },
 {
  "title": "Review previous work",
  "target": "#growth-action-list",
  "text": "Open relevant saved actions and any saved 7- or 28-day results. Record what changed, publication date, before/after values, and evidence limits. If work is still Planned or no measurement exists, write that results are not yet available. This review does not require you to publish or measure anything.",
  "ready": null,
  "reveal": [
   ".tracked-keywords",
   "#growth-action-list"
  ],
  "missing": "Use the highlighted navigation or load the report to continue. If the source or team feature is unavailable, skip and record that limitation in the draft."
 },
 {
  "title": "Finish, save, and copy your review",
  "target": "#pepper-review-draft > summary",
  "text": "Open Review draft below. Check dates, sources, three opportunities (or explicit gaps), and available results. Add decisions needed from Pepper and your next review date. Save draft to keep it in this browser, then Copy review for your meeting notes. Copying does not save or send it to Pepper. Unfilled fields remain marked Not recorded.",
  "ready": null,
  "reveal": [],
  "missing": "Use the highlighted navigation or load the report to continue. If the source or team feature is unavailable, skip and record that limitation in the draft."
 }
];

export const resultsReviewSteps = [
 {
  "title": "Open Acquisition",
  "target": "[data-nav=\"acquisition\"]",
  "text": "Select Acquisition to find Saved actions inside Tracked keywords. This walkthrough teaches you to review work already published on the website. It does not publish website changes.",
  "ready": "#gsc-live-host:not([hidden])",
  "reveal": [],
  "missing": "Select Acquisition to continue."
 },
 {
  "title": "Choose a saved action",
  "target": "#growth-action-list",
  "text": "Use Filter status to find a published or monitoring action, then click its Open action button. Confirm the page URL and work you want to review. If nothing has been saved yet, use Find and save your first opportunity first, or skip to preview this tutorial.",
  "ready": "[aria-label=\"Selected saved action\"]",
  "reveal": [
   ".tracked-keywords",
   "#growth-action-list"
  ],
  "missing": "Open a saved action to continue. If the list is empty, clear the status filter or skip; the tutorial will not create an example action."
 },
 {
  "title": "Review what changed",
  "target": "[data-tour=\"action-work\"]",
  "text": "Check the page URL, title, and What changed / work notes. Review Work history if you need earlier revisions. Explain the problem you intended to address and exactly what you changed. If you recorded original evidence in the notes, use it as context; the measured before-period figures are a separate comparison.",
  "ready": null,
  "reveal": [
   ".tracked-keywords",
   "#growth-action-list"
  ],
  "missing": "Open a saved action in Acquisition first. If it is unavailable, check access or skip this step to preview the guidance."
 },
 {
  "title": "Confirm publication details",
  "target": "[data-tour=\"action-work\"]",
  "text": "For work that is actually live, enter the publication date in Pacific time and use Published or Monitoring status. Click Save changes before measuring. This saves a real action update; it does not edit the website. Keep unpublished work Planned. Viewers can read results but need an analyst or administrator to save or measure.",
  "ready": null,
  "reveal": [
   ".tracked-keywords",
   "#growth-action-list"
  ],
  "missing": "Open a saved action in Acquisition first. If it is unavailable, check access or skip this step to preview the guidance."
 },
 {
  "title": "Run a 7-day or 28-day review",
  "target": "[data-tour=\"action-measure\"]",
  "text": "Choose Measure 7 days or Measure 28 days when enabled. Each compares equal windows before and after publication, excluding publication day. Disabled controls can mean the window is not complete, the action is unpublished, or you lack edit access. Read the waiting message; finalized source data may also lag. Measuring saves a real result on request, not on a schedule. You can skip instead.",
  "ready": null,
  "reveal": [
   ".tracked-keywords",
   "#growth-action-list"
  ],
  "missing": "Open a saved action in Acquisition first. If it is unavailable, check access or skip this step to preview the guidance."
 },
 {
  "title": "Open and compare saved results",
  "target": "[data-tour=\"action-outcome\"] > summary",
  "text": "Open a saved 7-day or 28-day result. Check its before/after dates, saved timestamp, and any warning about a different publication date. Compare clicks, impressions, organic landing sessions, and contact sessions. Contact rate changes use percentage points. Missing values are not zero, and small samples can make rates unstable. These contact metrics do not verify policies sold.",
  "ready": "[data-tour=\"action-outcome\"][open] [data-tour=\"outcome-metrics\"]",
  "reveal": [
   ".tracked-keywords",
   "#growth-action-list"
  ],
  "missing": "Open a saved results summary. If no measurement exists or source data is unavailable, skip and record that results are not yet available."
 },
 {
  "title": "Check rankings and evidence limits",
  "target": "[data-tour=\"action-outcome\"][open] [data-tour=\"outcome-rankings\"]",
  "text": "Review comparable tracked keywords and the before/after snapshot dates. Positive rank improvement means a better ranking. Missing compatible snapshots mean rankings are unavailable, not unchanged. Read source coverage and the disclaimer. Seasonality, search updates, other edits, and tracking changes can also affect results.",
  "ready": null,
  "reveal": [
   ".tracked-keywords",
   "#growth-action-list"
  ],
  "missing": "Expand a saved results summary to inspect rankings and coverage, or skip if no result exists."
 },
 {
  "title": "Record your conclusion and next action",
  "target": "[data-tour=\"action-work\"]",
  "text": "Return to What changed / work notes and append a dated review without removing the original plan: “After [change] went live on [date], the [7/28]-day review showed [before → after metrics]. Assessment: improved, declined, mixed, or too early to tell. Limits: [missing data or other influences]. Next: [action and review date].” Click Save changes to keep it. Describe observed results; a change after publication does not prove your work caused it.",
  "ready": null,
  "reveal": [
   ".tracked-keywords",
   "#growth-action-list"
  ],
  "missing": "Open a saved action in Acquisition first. If it is unavailable, check access or skip this step to preview the guidance."
 }
];

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
