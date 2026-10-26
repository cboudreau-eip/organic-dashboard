import {pageKey} from './gsc-pages.js';
// PostHog's attribution is host + pathname, not an exact full URL.
export function landingKey(value){
 const valid=pageKey(value);
 if(!valid)return null;
 const url=new URL(valid);
 if(url.search||url.port)return null;
 return url.hostname+url.pathname;
}
export function leadImpact(groups,report){
 const index=rows=>new Map((rows||[]).map(r=>[r.host+r.path,r]));
 const now=index(report?.current?.rows),prior=index(report?.previous?.rows);
 return groups.map(g=>{
  const key=landingKey(g.url),current=now.get(key)??null,previous=prior.get(key)??null;
  const comparable=!!current&&!!previous;
  const contacts=Math.max(current?.contactSessions||0,previous?.contactSessions||0);
  let priority='Review data',order=4,action='No matched current landing cohort. Missing data is not zero.';
  if(current){
   priority='Monitor';order=3;action='Review contact counts and sample size before choosing an update.';
   if(g.gsc?.clicksChange<0&&contacts>0){priority='Protect lead-producing page';order=0;action='Inspect lost GSC queries and ranking changes. This page has recorded contact sessions; the traffic decline is not proof of a lead decline.';}
   else if(g.pageTwo>0&&current.contactSessions>0){priority='Explore ranking opportunity';order=1;action='Review positions 11–20 keywords and relevant internal links. Contact history is observed, not a forecast.';}
   else if(comparable&&current.contactSessions<previous.contactSessions){priority='Investigate fewer contacts';order=2;action='Check landing traffic, tracking and form performance before attributing the change to content.';}
  }
  return {...g,lead:{current,previous,contactChange:comparable?current.contactSessions-previous.contactSessions:null,rateChange:comparable&&current.rate!=null&&previous.rate!=null?current.rate-previous.rate:null,priority,order,action}};
 });
}
