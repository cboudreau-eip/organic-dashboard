import test from 'node:test';import assert from 'node:assert/strict';import {generateCalendar,changeCalendar,DEMO_DATES} from '../lib/research/demo-calendar.js';import {generateProposals} from '../lib/research/proposals.js';import {DEFAULTS} from '../lib/research/contracts.js';
const items=generateProposals({},DEFAULTS).items;
test('90 tentative dates cover Jan 1 through Mar 31 without timezone drift or gaps',()=>{
 const c=generateCalendar(items);assert.equal(c.status,'Tentative');assert.equal(Object.keys(c.dates).length,90);assert.deepEqual(Object.values(c.dates).sort(),DEMO_DATES);assert.equal(DEMO_DATES[0],'2027-01-01');assert.equal(DEMO_DATES.at(-1),'2027-03-31');assert.equal(DEMO_DATES.filter(d=>d.startsWith('2027-02')).length,28);
 assert.equal(items.find(x=>c.dates[x.id]==='2027-01-01').category,'Evergreen');assert.ok(new Set(items.filter(x=>c.dates[x.id]<='2027-01-07').map(x=>x.category)).size>=3);
 assert.throws(()=>generateCalendar(items.slice(0,89)));
});
test('date swaps preserve daily coverage and fixed manual edits survive regeneration',()=>{
 const c=generateCalendar(items),id=items[0].id,other=items[1].id,old=c.dates[id],date=c.dates[other];
 const swapped=changeCalendar(c,items,{action:'calendar-move',itemId:id,date});assert.equal(swapped.dates[other],old);assert.equal(swapped.dates[id],date);assert.equal(new Set(Object.values(swapped.dates)).size,90);
 const regenerated=generateCalendar(items,swapped);assert.equal(regenerated.dates[id],date);assert.equal(regenerated.dates[other],old);assert.equal(items[0].scheduledDate,undefined);
 assert.throws(()=>changeCalendar(swapped,items,{action:'calendar-move',itemId:id,date:old}));assert.throws(()=>changeCalendar(c,items,{action:'calendar-move',itemId:id,date:'2027-04-01'}));
 const unlocked=changeCalendar(swapped,items,{action:'calendar-lock',itemId:id,locked:false});assert.equal(unlocked.locked.includes(id),false);
});
