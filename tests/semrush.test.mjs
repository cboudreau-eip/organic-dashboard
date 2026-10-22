import test from 'node:test';
import assert from 'node:assert/strict';
import {deflateRawSync} from 'node:zlib';
import {JSDOM} from 'jsdom';
import {xlsxKeywordRows} from '../lib/growth-hunter/files.js';
import {parseSemrush,validateSnapshot,compareSnapshots,csvRows} from '../lib/semrush/import.js';
import {semrushHandlers} from '../lib/semrush/handlers.js';
const window = new JSDOM('').window;
globalThis.DOMParser = window.DOMParser;
const escape = value => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;');
function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) { crc ^= byte; for (let i=0;i<8;i++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0); }
  return (crc ^ 0xffffffff) >>> 0;
}
function zip(entries, compressed = true) {
  let offset = 0; const locals = [], directory = [];
  for (const [name, text] of Object.entries(entries)) {
    const filename = Buffer.from(name), raw = Buffer.from(text), data = compressed ? deflateRawSync(raw) : raw;
    const header = Buffer.alloc(30); header.writeUInt32LE(0x04034b50); header.writeUInt16LE(20,4); header.writeUInt16LE(compressed ? 8 : 0,8); header.writeUInt32LE(crc32(raw),14); header.writeUInt32LE(data.length,18); header.writeUInt32LE(raw.length,22); header.writeUInt16LE(filename.length,26);
    const central = Buffer.alloc(46); central.writeUInt32LE(0x02014b50); central.writeUInt16LE(20,6); central.writeUInt16LE(compressed ? 8 : 0,10); central.writeUInt32LE(crc32(raw),16); central.writeUInt32LE(data.length,20); central.writeUInt32LE(raw.length,24); central.writeUInt16LE(filename.length,28); central.writeUInt32LE(offset,42);
    locals.push(header,filename,data); directory.push(central,filename); offset += header.length+filename.length+data.length;
  }
  const cd = Buffer.concat(directory), end = Buffer.alloc(22); end.writeUInt32LE(0x06054b50); end.writeUInt16LE(Object.keys(entries).length,8); end.writeUInt16LE(Object.keys(entries).length,10); end.writeUInt32LE(cd.length,12); end.writeUInt32LE(offset,16);
  const buffer = Buffer.concat([...locals,cd,end]); return buffer.buffer.slice(buffer.byteOffset,buffer.byteOffset+buffer.byteLength);
}

const fixture=[["ID: 7197265"],["Report type: position_tracking_rankings_overview"],["Period: 20261016 - 20261022"],["Keyword","*.medicarefaq.com/*_20261022","*.medicarefaq.com/*_20261022_share_of_voice","*.medicarefaq.com/*_20261022_type","*.medicarefaq.com/*_20261022_landing","*.medicarefaq.com/*_difference","*.medicarefaq.com/*_share_of_voice_difference","Tags","Intents","CPC","Search Volume","Keyword Difficulty"],["synthetic keyword","8","0.001","organic","https://www.medicarefaq.com/example/","2","0.0001","medigap","c","4.5","100","25"]];
const scope={location:'United States',device:'desktop',engine:'Google',confirmed:true};
test('Semrush metadata, source deltas and actual snapshot comparisons stay distinct',()=>{
 const current=validateSnapshot({report:{matrix:fixture},scope});
 assert.equal(current.rows[0].position,8);assert.equal(current.rows[0].sourceDifference,'2');
 assert.equal(current.start,'2026-10-16');assert.equal(current.end,'2026-10-22');
 const prior={...current,end:'2026-10-15',rows:[{...current.rows[0],position:12}]};
 assert.equal(compareSnapshots(current,prior)[0].change,4);
 assert.throws(()=>compareSnapshots(current,{...prior,scope:{...prior.scope,device:'mobile'}}),/matching/);
 assert.throws(()=>compareSnapshots(current,{...prior,end:current.end}),/earlier/);
 assert.throws(()=>validateSnapshot({report:{matrix:fixture},scope:{...scope,confirmed:false}}),/Confirm/);
});
test('Semrush rejects malformed values, duplicates, mismatched dates and unsafe links',()=>{
 const alter=(col,value)=>{const m=structuredClone(fixture);m[4][col]=value;return m;};
 assert.throws(()=>parseSemrush([...fixture,fixture[4]]),/Duplicate/);
 assert.throws(()=>parseSemrush(alter(4,'javascript:alert(1)')),/MedicareFAQ/);
 assert.throws(()=>parseSemrush(alter(11,'101')),/difficulty/);
 assert.throws(()=>parseSemrush(alter(1,'banana')),/position/);
 const m=structuredClone(fixture);m[2]=['Period: 20261016 - 20261021'];assert.throws(()=>parseSemrush(m),/match/);
 const unranked=parseSemrush(alter(1,'101'));assert.equal(unranked.rows[0].position,null);assert.equal(unranked.rows[0].rawPosition,'101');
 const blank=parseSemrush(alter(10,''));assert.equal(blank.rows[0].volume,null);
 assert.deepEqual(csvRows('"a,b","c""d"\n1,2'),[['a,b','c"d'],['1','2']]);
 assert.throws(()=>csvRows('"unfinished'),/Unclosed/);
});
test('Semrush reads a compressed Excel export with metadata and rejects formulas',async()=>{
 const sheet='<worksheet><sheetData>'+fixture.map((row,i)=>'<row>'+row.map((v,j)=>'<c r="'+String.fromCharCode(65+j)+(i+1)+'" t="inlineStr"><is><t>'+escape(v)+'</t></is></c>').join('')+'</row>').join('')+'</sheetData></worksheet>';
 const entries={'xl/workbook.xml':'<workbook xmlns:r="r"><sheet name="Sheet1" r:id="s"/></workbook>',
 'xl/_rels/workbook.xml.rels':'<Relationships><Relationship Id="s" Type="r/worksheet" Target="worksheets/sheet1.xml"/></Relationships>',
 'xl/worksheets/sheet1.xml':sheet};
 assert.deepEqual(parseSemrush(await xlsxKeywordRows(zip(entries))),parseSemrush(fixture));
 await assert.rejects(xlsxKeywordRows(zip({...entries,'xl/worksheets/sheet1.xml':sheet.replace('<is>','<f>1+1</f><is>')})),/Formulas/);
});
test('Semrush API blocks anonymous, forged origin, malformed input and excessive bodies',async()=>{
 const denied=semrushHandlers({access:async()=>{throw {status:401}},origin:()=> 'https://example.test'});
 assert.equal((await denied.GET(new Request('https://example.test/api'))).status,401);
 const h=semrushHandlers({access:async()=>({client:{},role:'analyst'}),origin:()=> 'https://example.test'});
 assert.equal((await h.POST(new Request('https://example.test/api',{method:'POST',body:'{}'}))).status,403);
 assert.equal((await h.POST(new Request('https://example.test/api',{method:'POST',headers:{origin:'https://example.test'},body:'{}'}))).status,422);
 assert.equal((await h.POST(new Request('https://example.test/api',{method:'POST',headers:{origin:'https://example.test'},body:'x'.repeat(3000001)}))).status,413);
});
