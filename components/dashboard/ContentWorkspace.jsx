'use client';
import {useState} from 'react';
import ContentPlan from './ContentPlan';
import ResearchOpportunities from './ResearchOpportunities';
import ContentAssignments from './ContentAssignments';
import ProposedAssignments from './ProposedAssignments';
export default function ContentWorkspace({active}){
 const [tab,setTab]=useState('proposals');
 return <><nav className="content-plan" aria-label="Content planning views"><button aria-pressed={tab==='proposals'} onClick={()=>setTab('proposals')}>90 proposed assignments</button>{' '}<button aria-pressed={tab==='research'} onClick={()=>setTab('research')}>Research opportunities</button>{' '}<button aria-pressed={tab==='assignments'} onClick={()=>setTab('assignments')}>Content assignments</button>{' '}<button aria-pressed={tab==='earlier'} onClick={()=>setTab('earlier')}>Earlier manual draft</button></nav>{tab==='proposals'?<ProposedAssignments active={active}/>:tab==='research'?<ResearchOpportunities active={active}/>:tab==='assignments'?<ContentAssignments active={active}/>:<><p className="content-plan">This is the earlier manually curated draft. New research and review decisions are kept in Research opportunities.</p><ContentPlan active={active}/></>}</>;
}
