import test from 'node:test';
import assert from 'node:assert/strict';
import {rankOpportunities,topicKey,intentFor} from '../lib/research/rank.js';
import {groupingKey} from '../lib/research/topics.js';
import {DEFAULTS} from '../lib/research/contracts.js';
const url=slug=>'https://www.medicarefaq.com/'+slug;
const page=(slug,title,headings=[])=>({url:url(slug),requested:url(slug),canonical:url(slug),title,headings:[title,...headings],text:'',status:'read'});
const query=(term,slug,impressions=100)=>({keys:[term,url(slug)],impressions,clicks:0,position:12});
const evidence=rows=>({gsc:{status:'available',rows},semrush:{status:'available',rows:[]},otterly:{status:'available',prompts:[]}});

test('buying intent distinguishes service, enrollment timing and explicit purchase wording',()=>{
 assert.equal(intentFor('medicare supplement enrollment period',['transactional']).value,4);
 assert.equal(intentFor('aetna medigap',['transactional']).value,4);
 assert.equal(intentFor('get a medigap quote without underwriting').value,5);
 for(const term of ['doctors that accept aetna near me','humana provider list','rx coupons','aetna customer service phone number'])assert.equal(intentFor(term,['transactional']).value,1,term);
 assert.equal(intentFor('best medicare supplements 2021',['transactional'],2027).value,1);
 assert.equal(intentFor('compare medicare plans 2027',[],2027).value,4);
});
test('grouping merges carrier and comparison variants, preserves specificity and review identity',()=>{
 const terms=['aetna medicare supplement','aetna medicare supplement plans','aetna medicare supplement plan g','aetna plan g','aetna medigap reviews','medicare plan f vs plan g','medigap plan g versus f','switch from plan g to plan n','switch from plan n to plan g'];
 const r=rankOpportunities(evidence(terms.map(t=>query(t,'aetna'))),[],DEFAULTS,false);
 const carrier=r.items.find(x=>x.terms.includes(terms[0]));
 assert.deepEqual(carrier.terms,terms.slice(0,2));assert.notEqual(carrier.key,topicKey(terms[0]));assert.ok(carrier.previousKeys.includes(topicKey(terms[0])));
 assert.equal(r.items.find(x=>x.terms.includes(terms[2])).terms.length,2);
 assert.equal(r.items.find(x=>x.terms.includes(terms[4])).key,topicKey(terms[4]));
 assert.equal(r.items.find(x=>x.terms.includes(terms[5])).terms.length,2);
 assert.notEqual(groupingKey(terms[7]),groupingKey(terms[8]));
 const singleDirection=rankOpportunities(evidence([query(terms[7],'aetna')]),[],DEFAULTS,false).items[0];
 assert.equal(singleDirection.key,r.items.find(x=>x.title===terms[7]).key);
 assert.equal(new Set(r.items.map(x=>x.key)).size,r.items.length);
 assert.notEqual(groupingKey('quote without underwriting'),groupingKey('quote with underwriting'));
 assert.notEqual(groupingKey('anthem medigap'),groupingKey('bcbs medigap'));
 assert.notEqual(groupingKey('medigap plan g texas'),groupingKey('medigap plan g utah'));
});
test('matching prefers dedicated pages over incidental headings and rejects different Medicare parts',()=>{
 const pages=[page('birthday','Medigap birthday rule',['Compare Medicare supplement Plan C']),page('plan-c','Medicare Supplement Plan C'),page('part-b','How to apply for Medicare Part B'),page('part-d','Medicare Part D enrollment periods')];
 const r=rankOpportunities(evidence([query('medicare supplement plan c','birthday',1),query('medicare supplement plan c','plan-c',200),query('apply for medicare part d','part-b',100),query('apply for medicare part d','part-d',10)]),pages,DEFAULTS,false);
 const c=r.items.find(x=>x.title==='medicare supplement plan c');assert.equal(c.targetUrl,url('plan-c'));assert.equal(c.type,'Update existing page');assert.equal(c.confidence,'Moderate');
 const d=r.items.find(x=>x.title==='apply for medicare part d');assert.equal(d.targetUrl,url('part-d'));
});
test('overlap requires comparable pages with material evidence; aliases are one page',()=>{
 const term='compare medigap plan g costs',p1=page('plan-g','Compare Medigap Plan G costs'),p2=page('plan-g-costs','Compare Medigap Plan G costs');
 const one=rankOpportunities(evidence([query(term,'plan-g',999),query(term,'plan-g-costs',1)]),[p1,p2],DEFAULTS,true).items[0];assert.equal(one.type,'Update existing page');
 const two=rankOpportunities(evidence([query(term,'plan-g',70),query(term,'plan-g-costs',30)]),[p1,p2],DEFAULTS,true).items[0];assert.equal(two.type,'Investigate overlap');
 const alias=rankOpportunities(evidence([query(term,'plan-g',70),query(term,'old-g',30)]),[p1,{...p1,requested:url('old-g')}],DEFAULTS,true).items[0];assert.equal(alias.relatedPages.length,1);assert.equal(alias.type,'Update existing page');
});
test('new-page candidates do not display unrelated targets; missing difficulty stays unknown',()=>{
 const r=rankOpportunities({semrush:{status:'available',rows:[{keyword:'lumico medicare supplement',intents:'n|t',volume:100,difficulty:18}]},otterly:{status:'available',prompts:[{prompt:'compare part d plans for a rare prescription',mentions:0,domainMentions:0}]}},[page('alerts','Does Medicare cover medical alert systems')],DEFAULTS,false);
 const lumico=r.items.find(x=>x.title.startsWith('lumico'));assert.equal(lumico.type,'New content candidate');assert.equal(lumico.targetUrl,null);assert.equal(lumico.confidence,'Low');
 const longtail=r.items.find(x=>x.title.startsWith('compare'));assert.equal(longtail.components.competition.value,null);assert.ok(longtail.scoreMax>longtail.score);
});

test('carrier plan variants can use a verified parent page; charts prefer plan comparisons',()=>{
 const r=rankOpportunities(evidence([query('aetna medicare supplement plan g','aetna',40),query('medicare supplement chart','compare',90),query('usaa medicare supplement','hawaii',10)]),[page('aetna','Aetna Medicare Supplement Plans 2026',['Rates and coverage']),page('compare','Medicare Supplement Plans Comparison'),page('senior-discounts','Discounts for Seniors',['Discount chart']),page('hawaii','Medicare Supplement Plans in Hawaii',['USAA Medicare Supplement'])],DEFAULTS,false);
 assert.equal(r.items.find(x=>x.title.startsWith('aetna')).targetUrl,url('aetna'));
 assert.equal(r.items.find(x=>x.title.includes('chart')).targetUrl,url('compare'));
 const usaa=r.items.find(x=>x.title.startsWith('usaa'));assert.equal(usaa.targetUrl,null);assert.equal(usaa.type,'Investigate page');assert.equal(usaa.confidence,'Low');
});
