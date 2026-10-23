import test from 'node:test';
import assert from 'node:assert/strict';
import {filterKeywords,groupPages,inBand,intents} from '../lib/semrush/opportunities.js';
const rows=[
 {keyword:'alpha',position:4,volume:100,intents:'C, I',tags:'priority, medigap',landing:'https://www.medicarefaq.com/a/'},
 {keyword:'beta',position:20,volume:0,intents:'transactional',tags:'priority-two',landing:'https://www.medicarefaq.com/a/'},
 {keyword:'gamma',position:null,volume:null,intents:'N',tags:'priority',landing:''},
 {keyword:'delta',position:21,volume:50,intents:'I',tags:'medigap',landing:'https://www.medicarefaq.com/b/'}
];
test('opportunity filters combine without treating unknown ranks or volume as zero',()=>{
 assert.deepEqual(filterKeywords(rows,{band:'4-10',intent:'commercial',tag:'priority',minVolume:'50'}).map(r=>r.keyword),['alpha']);
 assert.deepEqual(filterKeywords(rows,{tag:'priority'}).map(r=>r.keyword),['alpha','gamma']);
 assert.deepEqual(filterKeywords(rows,{maxVolume:'0'}).map(r=>r.keyword),['beta']);
 assert.deepEqual(filterKeywords(rows,{landing:''}).map(r=>r.keyword),['gamma']);
 assert.equal(filterKeywords(rows,{minVolume:'100',maxVolume:'50'}).length,0);
 assert.deepEqual(intents('C; Transactional|I'),['commercial','transactional','informational']);
 for(const [rank,band] of [[3,'1-3'],[4,'4-10'],[10,'4-10'],[11,'11-20'],[20,'11-20'],[21,'21-50'],[50,'21-50'],[51,'51-100'],[100,'51-100']])assert.equal(inBand(rank,band),true);
 assert.equal(inBand(null,'4-10'),false);
 assert.equal(inBand(null,'unknown'),true);
});
test('page groups reflect filtered keywords, retain unknowns and keep distinct URLs',()=>{
 const grouped=groupPages(rows);
 assert.equal(grouped[0].url,rows[0].landing);
 assert.equal(grouped[0].count,2);assert.equal(grouped[0].nearTop,1);assert.equal(grouped[0].pageTwo,1);
 assert.equal(grouped[0].commercial,2);assert.equal(grouped[0].volume,100);assert.equal(grouped[0].knownVolume,2);
 const unknown=grouped.find(g=>g.url==='');assert.equal(unknown.volume,null);assert.equal(unknown.best,null);
 assert.equal(groupPages(filterKeywords(rows,{band:'4-10'}))[0].count,1);
 assert.equal(groupPages([rows[0],{...rows[0],landing:rows[0].landing+'?variant=1'}]).length,2);
});
