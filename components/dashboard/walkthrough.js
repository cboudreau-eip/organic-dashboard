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
export function revealStep(index, root=document) {
 const selectors=index===1?['.gsc-performance']:index>=2?['.tracked-keywords', ...(index===6?['#growth-action-list']:[])]:[];
 for(const selector of selectors) root.querySelector(selector)?.querySelector(':scope > .dashboard-section-header button[aria-expanded="false"]')?.click();
}
