'use client';
import {useState} from 'react';
import ContentPlan from './ContentPlan';
import ResearchOpportunities from './ResearchOpportunities';
import ContentAssignments from './ContentAssignments';
import ProposedAssignments from './ProposedAssignments';
import WorkQueue from './WorkQueue';
import './content-plan.css';

export default function ContentWorkspace({active}){
 const [tab,setTab]=useState('proposals'),[workDirty,setWorkDirty]=useState(false),[researchTab,setResearchTab]=useState('research');
 const [workTarget,setWorkTarget]=useState(null),[calendarTarget,setCalendarTarget]=useState(null);
 const openCalendar=target=>{if(workDirty)return;setCalendarTarget(target?.assignmentId?target:null);setTab('proposals');};
 const openWork=target=>{setWorkTarget(target);setTab('work');};
 const inResearch=['research','assignments','earlier'].includes(tab);
 const openResearch=view=>{setResearchTab(view);setTab(view);};
 return <>
  <nav className="content-plan workspace-navigation" aria-label="Content planning views">
   <div className="workspace-primary">
    <button aria-label="Calendar" disabled={workDirty} aria-pressed={tab==='proposals'} onClick={()=>setTab('proposals')}><strong>Calendar</strong><span>Plan and schedule assignments</span></button>
    <button aria-label="Work queue" disabled={workDirty} aria-pressed={tab==='work'} onClick={()=>setTab('work')}><strong>Work queue</strong><span>Manage progress and briefs</span></button>
   </div>
   <button className="workspace-research-entry" aria-label="Research" disabled={workDirty} aria-pressed={inResearch} onClick={()=>setTab(researchTab)}><strong>Research</strong><span>Find and review opportunities</span></button>
   {workDirty&&<p className="workspace-navigation-note" role="status">Save or discard your work queue edits before switching sections.</p>}
  </nav>
  <details className="content-plan workspace-status-guide"><summary>What do the statuses mean?</summary><dl><div><dt>Research decision</dt><dd>Needs review · Keep · Defer · Reject. Your choice about whether an opportunity is worth pursuing.</dd></div><div><dt>Research assessment</dt><dd>Ready for review · Needs research · No change suggested. What the evidence checks found, not your decision or work progress.</dd></div><div><dt>Work status</dt><dd>To do · In progress · Completed. Tracks your work separately from tentative planning. Completed means the task is finished; it does not publish content.</dd></div><div><dt>Schedule</dt><dd>Tentative dates are planning placeholders. A fixed date stays in place during rebalancing; it does not approve research or mark work complete.</dd></div></dl><p>Keeping research does not automatically start a task or change its work status.</p></details>
  {inResearch&&<section className="content-plan workspace-research-navigation" aria-label="Research navigation"><div><h2>Research</h2><p>Find promising topics, then review the suggested assignments.</p></div><nav aria-label="Research views"><button aria-pressed={tab==='research'} onClick={()=>openResearch('research')}>Research opportunities</button><button aria-pressed={tab==='assignments'} onClick={()=>openResearch('assignments')}>Assignment review</button></nav><details className="workspace-legacy"><summary>Earlier planning</summary><p>The original manually curated draft is separate from your current calendar.</p><button aria-pressed={tab==='earlier'} onClick={()=>openResearch('earlier')}>Open original draft</button></details></section>}
  <div hidden={tab!=='proposals'}><ProposedAssignments active={active&&tab==='proposals'} onOpenWork={openWork} onOpenResearch={()=>openResearch('research')} openAssignment={calendarTarget}/></div>
  <div hidden={tab!=='work'}><WorkQueue active={active&&tab==='work'} onDirtyChange={setWorkDirty} openTask={workTarget} onOpenCalendar={openCalendar}/></div>
  {tab==='research'?<ResearchOpportunities active={active}/>:tab==='assignments'?<ContentAssignments active={active} onOpenResearch={()=>openResearch('research')}/>:tab==='earlier'?<><p className="content-plan">Original draft — the earlier manually curated plan. Use Calendar for your current schedule or Work queue to manage content work.</p><ContentPlan active={active}/></>:null}
 </>;
}
