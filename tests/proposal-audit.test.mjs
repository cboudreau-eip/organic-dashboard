import test from 'node:test';import assert from 'node:assert/strict';import {auditProposalPlan} from '../lib/research/proposal-audit.js';
const item=(id,term,targetUrl='')=>({id,title:term,terms:[term],targetUrl,evidence:{gsc:[],semrush:[],otterly:[]}});
const page=(slug,title)=>({url:'https://www.medicarefaq.com/'+slug,title,headings:[],status:'read'});
const plan=items=>({version:2,payload:{items},edits:{a:{notes:'Keep my work'}},calendar:{status:'Tentative',dates:{a:'2027-01-01'},locked:['a']}});
test('audit flags equivalent enrollment intent without changing assignments, dates or edits',()=>{
 const p=plan([item('a','medicare supplement enrollment period'),item('b','medicare supplement open enrollment')]),before=structuredClone(p),out=auditProposalPlan(p);
 assert.deepEqual(p,before);assert.deepEqual(out.calendar,p.calendar);assert.deepEqual(out.edits,p.edits);assert.equal(out.qualityAudit.checked,2);assert.equal(out.qualityAudit.overlap,2);
 assert.ok(out.payload.items.every(i=>i.quality.flags.some(f=>f.code==='inventory-unavailable')));
});
test('shared pages are coordination flags, not automatically duplicate intent',()=>{
 const pageA=page('carrier','Cigna Medicare Supplement Plans');const p=plan([item('a','cigna medicare supplement',pageA.url),item('b','cigna medicare supplement plan g',pageA.url)]);
 const out=auditProposalPlan(p,[pageA]);assert.equal(out.qualityAudit.overlap,0);assert.equal(out.qualityAudit.sharedPage,2);assert.ok(out.payload.items[1].quality.flags.some(f=>f.code==='target-scope'));
});
test('distinct states, ages, carriers and switching directions do not collapse into duplicates',()=>{
 const p=plan(['medicare plan g cost','medicare plan g pricing by state','plan g cost age 70','plan g cost age 65','aetna plan g cost','cigna plan g cost','switch from medicare advantage to medigap','switch from medigap to medicare advantage'].map((s,i)=>item(String(i),s)));
 assert.equal(auditProposalPlan(p).qualityAudit.overlap,0);
});
test('current edited scopes supersede old keywords, unknown targets never look verified',()=>{
 const pg=page('plan-g','Medicare Supplement Plan G'),i={...item('a','medicare plan g',pg.url),title:'Medicare Part D enrollment',titleEdited:true};
 const out=auditProposalPlan(plan([i,item('b','medicare plan g','https://www.medicarefaq.com/missing')]),[pg]);
 assert.ok(out.payload.items[0].quality.flags.some(f=>f.code==='target-scope'));assert.ok(out.payload.items[1].quality.flags.some(f=>f.code==='target-not-in-inventory'));
});
test('canonical aliases coordinate and an exact readable page can pass the limited screen',()=>{
 const pg=page('plan-g','Medicare Supplement Plan G');pg.canonical=pg.url;pg.requested=pg.url+'/';
 const out=auditProposalPlan(plan([item('a','medicare supplement plan g',pg.url)]),[pg]);assert.equal(out.qualityAudit.flagged,0);assert.equal(out.payload.items[0].quality.status,'No issue detected');
 const paired=auditProposalPlan(plan([item('a','medicare supplement plan g',pg.url),item('b','plan g benefits',pg.requested)]),[pg]);assert.equal(paired.qualityAudit.sharedPage,2);
});
