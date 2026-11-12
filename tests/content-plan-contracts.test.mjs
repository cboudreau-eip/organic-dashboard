import test from 'node:test';
import assert from 'node:assert/strict';
import {planInput,mergePlan} from '../lib/content-plan/contracts.js';
const input={id:'plan-g',version:0,status:'Needs review',owner:'',brief:'',scheduledDate:null,approved:false};
test('dates and production statuses require explicit approval',()=>{
 assert.equal(planInput(input,['plan-g']).scheduled_date,null);
 for(const change of [{scheduledDate:'2027-01-01'},{status:'Approved'},{status:'In progress'},{status:'Published'}])assert.throws(()=>planInput({...input,...change},['plan-g']),/Approve/);
 assert.equal(planInput({...input,approved:true,scheduledDate:'2027-03-31'},['plan-g']).scheduled_date,'2027-03-31');
 for(const date of ['2027-02-29','2027-04-01','2026-12-31','2027-01-32'])assert.throws(()=>planInput({...input,approved:true,scheduledDate:date},['plan-g']),/valid date/);
});
test('saved edits cannot replace source evidence or editorial rank',()=>{
 const result=mergePlan({items:[{id:'plan-g',score:90,evidence:{source:'GSC'}}]},[{id:'plan-g',score:1,evidence:{source:'fake'},version:2,status:'Approved',approved:true}]);
 assert.equal(result.items[0].score,90);assert.equal(result.items[0].evidence.source,'GSC');assert.equal(result.items[0].version,2);
 assert.throws(()=>planInput({...input,id:'unknown'},['plan-g']));
 assert.throws(()=>planInput({...input,version:-1},['plan-g']));
});
