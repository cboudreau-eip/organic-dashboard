import test from 'node:test';
import assert from 'node:assert/strict';
import {declineSuggestion,declineNotes} from '../lib/growth-hunter/decline-plan.js';
const finding={url:'https://www.medicarefaq.com/example/',prior:{clicks:100,impressions:1000,ctr:.1,position:4},current:{clicks:50,impressions:900,ctr:.055,position:6}};
const run={id:'saved-run',created_at:'2026-11-03',prior_snapshot_id:'prior',current_snapshot_id:'current',result:{priorPeriod:{start:'2026-09-01',end:'2026-09-28'},currentPeriod:{start:'2026-09-29',end:'2026-10-26'}}};
test('decline suggestions recommend investigation rather than assert a cause',()=>{
 assert.match(declineSuggestion(finding),/queries losing clicks/);
 assert.match(declineSuggestion({...finding,current:{...finding.current,position:4}}),/title and description/);
 assert.match(declineSuggestion({...finding,current:{...finding.current,position:4.8,impressions:500}}),/seasonality/);
});
test('approved plan includes source periods and immutable references and preserves unavailable versus zero',()=>{
 const notes=declineNotes(run,finding,'Check before editing',null,{fetchedAt:'2026-11-03',current:{truncated:true},previous:{}},{current:{sessions:0,contactSessions:0},previous:null});
 assert.match(notes,/Check before editing/);assert.match(notes,/2026-09-01 to 2026-09-28/);assert.match(notes,/100 → 50/);
 assert.match(notes,/Frozen GSC snapshots: prior → current/);assert.match(notes,/contactSessions: Unavailable → 0/);assert.match(notes,/row limit reached/);assert.match(notes,/not CRM leads or policies/);assert.ok(notes.length<4000);
 assert.match(declineNotes(run,finding,'Review',null,null,null),/unavailable or not loaded/);
});
