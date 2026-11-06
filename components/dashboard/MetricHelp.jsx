'use client';
import {useEffect,useId,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import './metric-help.css';

export default function MetricHelp({label,definition}){
 const id=useId(),button=useRef(null),panel=useRef(null),timer=useRef(null);
 const [position,setPosition]=useState(null);
 function cancel(){clearTimeout(timer.current);}
 function open(){cancel();const r=button.current.getBoundingClientRect();const width=Math.min(340,window.innerWidth-24);setPosition({left:Math.max(12,Math.min(r.left,window.innerWidth-width-12)),top:r.bottom+8,width});}
 function close(){cancel();setPosition(null);}
 function leave(){cancel();timer.current=setTimeout(()=>{if(document.activeElement!==button.current)setPosition(null);},180);}
 useEffect(()=>()=>clearTimeout(timer.current),[]);
 useEffect(()=>{
  if(!position)return;
  const dismiss=e=>{if(!button.current?.contains(e.target)&&!panel.current?.contains(e.target))setPosition(null);};
  const escape=e=>{if(e.key==='Escape')setPosition(null);};
  const reposition=e=>{
   if(e.target?.nodeType&&panel.current?.contains(e.target))return;
   const r=button.current?.getBoundingClientRect();if(!r)return;
   if(r.bottom<0||r.top>window.innerHeight){setPosition(null);return;}
   const width=Math.min(340,window.innerWidth-24),height=panel.current?.getBoundingClientRect().height||0;
   setPosition({left:Math.max(12,Math.min(r.left,window.innerWidth-width-12)),top:Math.max(12,Math.min(r.bottom+8,window.innerHeight-height-12)),width});
  };
  document.addEventListener('pointerdown',dismiss);document.addEventListener('keydown',escape);window.addEventListener('resize',reposition);window.addEventListener('scroll',reposition,true);
  const rect=panel.current?.getBoundingClientRect();
  if(rect&&rect.bottom>window.innerHeight-12)setPosition(p=>({...p,top:Math.max(12,window.innerHeight-rect.height-12)}));
  return()=>{document.removeEventListener('pointerdown',dismiss);document.removeEventListener('keydown',escape);window.removeEventListener('resize',reposition);window.removeEventListener('scroll',reposition,true);};
 },[!!position]);
 if(!definition)return null;
 return <><button ref={button} type="button" className="metric-help-trigger" aria-label={`About ${label}`} aria-describedby={position?id:undefined} aria-expanded={!!position} onMouseEnter={open} onMouseLeave={leave} onFocus={open} onBlur={close} onClick={open}>ⓘ</button>{position&&createPortal(<span ref={panel} id={id} role="tooltip" className="metric-help-panel" style={position} onMouseEnter={cancel} onMouseLeave={leave}><strong>{label}</strong><span>{definition.meaning}</span><span><b>Calculation:</b> {definition.calculation}</span><span><b>Source:</b> {definition.source}</span><span><b>Keep in mind:</b> {definition.limit}</span><small>Press Escape or tap outside to close.</small></span>,document.body)}</>;
}
