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
 const inResearch=['research','assignments','earlier'].includes(tab);
 const openResearch=view=>{setResearchTab(view);setTab(view);};
 return <>
  <nav className="content-plan workspace-navigation" aria-label="Content planning views">
   <div className="workspace-primary">
    <button aria-label="Calendar" disabled={workDirty} aria-pressed={tab==='proposals'} onClick={()=>setTab('proposals')}><strong>Calendar</strong><span>Plan and schedule assignments</span></button>
    <button aria-label="Work queue" disabled={workDirty} aria-pressed={tab==='work'} onClick={()=>setTab('work')}><strong>Work queue</strong><span>Manage owners, progress and briefs</span></button>
   </div>
   <button className="workspace-research-entry" aria-label="Research" disabled={workDirty} aria-pressed={inResearch} onClick={()=>setTab(researchTab)}><strong>Research</strong><span>Find and review opportunities</span></button>
   {workDirty&&<p className="workspace-navigation-note" role="status">Save or discard your work queue edits before switching sections.</p>}
  </nav>
  {inResearch&&<section className="content-plan workspace-research-navigation" aria-label="Research navigation"><div><h2>Research</h2><p>Find promising topics, then review the suggested assignments.</p></div><nav aria-label="Research views"><button aria-pressed={tab==='research'} onClick={()=>openResearch('research')}>Research opportunities</button><button aria-pressed={tab==='assignments'} onClick={()=>openResearch('assignments')}>Assignment review</button></nav><details className="workspace-legacy"><summary>Earlier planning</summary><p>The original manually curated draft is separate from your current calendar.</p><button aria-pressed={tab==='earlier'} onClick={()=>openResearch('earlier')}>Open original draft</button></details></section>}
  {tab==='work'?<WorkQueue active={active} onDirtyChange={setWorkDirty}/>:tab==='proposals'?<ProposedAssignments active={active}/>:tab==='research'?<ResearchOpportunities active={active}/>:tab==='assignments'?<ContentAssignments active={active}/>:<><p className="content-plan">Original draft — the earlier manually curated plan. Use Calendar for your current schedule or Work queue to manage content work.</p><ContentPlan active={active}/></>}
 </>;
}
