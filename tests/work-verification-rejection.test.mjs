import test from 'node:test';import assert from 'node:assert/strict';import {correctedAssessment} from '../lib/work-queue/verification.js';
test('rejected draft rationale never becomes the unresolved brief finding',()=>{
 const parent={id:'old',payload:{target:'https://www.medicarefaq.com/example',sources:[],warnings:[],result:{changes:[],checks:[],preserve:[],links:[]}}};
 const verdict={id:'check:0',question:'Which benefit is covered?',section:'Benefits',status:'Correction needed',instruction:'Unsupported correction',reason:'False draft claim',evidence:[]};
 const saved=correctedAssessment(parent,[verdict],[{id:'check:0',supported:false,reason:'The table columns do not establish that claim.',evidence:[]}],[],[]);
 assert.match(saved.verification.items[0].remainingQuestion,/Not verified/);assert.match(saved.brief,/table columns/);assert.ok(!saved.brief.includes('False draft claim'));assert.equal(saved.verification.items[0].status,'Unresolved');
});
