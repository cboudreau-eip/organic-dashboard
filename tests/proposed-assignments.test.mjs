import test from 'node:test';
import assert from 'node:assert/strict';
import {generateProposals,proposalEdit,publicProposalPlan,MIX} from '../lib/research/proposals.js';
import {DEFAULTS} from '../lib/research/contracts.js';
test('demo reaches 90 distinct labeled proposals without inventing evidence or approvals',()=>{
 const p=generateProposals({},DEFAULTS);assert.equal(p.items.length,90);assert.equal(new Set(p.items.map(x=>x.id)).size,90);
 for(const [category,n] of Object.entries(MIX))assert.equal(p.items.filter(x=>x.category===category).length,n);
 assert.ok(p.items.every(x=>x.basis==='Research suggestion'&&!x.scheduledDate&&!x.approved&&x.evidence.gsc.length===0));
 assert.ok(p.items.filter(x=>x.category==='Long-tail').every(x=>x.title.split(/\s+/).length>=5));
});
test('Otterly citation facts and unknowns are preserved and evergreen has its own allocation',()=>{
 const p=generateProposals({evidence:{otterly:{status:'available',period:{start:'2026-10-01',end:'2026-10-30'},prompts:[{id:'p',prompt:'What should I compare before choosing Medicare Plan G?',mentions:0,domainMentions:0},{id:'q',prompt:'How do I compare Medicare Part D plans?',mentions:2}]},gsc:{rows:[{keys:['what is medicare','https://www.medicarefaq.com/'],impressions:500,clicks:4,position:10}]}}},DEFAULTS);
 assert.equal(p.items.length,90);const ai=p.items.filter(x=>x.category==='AI citations'&&x.basis==='Observed opportunity');assert.equal(ai.length,2);assert.equal(ai[0].evidence.otterly[0].citations,0);assert.equal(ai[1].evidence.otterly[0].citations,null);
 assert.ok(p.items.some(x=>x.category==='Evergreen'&&x.title==='what is medicare'));
 assert.equal(p.sourceDates.otterly.period.end,'2026-10-30');
});
test('equivalent wording is not assigned twice across categories and exclusions remain binding',()=>{
 const p=generateProposals({results:{items:[{key:'a',title:'compare medigap plan g costs',terms:['compare medigap plan g costs'],score:80,evidence:{gsc:[],semrush:[],otterly:[]}},{key:'b',title:'compare medicare supplement plan g costs',terms:['compare medicare supplement plan g costs'],score:79,evidence:{gsc:[],semrush:[],otterly:[]}}]}},DEFAULTS);
 assert.equal(p.items.filter(x=>/compare (medigap|medicare supplement) plan g costs/.test(x.title)).length,1);
 const restricted=generateProposals({}, {...DEFAULTS,excluded:['medicare','medigap']});assert.equal(restricted.items.length,0);
});
test('editing changes only allowed proposal fields and never the saved evidence',()=>{
 const item=generateProposals({},DEFAULTS).items[0];assert.throws(()=>proposalEdit({itemId:item.id,fields:{evidence:{}}},[item]));assert.throws(()=>proposalEdit({itemId:item.id,fields:{targetUrl:'javascript:alert(1)'}},[item]));assert.throws(()=>proposalEdit({itemId:item.id,fields:{title:''}},[item]));
 const fields=proposalEdit({itemId:item.id,fields:{title:'Demo revision',notes:'Review later'}},[item]);const raw={payload:{items:[item]},edits:{[item.id]:fields}};assert.equal(publicProposalPlan(raw).payload.items[0].title,'Demo revision');assert.notEqual(raw.payload.items[0].title,'Demo revision');
});
