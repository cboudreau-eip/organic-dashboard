// Narrow GSC XLSX reader. Workbook content stays in the browser; only validated
// Pages rows are sent through the existing authenticated snapshot API.
import { MAX_IMPORT_BYTES, MAX_ROWS, GrowthError, parseCsv } from './contracts.js';
export const MAX_WORKBOOK_BYTES = 5_000_000;
const MAX_EXPANDED = 20_000_000;
const fail = message => { throw new GrowthError(message); };
const children = (node, name) => [...node.children].filter(el => el.localName === name);
const descendants = (node, name) => [...node.getElementsByTagNameNS('*', name)];
const decode = bytes => new TextDecoder('utf-8', { fatal: true }).decode(bytes);
function xml(text) {
  if (/<!DOCTYPE|<!ENTITY/i.test(text)) fail('Workbook XML declarations are not supported. Export a fresh GSC workbook.');
  const document = new DOMParser().parseFromString(text, 'application/xml');
  if (descendants(document, 'parsererror').length) fail('The Excel workbook contains invalid XML.');
  return document;
}
function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) { crc ^= byte; for (let i=0;i<8;i++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0); }
  return (crc ^ 0xffffffff) >>> 0;
}
function archive(buffer) {
  const bytes = new Uint8Array(buffer), view = new DataView(buffer);
  const u16 = offset => view.getUint16(offset, true), u32 = offset => view.getUint32(offset, true);
  if (bytes.length < 22 || bytes.length > MAX_WORKBOOK_BYTES) fail('Choose an Excel workbook under 5 MB.');
  let end = bytes.length - 22;
  while (end >= Math.max(0, bytes.length - 65557) && !(u32(end) === 0x06054b50 && end + 22 + u16(end + 20) === bytes.length)) end--;
  if (end < Math.max(0, bytes.length - 65557)) fail('Choose a valid .xlsx workbook, not an older .xls file.');
  const count = u16(end + 10), size = u32(end + 12), offset = u32(end + 16);
  if (u16(end + 4) || u16(end + 6) || count !== u16(end + 8) || count > 256 || offset + size !== end) fail('This workbook archive is not supported. Export a fresh GSC workbook.');
  const files = new Map(); let cursor = offset, total = 0;
  for (let i = 0; i < count; i++) {
    if (cursor + 46 > end || u32(cursor) !== 0x02014b50) fail('The Excel workbook is damaged.');
    const flags = u16(cursor + 8), method = u16(cursor + 10), compressed = u32(cursor + 20), expanded = u32(cursor + 24);
    const nameLength = u16(cursor + 28), next = cursor + 46 + nameLength + u16(cursor + 30) + u16(cursor + 32), local = u32(cursor + 42);
    if (next > end || local + 30 > offset || flags & 1 || ![0, 8].includes(method)) fail('Encrypted or unsupported Excel workbooks cannot be imported.');
    const name = decode(bytes.subarray(cursor + 46, cursor + 46 + nameLength));
    if (files.has(name) || name.includes('..') || name.includes('\\') || name.startsWith('/')) fail('The Excel workbook contains invalid paths.');
    total += expanded;
    if (total > MAX_EXPANDED || expanded > MAX_EXPANDED) fail('The workbook expands beyond the 20 MB limit.');
    if (u32(local) !== 0x04034b50 || u16(local + 8) !== method || u16(local + 6) & 1) fail('The Excel workbook is damaged.');
    const data = local + 30 + u16(local + 26) + u16(local + 28);
    if (data + compressed > offset || decode(bytes.subarray(local + 30, local + 30 + u16(local + 26))) !== name) fail('The Excel workbook is damaged.');
    files.set(name, { data, compressed, expanded, method, checksum: u32(cursor + 16) }); cursor = next;
  }
  if (cursor !== end) fail('The Excel workbook directory is invalid.');
  return async path => {
    const entry = files.get(path);
    if (!entry) fail('The Excel workbook is missing ' + path + '.');
    const content = bytes.subarray(entry.data, entry.data + entry.compressed);
    if (!entry.method) {
      if (content.length !== entry.expanded || crc32(content) !== entry.checksum) fail('The Excel workbook is damaged.');
      return decode(content);
    }
    let stream;
    try { stream = new Blob([content]).stream().pipeThrough(new DecompressionStream('deflate-raw')); }
    catch { fail('Excel uploads need a current browser. Update your browser and try again.'); }
    const reader = stream.getReader(), chunks = []; let length = 0;
    try {
      for (;;) {
        const { value, done } = await reader.read(); if (done) break;
        length += value.length;
        if (length > entry.expanded || length > MAX_EXPANDED) { await reader.cancel(); fail('The workbook expands beyond its declared size.'); }
        chunks.push(value);
      }
    } finally { reader.releaseLock(); }
    if (length !== entry.expanded) fail('The Excel workbook is incomplete.');
    const output = new Uint8Array(length); let pos = 0;
    for (const chunk of chunks) { output.set(chunk, pos); pos += chunk.length; }
    if (crc32(output) !== entry.checksum) fail('The Excel workbook checksum is invalid. Export it again.');
    return decode(output);
  };
}
function targetPath(relationship) {
  if (relationship.getAttribute('TargetMode') === 'External') fail('External worksheet references are not supported.');
  const target = relationship.getAttribute('Target') || '';
  const path = target.startsWith('/') ? target.slice(1) : 'xl/' + target;
  if (!/^xl\/[a-zA-Z0-9_./-]+$/.test(path) || path.split('/').includes('..')) fail('Invalid worksheet path.');
  return path;
}
export async function xlsxPagesToCsv(buffer) {
  try {
    const read = archive(buffer);
    const workbook = xml(await read('xl/workbook.xml'));
    const sheets = descendants(workbook, 'sheet').filter(sheet => (sheet.getAttribute('name') || '').trim().toLowerCase() === 'pages');
    if (sheets.length !== 1) fail('The workbook must contain one sheet named Pages. Upload the original GSC Excel export.');
    const sheet = sheets[0], relationshipId = [...sheet.attributes].find(a => a.localName === 'id')?.value;
    const relations = descendants(xml(await read('xl/_rels/workbook.xml.rels')), 'Relationship');
    const relation = relations.find(r => r.getAttribute('Id') === relationshipId && /\/worksheet$/.test(r.getAttribute('Type') || ''));
    if (!relation) fail('The Pages worksheet could not be found.');
    const sharedRelation = relations.find(r => /\/sharedStrings$/.test(r.getAttribute('Type') || ''));
    const shared = sharedRelation ? descendants(xml(await read(targetPath(sharedRelation))), 'si').map(si => descendants(si, 't').map(t => t.textContent).join('')) : [];
    const document = xml(await read(targetPath(relation)));
    const sheetData = descendants(document, 'sheetData')[0];
    if (!sheetData) fail('The Pages sheet is empty.');
    const records = []; let cellCount = 0;
    for (const row of children(sheetData, 'row')) {
      const cells = ['', '', '', '', '']; const used = new Set();
      for (const cell of children(row, 'c')) {
        if (++cellCount > (MAX_ROWS + 1) * 5 + 100) fail('Import at most 2,000 pages at a time.');
        const reference = cell.getAttribute('r') || '';
        const match = /^([A-Z]+)([1-9][0-9]*)$/.exec(reference);
        if (!match || used.has(match[1])) fail('The Pages sheet has invalid cell references.');
        used.add(match[1]);
        if (children(cell, 'f').length) fail('Formulas are not accepted in Pages. Upload an unedited GSC export.');
        const type = cell.getAttribute('t') || 'n';
        let value = children(cell, 'v')[0]?.textContent || '';
        if (type === 's') {
          if (!/^\d+$/.test(value) || Number(value) >= shared.length) fail('The workbook has invalid shared text.');
          value = shared[Number(value)];
        } else if (type === 'inlineStr') value = descendants(cell, 't').map(t => t.textContent).join('');
        else if (!['n', 'str'].includes(type)) fail('The Pages sheet contains an unsupported cell value.');
        if (!value.trim()) continue;
        if (!/^[A-E]$/.test(match[1])) fail('Pages must contain exactly five GSC metric columns.');
        cells[match[1].charCodeAt(0) - 65] = { value, numeric: type === 'n' };
      }
      if (cells.every(cell => cell === '')) continue;
      records.push(cells);
      if (records.length > MAX_ROWS + 1) fail('Import at most 2,000 pages at a time.');
    }
    const headers = records[0]?.map(cell => (cell.value || '').trim().toLowerCase()) || [];
    const ctrIndex = headers.indexOf('ctr');
    const text = records.map((row, index) => row.map((cell, column) => {
      let value = cell.value || '';
      if (index && column === ctrIndex && cell.numeric && value !== '') {
        const fraction = Number(value);
        if (!Number.isFinite(fraction) || fraction < 0 || fraction > 1) fail('Numeric Excel CTR values must be between 0 and 1.');
        value = (fraction * 100).toFixed(10) + '%';
      }
      return '"' + value.replaceAll('"', '""') + '"';
    }).join(',')).join('\n');
    parseCsv(text); // Enforce the same normalized payload and row limits as CSV.
    return text;
  } catch (error) {
    if (error instanceof GrowthError) throw error;
    fail('The Excel workbook could not be read. Upload a fresh .xlsx export from GSC.');
  }
}
export async function readGscFile(file) {
  const name = file.name.toLowerCase();
  if (name.endsWith('.xlsx')) {
    if (file.size > MAX_WORKBOOK_BYTES) fail('Choose an Excel workbook under 5 MB.');
    return { csv: await xlsxPagesToCsv(await file.arrayBuffer()), message: 'Read the Pages sheet from Excel. Enter its reporting dates, then validate and preview.' };
  }
  if (name.endsWith('.csv')) {
    if (file.size > MAX_IMPORT_BYTES) fail('Choose a CSV file under 1 MB.');
    return { csv: await file.text(), message: 'CSV loaded. Enter its reporting dates, then validate and preview.' };
  }
  fail('Choose a GSC Excel (.xlsx) or CSV export. Older .xls files are not supported.');
}

