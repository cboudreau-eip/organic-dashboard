import test from 'node:test';
import assert from 'node:assert/strict';
import {contentMarkdown} from '../lib/otterly/content-export.js';
const args={result:{suggestion:{target:'https://www.medicarefaq.com/medigap-plans/',links:['https://www.medicarefaq.com/faqs/mapd-vs-part-d/']},sources:[{url:'https://www.medicarefaq.com/medigap-plans/',truncated:true}],generatedAt:'2026-11-04T12:00:00Z'},notes:'My edited draft\n```\nKeep this exactly ✓',prompt:{id:'prompt',prompt:'Do I need Part D?',mentions:0,domainMentions:0,competitors:[]},report:{period:{start:'2026-10-05',end:'2026-11-03'},promptPlatforms:[{id:'chatgpt',prompts:[{id:'prompt',mentions:0,domainMentions:0,competitors:[]}]}]},snapshotId:'snapshot',exportedAt:'2026-11-04T13:00:00Z'};
test('Markdown exports edited text intact, evidence, source links, and a safe descriptive filename',()=>{
 const {text,filename}=contentMarkdown(args);
 assert.ok(text.includes('````text\n'+args.notes+'\n````'));
 assert.match(text,/\| ChatGPT \| 0 \| 0 \| None recorded \|/);
 assert.match(text,/\| Claude \| Unavailable \| Unavailable \| Unavailable \|/);
 assert.ok(text.includes(args.result.suggestion.links[0]));assert.match(text,/truncated excerpt/);
 assert.match(text,/Working draft/);assert.match(text,/Do not publish automatically/);
 assert.equal(filename,'medicarefaq-do-i-need-part-d-2026-11-04.md');
 assert.match(contentMarkdown({...args,saved:true}).text,/Approved and saved in Growth Hunter/);
});
