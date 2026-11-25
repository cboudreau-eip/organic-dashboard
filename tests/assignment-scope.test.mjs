import test from 'node:test';
import assert from 'node:assert/strict';
import {assignmentScope,savedAssignmentScope} from '../lib/research/assignment-scope.js';
import {publicProposalPlan} from '../lib/research/proposals.js';
import {workQueueHandlers} from '../lib/work-queue/handlers.js';
const targetUrl='https://www.medicarefaq.com/example/';
test('scope distinguishes new proposals, existing updates and unresolved research without using category',()=>{
 assert.equal(assignmentScope({type:'New-page proposal'}).label,'New content');
 assert.equal(assignmentScope({action:'Create a new article about Plan G.'}).label,'New content');
 assert.equal(assignmentScope({targetUrl,category:'Evergreen'}).label,'Refresh');
 assert.equal(assignmentScope({category:'Evergreen'}).label,'Needs review');
 assert.equal(assignmentScope({type:'New-page investigation'}).label,'Needs review');
 assert.equal(assignmentScope({type:'New-page proposal',targetUrl}).label,'Needs review');
 assert.equal(assignmentScope({type:'New-page proposal',action:'Refresh the existing page.'}).label,'Needs review');
 assert.equal(assignmentScope({targetUrl,action:'Update this page. Do not create a new article.'}).label,'Refresh');
});
test('manual scope edits override older decisions without changing saved data or dates',()=>{
 const item={id:'a',title:'Example',targetUrl:'',type:'New-page proposal',action:'Plan a distinct page about Plan G.'};
 const edits={a:{action:'Update the existing page.',targetUrl}};
 const plan={payload:{items:[item]},edits,calendar:{dates:{a:'2027-01-05'}}},before=structuredClone(plan);
 assert.equal(publicProposalPlan(plan).payload.items[0].contentScope.label,'Refresh');
 assert.equal(savedAssignmentScope({...item,targetUrl,type:'Existing-page investigation'},{targetUrl:''}).label,'New content');
 assert.equal(savedAssignmentScope({targetUrl,action:'Update the page.'},{targetUrl:''}).label,'Needs review');
 assert.deepEqual(plan,before);
});
test('queue reads current plan scope while preserving saved brief, snapshot, statuses and dates',async()=>{
 const queue={source_plan_id:'p',entries:[{assignment_id:'a',snapshot:{targetUrl},brief:'My saved instructions',status:'In progress',planned_date:'2027-01-05'}]};
 const plan={items:[{id:'a',targetUrl:'',type:'New-page proposal'}],edits:{},calendar:{dates:{a:'2027-01-05'}}};
 const before=structuredClone(queue);
 const client={from:table=>{const chain={select:()=>chain,order:()=>chain,limit:()=>chain,eq:()=>chain,maybeSingle:async()=>({data:table==='content_work_pilots'?queue:plan})};return chain;}};
 const h=workQueueHandlers({access:async()=>({client,role:'analyst'})});
 const response=await (await h.GET()).json();
 assert.equal(response.queue.entries[0].contentScope.label,'New content');
 const {contentScope,...entry}=response.queue.entries[0];
 assert.deepEqual(entry,before.entries[0]);assert.deepEqual(queue,before);
});
