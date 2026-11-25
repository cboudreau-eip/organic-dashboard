import test from 'node:test';import assert from 'node:assert/strict';
import {expansionCandidates,expandPlan} from '../lib/research/expand-plan.js';
const review=async ({candidates})=>candidates.map(c=>({id:c.id,keep:true,title:c.title,reason:'Distinct travel-specific buying decision after page review',distinctScope:'Compare travel coverage for frequent international travelers and their buying constraints.',relatedUrls:[]}));
test('new opportunity pool requires intent and observations and excludes saved terms and unsupported historical queries',()=>{
 const plan={payload:{items:[{id:'a',title:'Plan G costs',terms:['plan g costs']}]},edits:{}};
 const source={evidence:{semrush:{rows:[{keyword:'plan g costs',volume:100},{keyword:'compare medigap quotes for frequent travelers',volume:20},{keyword:'medicare login',volume:50},{keyword:'medicare costs 2024',volume:10},{keyword:'buy medigap insurance online',volume:0}]}}};
 const before=JSON.stringify(plan);const result=expansionCandidates(plan,source,null);
 assert.equal(result.length,1);assert.match(result[0].title,/travelers/);assert.equal(JSON.stringify(plan),before);
});
test('coverage checks skip existing pages and failed reads; added opportunities retain inspected sources',async()=>{
 const plan={research_run_id:'run',payload:{items:[]}},source={evidence:{semrush:{rows:[{keyword:'compare medigap quotes for frequent travelers',volume:20}]}},inventory:{pages:Array.from({length:20},(_,i)=>({url:'https://www.medicarefaq.com/medigap-guide-'+i,title:'Medigap comparison overview',headings:[],status:'read',text:'Overview '.repeat(40)}))}};
 const html='<title>Medigap overview</title><main><h1>Medigap overview</h1><p>'+('General Medicare supplement coverage. '.repeat(30))+'</p></main>';
 const result=await expandPlan(plan,source,null,{},async url=>({url,html}),new Date(),review);
 assert.equal(result.items.length,1);assert.equal(result.items[0].targetUrl,'');assert.equal(result.items[0].category,'Long-tail');assert.equal(result.items[0].expansionEvidence.checks.length,3);
 const failed=await expandPlan(plan,source,null,{},async()=>{throw Error('unavailable');},new Date(),review);assert.equal(failed.items.length,0);
 source.inventory.pages[0].title='Compare Medigap quotes for frequent travelers';
 const covered=await expandPlan(plan,source,null,{},async url=>({url,html}),new Date(),review);assert.equal(covered.items.length,0);
});
test('exam queries are excluded and semantic review fails closed',async()=>{
 const plan={payload:{items:[]}},source={evidence:{gsc:{rows:[{keys:['question 3answer a. enroll in medicare'],impressions:200},{keys:['compare medigap quotes for travelers'],impressions:100}]}},inventory:{pages:Array.from({length:20},(_,i)=>({url:'https://www.medicarefaq.com/guide-'+i,title:'Medigap comparison guide',headings:[]}))}};
 assert.equal(expansionCandidates(plan,source,null).length,1);
 await assert.rejects(expandPlan(plan,source,null),/Semantic opportunity review/);
 let reads=0;const result=await expandPlan(plan,source,null,{},async()=>{reads++;},new Date(),async()=>[]);
 assert.equal(result.items.length,0);assert.equal(reads,0);
 const html='<title>Medigap overview</title><main>'+('General insurance overview '.repeat(40))+'</main>';
 const rejected=await expandPlan(plan,source,null,{},async url=>({url,html}),new Date(),async input=>input.stage==='shortlist'?review(input):[]);
 assert.equal(rejected.items.length,0);
});
test('derived angles retain seed evidence and never claim measured exact-query demand',async()=>{
 const plan={payload:{items:[]}},source={evidence:{semrush:{rows:[{keyword:'compare medigap quotes',volume:100}]}},inventory:{pages:Array.from({length:20},(_,i)=>({url:'https://www.medicarefaq.com/overview-'+i,title:'Medigap guide',headings:[]}))}};
 const html='<title>Medigap guide</title><main>'+('General insurance coverage overview. '.repeat(40))+'</main>';
 const reviewer=async input=>(await review(input)).map(d=>({...d,query:'compare medigap quotes for frequent travelers'}));
 const result=await expandPlan(plan,source,null,{},async url=>({url,html}),new Date(),reviewer);
 assert.equal(result.items.length,1);assert.equal(result.items[0].basis,'Research suggestion');
 assert.equal(result.items[0].expansionEvidence.sourceTerm,'compare medigap quotes');
 assert.match(result.items[0].expansionEvidence.queryBasis,/not measured/);
 assert.equal(result.items[0].evidence.semrush[0].keyword,'compare medigap quotes');
 assert.equal(plan.payload.items.length,0);
});
