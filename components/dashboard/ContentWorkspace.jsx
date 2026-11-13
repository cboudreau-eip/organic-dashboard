'use client';
import {useState} from 'react';
import ContentPlan from './ContentPlan';
import ResearchOpportunities from './ResearchOpportunities';
export default function ContentWorkspace({active}){
 const [tab,setTab]=useState('research');
 return <><nav className="content-plan" aria-label="Content planning views"><button aria-pressed={tab==='research'} onClick={()=>setTab('research')}>Research opportunities</button>{' '}<button aria-pressed={tab==='earlier'} onClick={()=>setTab('earlier')}>Earlier manual draft</button></nav>{tab==='research'?<ResearchOpportunities active={active}/>:<><p className="content-plan">This is the earlier manually curated draft. New research and review decisions are kept in Research opportunities.</p><ContentPlan active={active}/></>}</>;
}
