import test from 'node:test';
import assert from 'node:assert/strict';
import {selectPool,enrichCandidates,assignmentFingerprint,priorDecision} from '../lib/research/assignment-pool.js';
import {applyVerification} from '../lib/research/assignment-verification.js';
import {previousDecisions} from '../lib/research/assignment-history.js';
const item=(i,type='Update existing page')=>({key:String(i),title:'compare medicare plan g '+i,type});
test('expanded pool reserves discovery slots, retains ranks and excludes service queries',()=>{
 const items=[...Array.from({length:80},(_,i)=>item(i)),...Array.from({length:25},(_,i)=>item(i+80,'New content candidate')),{title:'doctors that take medicare near me',type:'New content candidate'}];
 const p=selectPool(items,2027);assert.equal(p.items.length,60);assert.equal(p.counts.discovery,20);assert.equal(p.items[40].originalRank,81);assert.ok(!p.items.some(i=>i.title.includes('doctors')));
 const scarce=selectPool([item(1),{title:'customer service phone number',type:'New content candidate'}],2027);assert.equal(scarce.items.length,1);assert.equal(scarce.counts.discovery,0);
});
test('related-page inspections are bounded and missing inventory never proves a gap',()=>{
 const a={targetUrl:null,candidateUrls:[],topics:[{title:'compare plan g quotes',intent:'Transactional'}]};const enriched=enrichCandidates([a],Array.from({length:8},(_,i)=>({url:'https://www.medicarefaq.com/plan-g-'+i,title:'Compare Plan G quotes',status:'read'})),false)[0];assert.equal(enriched.candidateUrls.length,3);assert.equal(enriched.coverage.relatedCount,8);assert.equal(enriched.coverage.inventoryComplete,false);
});
const a={targetUrl:'https://www.medicarefaq.com/plan-g',topics:[{key:'a'}]},page={id:'own1',url:a.targetUrl,passages:[{id:'own1p1',text:'Available to people eligible before January 1, 2020.'}]};
const result={readiness:'Ready for review',confidence:'Moderate',findings:[{topicKey:'a',judgement:'improve'}],checks:[],retryable:false};
const verdict={topicKey:'a',support:'supported',qualifications:'preserved',overlap:'distinct',authority:'not applicable',reason:'The task preserves the cited condition.',sourceId:'own1',passageId:'own1p1'};
test('second pass blocks changed qualifications, duplicate coverage, missing authority and fabricated support',()=>{
 assert.equal(applyVerification(result,{verdicts:[verdict]},a,[page]).verification.status,'Passed');
 for(const change of [{qualifications:'changed'},{overlap:'covered elsewhere'},{authority:'needed'},{support:'uncertain'},{authority:'adequate'}])assert.equal(applyVerification(result,{verdicts:[{...verdict,...change}]},a,[page]).readiness,'Needs research');
 assert.throws(()=>applyVerification(result,{verdicts:[{...verdict,passageId:'invented'}]},a,[page]));assert.throws(()=>applyVerification(result,{verdicts:[]},a,[page]));
});
test('previous decisions survive while material evidence changes require renewed review',()=>{
 const original={...a,result},previous={decision:'Keep',reason:'Reviewed',fingerprint:assignmentFingerprint({...a,result})};
 assert.equal(priorDecision(previous,original).changed,false);assert.equal(priorDecision(previous,{...original,result:{...result,readiness:'Needs research'}}).changed,true);assert.equal(priorDecision(previous,{...original,result:{...result,validatedAt:new Date().toISOString()}}).changed,false);assert.equal(previous.decision,'Keep');
});
test('saved review history retains the original note across research runs without silently approving changed work',async()=>{
 const before={...a,key:'same',result},after={...before,result:{...result,readiness:'Needs research'}},old={id:'old',created_at:'2026-11-01',payload:{assignments:[before],sourceDates:{}}},run={id:'new',created_at:'2026-11-13',payload:{assignments:[after],sourceDates:{}}};
 const rows={research_assignment_reviews:[{validation_id:'old',assignment_key:'same',decision:'Keep',reason:'Original reviewer note',updated_at:'2026-11-02'}],research_validations:[old]};
 const client={from(table){const chain={select(){return chain;},in(){return chain;},order(){return chain;},limit(){return chain;},then(ok,bad){return Promise.resolve({data:rows[table]}).then(ok,bad);}};return chain;}};
 const history=await previousDecisions(client,run);assert.equal(history.previousReviews[0].reason,'Original reviewer note');assert.equal(history.previousReviews[0].decision,'Keep');assert.equal(history.previousReviews[0].changed,true);assert.equal(rows.research_assignment_reviews[0].decision,'Keep');
});
