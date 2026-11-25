import test from 'node:test';import assert from 'node:assert/strict';
import {expansionCandidates,expandPlan} from '../lib/research/expand-plan.js';
test('new opportunity pool requires intent and observations and excludes saved terms and unsupported historical queries',()=>{
 const plan={payload:{items:[{id:'a',title:'Plan G costs',terms:['plan g costs']}]},edits:{}};
 const source={evidence:{semrush:{rows:[{keyword:'plan g costs',volume:100},{keyword:'compare medigap quotes for frequent travelers',volume:20},{keyword:'medicare login',volume:50},{keyword:'medicare costs 2024',volume:10},{keyword:'buy medigap insurance online',volume:0}]}}};
 const before=JSON.stringify(plan);const result=expansionCandidates(plan,source,null);
 assert.equal(result.length,1);assert.match(result[0].title,/travelers/);assert.equal(JSON.stringify(plan),before);
});
test('coverage checks skip existing pages and failed reads; added opportunities retain inspected sources',async()=>{
 const plan={research_run_id:'run',payload:{items:[]}},source={evidence:{semrush:{rows:[{keyword:'compare medigap quotes for frequent travelers',volume:20}]}},inventory:{pages:Array.from({length:20},(_,i)=>({url:'https://www.medicarefaq.com/medigap-guide-'+i,title:'Medigap comparison overview',headings:[],status:'read',text:'Overview '.repeat(40)}))}};
 const html='<title>Medigap overview</title><main><h1>Medigap overview</h1><p>'+('General Medicare supplement coverage. '.repeat(30))+'</p></main>';
 const result=await expandPlan(plan,source,null,{},async url=>({url,html}));
 assert.equal(result.items.length,1);assert.equal(result.items[0].targetUrl,'');assert.equal(result.items[0].category,'Long-tail');assert.equal(result.items[0].expansionEvidence.checks.length,2);
 const failed=await expandPlan(plan,source,null,{},async()=>{throw Error('unavailable');});assert.equal(failed.items.length,0);
 source.inventory.pages[0].title='Compare Medigap quotes for frequent travelers';
 const covered=await expandPlan(plan,source,null,{},async url=>({url,html}));assert.equal(covered.items.length,0);
});
