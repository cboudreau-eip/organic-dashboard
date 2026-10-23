'use client';
import {createElement as h,useId,useState} from 'react';
export default function CollapsibleSection({title,header,children,className='',level=3,...props}){
 const id=useId(),[expanded,setExpanded]=useState(true);
 return h('section',{...props,className:className+' dashboard-collapsible'},
  h('div',{className:'dashboard-section-header'},
   header||h('h'+level,{className:'dashboard-section-title'},title),
   h('button',{type:'button',className:'dashboard-section-toggle','aria-expanded':expanded,'aria-controls':id,'aria-label':(expanded?'Collapse ':'Expand ')+title,onClick:()=>setExpanded(v=>!v)},
    h('span',null,expanded?'Collapse':'Expand'),h('span',{'aria-hidden':true},expanded?'▴':'▾'))),
  h('div',{id,hidden:!expanded,className:'dashboard-section-content'},children));
}
