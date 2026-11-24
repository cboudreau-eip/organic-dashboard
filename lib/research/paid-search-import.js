import {inflateRawSync} from 'node:zlib';
import ExcelJS from 'exceljs';
import {createHash} from 'node:crypto';
export const PAID_LIMIT=3000000;
// Bound the declared expanded archive before the Excel reader allocates worksheet data.
export function checkZip(b){let end=-1;for(let i=b.length-22;i>=Math.max(0,b.length-65557);i--)if(b.readUInt32LE(i)===0x06054b50){end=i;break;}
 if(end<0)throw Error('Use an XLSX workbook.');const count=b.readUInt16LE(end+10);let at=b.readUInt32LE(end+16),total=0;if(count>200)throw Error('Workbook has too many entries.');
 for(let i=0;i<count;i++){if(at+46>b.length||b.readUInt32LE(at)!==0x02014b50)throw Error('Invalid workbook archive.');total+=b.readUInt32LE(at+24);if(total>25000000)throw Error('Workbook expands beyond the import limit.');const offset=b.readUInt32LE(at+42),compressed=b.readUInt32LE(at+20),expanded=b.readUInt32LE(at+24),method=b.readUInt16LE(at+10);if(offset+30>b.length)throw Error('Invalid ZIP entry.');const start=offset+30+b.readUInt16LE(offset+26)+b.readUInt16LE(offset+28);if(start+compressed>b.length||![0,8].includes(method))throw Error('Unsupported ZIP entry.');const raw=method===8?inflateRawSync(b.subarray(start,start+compressed),{maxOutputLength:25000000}):b.subarray(start,start+compressed);if(raw.length!==expanded)throw Error('Invalid expanded workbook size.');at+=46+b.readUInt16LE(at+28)+b.readUInt16LE(at+30)+b.readUInt16LE(at+32);}}
export async function parsePaidWorkbook(buffer,filename='Paid search workbook.xlsx'){
 const b=Buffer.from(buffer);if(b.length>PAID_LIMIT)throw Error('Choose a workbook smaller than 3 MB.');checkZip(b);
 const w=new ExcelJS.Workbook();await w.xlsx.load(b);const s=w.getWorksheet('All Terms'),notes=w.getWorksheet('Notes');if(!s||!notes)throw Error('Use the paid-search workbook with All Terms and Notes sheets.');
 const value=(sheet,r,c)=>{const v=sheet.getCell(r,c).value;if(v&&typeof v==='object')throw Error('Formulas and rich cell values are not supported in import data.');return v;};
 const sourceNotes={};for(let r=2;r<=11;r++)sourceNotes[String(value(notes,r,1)||r)]=String(value(notes,r,2)||'').slice(0,4000);
 const window=String(value(notes,3,2)||'').match(/(\d{1,2})\/(\d{1,2})\/(\d{4})\s*[–-]\s*(\d{1,2})\/(\d{1,2})\/(\d{4})/);if(!window)throw Error('The Notes sheet must specify the reporting window.');
 const iso=(m,d,y)=>`${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`,period={start:iso(window[1],window[2],window[3]),end:iso(window[4],window[5],window[6])};
 if(![period.start,period.end].every(x=>!isNaN(Date.parse(x))&&new Date(x).toISOString().slice(0,10)===x)||period.start>period.end)throw Error('Invalid reporting dates.');
 if(value(s,4,2)!=='Search Term'||value(s,4,4)!=='Account(s)'||value(s,4,10)!=='Leads'||value(s,4,12)!=='Sales')throw Error('Unexpected All Terms columns.');
 if(s.rowCount>10005)throw Error('Maximum 10,000 terms per import.');const rows=[],seen=new Set();
 for(let r=5;r<=s.rowCount;r++){
  const term=String(value(s,r,2)||'').trim().toLowerCase();if(!term)continue;if(term.length>500||seen.has(term))throw Error('Duplicate or oversized search term.');seen.add(term);
  const account=value(s,r,4);if(!['MC','MFAQ','MC+MFAQ'].includes(account))throw Error('Unknown account scope.');
  const number=c=>{const v=value(s,r,c);if(typeof v!=='number'||!Number.isFinite(v)||v<0)throw Error('Missing or invalid paid-search metrics.');return v;};
  const row={term,account,category:String(value(s,r,3)||''),impressions:number(5),googleImpressions:number(6),bingImpressions:number(7),clicks:number(8),leads:number(10),sales:number(12)};
  if(row.impressions!==row.googleImpressions+row.bingImpressions)throw Error('Paid-search impressions do not reconcile.');if(row.clicks>row.impressions)row.qualityIssue='Clicks exceed reported impressions; excluded from matching and prioritization.';rows.push(row);
 }
 if(!rows.length)throw Error('No paid-search terms found.');
 return {fingerprint:createHash('sha256').update(b).digest('hex'),payload:{sourceNotes,filename:String(filename).slice(0,200),period,rows,scope:'Paid search · Google + Bing · account scope retained per row',methodology:'Platform-attributed leads and sales, not Salesforce policy counts. Combined MC+MFAQ cannot be separated by site. Paid impressions are not organic demand. Low-volume queries are incomplete; trends can reflect bids and budgets.'}};
}
