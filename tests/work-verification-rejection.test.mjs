import test from 'node:test';import assert from 'node:assert/strict';import {correctedAssessment} from '../lib/work-queue/verification.js';
test('rejected draft rationale never becomes the unresolved brief finding',()=>{
 const parent={id:'old',payload:{target:'https://www.medicarefaq.com/example',sources:[],warnings:[],result:{changes:[],checks:[],preserve:[],links:[]}}};
 const verdict={id:'check:0',question:'Which benefit is covered?',section:'Benefits',status:'Correction needed',instruction:'Unsupported correction',reason:'False draft claim',evidence:[]};
 const saved=correctedAssessment(parent,[verdict],[{id:'check:0',supported:false,reason:'The table columns do not establish that claim.',evidence:[]}],[],[]);
 assert.match(saved.verification.items[0].remainingQuestion,/Not verified/);assert.match(saved.brief,/table columns/);assert.ok(!saved.brief.includes('False draft claim'));assert.equal(saved.verification.items[0].status,'Unresolved');
});
import {benefitEvidenceConcern,outstandingItems} from '../lib/work-queue/verification.js';
test('plan benefit instructions cannot pass with unrelated official evidence and are reopened',()=>{
 const item={id:'change:3',status:'Correction needed',instruction:'State Plan N does not cover the Part A deductible.',evidence:[{kind:'official',text:'You can buy a Medigap policy.'}]};
 assert.match(benefitEvidenceConcern(item),/not established/);assert.equal(outstandingItems({verification:{items:[item]}}).length,1);
 const parent={id:'old',payload:{target:'https://www.medicarefaq.com/example',sources:[],warnings:[],result:{changes:[],checks:[],preserve:[],links:[]}}};
 const saved=correctedAssessment(parent,[{...item,section:'Benefits'}],[{id:item.id,supported:true,reason:'Model agrees.',evidence:[]}],[],[]);
 assert.equal(saved.verification.items[0].status,'Unresolved');assert.ok(!saved.brief.split('### Unresolved')[0].includes(item.instruction));
});
