import test from 'node:test';
import assert from 'node:assert/strict';
import {assignmentTitle,assignmentPresentation} from '../lib/research/proposal-presentation.js';
import {publicProposalPlan} from '../lib/research/proposals.js';
test('working titles preserve topic qualifiers and do not promise best plans',()=>{
 assert.equal(assignmentTitle('can i switch to medigap without underwriting'),'Can I switch to Medigap without underwriting?');
 assert.match(assignmentTitle('best rated medicare part d plans'),/^Compare options/);
 assert.match(assignmentTitle('medigap plan n vs plan g'),/Plan N vs\. Plan G/);
 assert.match(assignmentTitle('irmaa 2027'),/IRMAA 2027/);
});
test('presentation leaves saved edits, evidence, versions and fixed dates untouched',()=>{
 const item={id:'a',title:'medicare part d costs',category:'High intent',evidence:{gsc:[{keys:['medicare part d costs'],impressions:20}]}};
 const plan={version:4,payload:{items:[item]},edits:{a:{title:'My chosen title',notes:'My notes'}},calendar:{status:'Tentative',dates:{a:'2027-01-01'},locked:['a']}};
 const before=structuredClone(plan),view=publicProposalPlan(plan);
 assert.deepEqual(plan,before);assert.equal(view.payload.items[0].title,'My chosen title');assert.equal(view.payload.items[0].originalTitle,item.title);
 assert.deepEqual(view.calendar,before.calendar);assert.equal(view.version,4);assert.deepEqual(view.payload.items[0].evidence,item.evidence);
 assert.match(view.payload.items[0].whyAssignment.facts[0],/GSC/);
});
test('citation unknowns are not treated as zero and suggestions have no invented demand',()=>{
 const p=assignmentPresentation({title:'a question',category:'AI citations',evidence:{otterly:[{citations:null},{citations:0},{citations:3}]}});
 assert.match(p.whyAssignment.facts[0],/1 recorded zero/);assert.match(p.whyAssignment.facts[0],/unavailable/);
 const empty=assignmentPresentation({title:'suggestion',category:'Evergreen'});
 assert.match(empty.whyAssignment.facts[0],/No measured/);
});
