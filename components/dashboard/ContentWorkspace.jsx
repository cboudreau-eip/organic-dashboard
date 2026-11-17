'use client';
import {useState} from 'react';
import ContentPlan from './ContentPlan';
import ResearchOpportunities from './ResearchOpportunities';
import ContentAssignments from './ContentAssignments';
import ProposedAssignments from './ProposedAssignments';
import WorkQueue from './WorkQueue';
import './content-plan.css';

export default function ContentWorkspace({active}){
 const [tab,setTab]=useState('proposals'),[workDirty,setWorkDirty]=useState(false);
 const supportingView=['research','assignments','earlier'].includes(tab)?tab:'';
 return <>
  <nav className="content-plan workspace-navigation" aria-label="Content planning views">
   <div className="workspace-primary">
    <button aria-label="Content calendar" disabled={workDirty} aria-pressed={tab==='proposals'} onClick={()=>setTab('proposals')}><strong>Content calendar</strong><span>Plan and schedule assignments</span></button>
    <button aria-label="Work queue" disabled={workDirty} aria-pressed={tab==='work'} onClick={()=>setTab('work')}><strong>Work queue</strong><span>Manage owners, progress and briefs</span></button>
   </div>
   <label className="workspace-tools">Planning tools<select disabled={workDirty} value={supportingView} onChange={e=>{if(e.target.value)setTab(e.target.value);}}><option value="" disabled>Research and drafts</option><option value="research">Research opportunities</option><option value="assignments">Assignment review</option><option value="earlier">Original draft</option></select></label>
  </nav>
  {tab==='work'?<WorkQueue active={active} onDirtyChange={setWorkDirty}/>:tab==='proposals'?<ProposedAssignments active={active}/>:tab==='research'?<ResearchOpportunities active={active}/>:tab==='assignments'?<ContentAssignments active={active}/>:<><p className="content-plan">Original draft — the earlier manually curated plan. Use Content calendar for your current schedule or Work queue to manage content work.</p><ContentPlan active={active}/></>}
 </>;
}