/** Bounded raw worksheet reader for the Semrush import. Never executes formulas. */
export async function xlsxKeywordRows(buffer) {
 const read=archive(buffer),workbook=xml(await read('xl/workbook.xml'));
 const sheets=descendants(workbook,'sheet');
 if(sheets.length>8)fail('Import a workbook with at most eight sheets.');
 const relations=descendants(xml(await read('xl/_rels/workbook.xml.rels')),'Relationship');
 const sharedRelation=relations.find(r=>/\/sharedStrings$/.test(r.getAttribute('Type')||''));
 const shared=sharedRelation?descendants(xml(await read(targetPath(sharedRelation))),'si').map(si=>descendants(si,'t').map(t=>t.textContent).join('')):[];
 const tables=[];let count=0;
 for(const sheet of sheets){
  const id=[...sheet.attributes].find(a=>a.localName==='id')?.value;
  const relation=relations.find(r=>r.getAttribute('Id')===id&&/\/worksheet$/.test(r.getAttribute('Type')||''));
  if(!relation)fail('Missing worksheet relationship.');
  const data=descendants(xml(await read(targetPath(relation))),'sheetData')[0];if(!data)continue;
  const rows=[];
  for(const row of children(data,'row')){
   const values=[],used=new Set();
   for(const cell of children(row,'c')){
    if(++count>100000)fail('Workbook has too many cells.');
    const m=/^([A-Z]+)[1-9][0-9]*$/.exec(cell.getAttribute('r')||'');
    if(!m||used.has(m[1]))fail('Invalid worksheet cell.');
    used.add(m[1]);
    const col=[...m[1]].reduce((n,c)=>n*26+c.charCodeAt(0)-64,0)-1;
    if(col>=32)fail('Import at most 32 columns.');
    if(children(cell,'f').length)fail('Formulas are not supported. Use the original Semrush export.');
    const type=cell.getAttribute('t')||'n';let value=children(cell,'v')[0]?.textContent||'';
    if(type==='s'){if(!/^\d+$/.test(value)||Number(value)>=shared.length)fail('Invalid workbook text.');value=shared[Number(value)];}
    else if(type==='inlineStr')value=descendants(cell,'t').map(t=>t.textContent).join('');
    else if(!['n','str'].includes(type))fail('Unsupported worksheet value.');
    values[col]=value;
   }
   rows.push(Array.from({length:values.length},(_,i)=>values[i]??''));
   if(rows.length>5100)fail('Import up to 5,000 keyword rows.');
  }
  if(rows.some(r=>r[0]?.trim()==='Keyword'))tables.push(rows);
 }
 if(tables.length!==1)fail('Expected exactly one sheet containing the Keyword table.');
 return tables[0];
}
