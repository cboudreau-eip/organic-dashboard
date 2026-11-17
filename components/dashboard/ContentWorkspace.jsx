'use client';
import {useState} from 'react';
import ContentPlan from './ContentPlan';
import ResearchOpportunities from './ResearchOpportunities';
import ContentAssignments from './ContentAssignments';
import ProposedAssignments from './ProposedAssignments';
import WorkQueue from './WorkQueue';
export default function ContentWorkspace({active}){
 const [tab,setTab]=useState('proposals'),[workDirty,setWorkDirty]=useState(false);
 return <><nav className="content-plan" aria-label="Content planning views"><button disabled={workDirty} aria-pressed={tab==='work'} onClick={()=>setTab('work')}>This week</button>{' '}<button disabled={workDirty} aria-pressed={tab==='proposals'} onClick={()=>setTab('proposals')}>90 proposed assignments</button>{' '}<button disabled={workDirty} aria-pressed={tab==='research'} onClick={()=>setTab('research')}>Research opportunities</button>{' '}<button disabled={workDirty} aria-pressed={tab==='assignments'} onClick={()=>setTab('assignments')}>Content assignments</button>{' '}<button disabled={workDirty} aria-pressed={tab==='earlier'} onClick={()=>setTab('earlier')}>Earlier manual draft</button></nav>{tab==='work'?<WorkQueue active={active} onDirtyChange={setWorkDirty}/>:tab==='proposals'?<ProposedAssignments active={active}/>:tab==='research'?<ResearchOpportunities active={active}/>:tab==='assignments'?<ContentAssignments active={active}/>:<><p className="content-plan">This is the earlier manually curated draft. New research and review decisions are kept in Research opportunities.</p><ContentPlan active={active}/></>}</>;
}
