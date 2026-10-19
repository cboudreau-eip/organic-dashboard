import test from 'node:test';
import assert from 'node:assert/strict';
import { deflateRawSync } from 'node:zlib';
import { JSDOM } from 'jsdom';
import { xlsxPagesToCsv, readGscFile } from '../lib/growth-hunter/files.js';
import { importGscPages } from '../lib/growth-hunter/contracts.js';
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
function workbook({ shared = true, ctr = '0.1', formula = false, sheetName = 'Pages', extra = '', compressed = true } = {}) {
  const strings = ['Top pages','Clicks','Impressions','CTR','Position','https://www.medicarefaq.com/example/'];
  const cell = (ref, index) => shared ? '<c r="'+ref+'" t="s"><v>'+index+'</v></c>' : '<c r="'+ref+'" t="inlineStr"><is><t>'+escape(strings[index])+'</t></is></c>';
  const entries = {
    'xl/workbook.xml':'<workbook xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Queries" r:id="q"/><sheet name="'+sheetName+'" r:id="p"/></sheets></workbook>',
    'xl/_rels/workbook.xml.rels':'<Relationships><Relationship Id="p" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/>'+ (shared ? '<Relationship Id="s" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/>' : '') + '</Relationships>',
    'xl/worksheets/sheet2.xml':'<worksheet><sheetData><row r="1">'+strings.slice(0,5).map((_,i)=>cell(String.fromCharCode(65+i)+'1',i)).join('')+'</row><row r="2">'+cell('A2',5)+'<c r="B2"><v>10</v></c><c r="C2"><v>100</v></c><c r="D2">'+(formula?'<f>B2/C2</f>':'')+'<v>'+ctr+'</v></c><c r="E2"><v>5.5</v></c>'+extra+'</row></sheetData></worksheet>',
  };
  if(shared) entries['xl/sharedStrings.xml'] = '<sst>'+strings.map(s=>'<si><t>'+escape(s)+'</t></si>').join('')+'</sst>';
  return zip(entries, compressed);
}
const dates = { start:'2026-10-03',end:'2026-10-09' };
const now = new Date('2026-10-19T18:00:00Z');
test('Excel imports Pages from multi-sheet workbooks using shared or inline strings and numeric CTR', async () => {
  for (const shared of [true,false]) for (const compressed of [true,false]) {
    const csv = await xlsxPagesToCsv(workbook({shared,compressed}));
    const result = importGscPages({...dates,csv},now);
    assert.deepEqual(result.rows,[{url:'https://www.medicarefaq.com/example/',clicks:10,impressions:100,ctr:0.1,position:5.5}]);
    const csvResult = importGscPages({...dates,csv:'Top pages,Clicks,Impressions,CTR,Position\nhttps://www.medicarefaq.com/example/,10,100,10%,5.5'},now);
    assert.deepEqual(result,csvResult);
  }
});
test('Excel rejects missing Pages, formulas, invalid percentages and extra columns without bypassing validation', async () => {
  await assert.rejects(xlsxPagesToCsv(workbook({sheetName:'Queries'})),/named Pages/);
  await assert.rejects(xlsxPagesToCsv(workbook({formula:true})),/Formulas/);
  await assert.rejects(xlsxPagesToCsv(workbook({ctr:'10'})),/between 0 and 1/);
  await assert.rejects(xlsxPagesToCsv(workbook({extra:'<c r="F2"><v>1</v></c>'})),/five/);
  const csv = await xlsxPagesToCsv(workbook({ctr:'0.9'}));
  assert.throws(()=>importGscPages({...dates,csv},now),/CTR does not agree/);
  await assert.rejects(xlsxPagesToCsv(new ArrayBuffer(32)),/valid .xlsx/);
});
test('File selection supports CSV and XLSX while rejecting old Excel and oversized files before reading', async () => {
  const bytes = workbook();
  const read = await readGscFile({name:'GSC.XLSX',size:bytes.byteLength,arrayBuffer:async()=>bytes});
  assert.match(read.message,/Pages sheet/);
  assert.equal((await readGscFile({name:'pages.csv',size:3,text:async()=>'abc'})).csv,'abc');
  await assert.rejects(readGscFile({name:'legacy.xls',size:3}),/Older .xls/);
  await assert.rejects(readGscFile({name:'large.xlsx',size:5_000_001}),/5 MB/);
  await assert.rejects(readGscFile({name:'large.csv',size:1_000_001}),/1 MB/);
});
test('Workbook rejects unsafe paths, external worksheets, XML entities and declared expansion bombs', async () => {
  await assert.rejects(xlsxPagesToCsv(zip({'../bad':'x'})),/invalid paths/);
  await assert.rejects(xlsxPagesToCsv(zip({'xl/workbook.xml':'<!DOCTYPE workbook [<!ENTITY x "bad">]><workbook/>'})),/declarations/);
  const bomb = workbook(); const view = new DataView(bomb); const offset = view.getUint32(bomb.byteLength-6,true); view.setUint32(offset+24,20_000_001,true);
  await assert.rejects(xlsxPagesToCsv(bomb),/20 MB/);
  const entries = {'xl/workbook.xml':'<workbook xmlns:r="r"><sheet name="Pages" r:id="p"/></workbook>','xl/_rels/workbook.xml.rels':'<Relationships><Relationship Id="p" Type="r/worksheet" TargetMode="External" Target="https://example.test"/></Relationships>'};
  await assert.rejects(xlsxPagesToCsv(zip(entries)),/External/);
});
