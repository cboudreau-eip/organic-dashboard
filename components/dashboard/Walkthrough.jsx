'use client';
import {useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {opportunitySteps,visibleTarget,revealStep} from './walkthrough';
import './walkthrough.css';

export default function Walkthrough({allowed=false}) {
 const [step,setStep]=useState(null),[menu,setMenu]=useState(false),[ready,setReady]=useState(false),[hasTarget,setHasTarget]=useState(false);
 const launcher=useRef(null),panel=useRef(null),target=useRef(null);
 const active=step!==null;
 function exit(){setStep(null);setMenu(false);launcher.current?.focus();}
 function start(){setMenu(false);setStep(0);}
 useEffect(()=>{if(menu)panel.current?.focus();},[menu]);
 useEffect(()=>{
  if(!menu&&!active)return;
  const key=event=>{if(event.key==='Escape'){event.preventDefault();exit();}};
  document.addEventListener('keydown',key);
  return()=>document.removeEventListener('keydown',key);
 },[menu,active]);
 useEffect(()=>{
  if(!active)return;
  const definition=opportunitySteps[step];
  let stopped=false,last=null;
  setReady(false);
  revealStep(step);
  panel.current?.focus();
  const update=()=>{
   if(stopped)return;
   const node=visibleTarget(definition.target);
   setHasTarget(!!node);
   const canContinue=!!node&&(!definition.ready||!!visibleTarget(definition.ready));
   setReady(previous=>previous===canContinue?previous:canContinue);
   if(node!==last){
    last?.classList.remove('walkthrough-highlight');last=node;target.current=node;
    node?.classList.add('walkthrough-highlight');
    node?.scrollIntoView?.({block:'center',behavior:'instant'});
   }
  };
  const timer=window.setInterval(update,400);update();
  document.body.classList.add('walkthrough-active');
  return()=>{stopped=true;window.clearInterval(timer);last?.classList.remove('walkthrough-highlight');target.current=null;document.body.classList.remove('walkthrough-active');};
 },[active,step]);
 function focusControl(){
  const node=target.current;if(!node)return;
  const control=node.matches('button,input,select,a,textarea,summary')?node:node.querySelector('button:not(:disabled),input,select,a,textarea,summary');
  control?.focus();node.scrollIntoView?.({block:'center',behavior:'instant'});
 }
 return <>
  <div className="walkthrough-launcher">
   <button ref={launcher} type="button" className="button" aria-expanded={menu||active} aria-controls="walkthrough-panel" onClick={()=>{if(active)panel.current?.focus();else setMenu(v=>!v);}}>Help &amp; walkthroughs</button>
  </div>
  {(menu||active)&&createPortal(<aside id="walkthrough-panel" ref={panel} tabIndex={-1} className="walkthrough-panel" aria-label="Guided walkthrough">
   <div className="walkthrough-top"><span>{active?`STEP ${step+1} OF ${opportunitySteps.length}`:'GUIDED WALKTHROUGHS'}</span><button type="button" className="button" onClick={exit}>Exit</button></div>
   <div aria-live="polite" aria-atomic="true"><h2>{active?opportunitySteps[step].title:'Find and save your first opportunity'}</h2>
    <p>{active?opportunitySteps[step].text:'Follow the real dashboard controls from search performance to a saved action. Start, exit, or replay whenever you need help.'}</p>
   </div>
   {!active? <>{allowed?<button type="button" className="button primary" onClick={start}>Start walkthrough</button>:<p>This walkthrough requires Growth Hunter team access. Ask your dashboard administrator to enable access to tracked keywords and saved actions.</p>}</>:<>
    {!ready&&<p className="walkthrough-wait" role="status">{opportunitySteps[step].missing}</p>}
    <div className="walkthrough-actions">
     <button type="button" className="button" disabled={step===0} onClick={()=>setStep(s=>s-1)}>Back</button>
     <button type="button" className="button" onClick={focusControl} disabled={!hasTarget}>Focus control</button>
     <button type="button" className="button" onClick={start}>Restart</button>
     {step<opportunitySteps.length-1&&<button type="button" className="button" onClick={()=>setStep(s=>s+1)}>Skip step</button>}
     <button type="button" className="button primary" disabled={!ready&&step!==opportunitySteps.length-1} onClick={()=>step===opportunitySteps.length-1?exit():setStep(s=>s+1)}>{step===opportunitySteps.length-1?'Finish walkthrough':'Next'}</button>
    </div><small>Use the highlighted controls directly. Escape exits. Skipping or finishing does not save any work.</small>
   </>}
  </aside>,document.body)}
 </>;
}
