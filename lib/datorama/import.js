import ExcelJS from 'exceljs';
import {createHash} from 'node:crypto';
import {checkZip} from '../research/paid-search-import.js';
import {validateDaily,validDate} from './periods.js';
export const IMPORT_LIMIT=3000000;
const definitions=[['allLeads','Lead Count (All)'],['filteredLeads','Lead Count (Filtered)'],['soldLeads','Lead Count (Sold)'],['eipLeads','Lead Count (EIP)'],['grossMS','Gross MS Policy Count'],['grossMA','Gross MA Policy Count'],['approvedMS','Approved MS Policy Count'],['approvedMA','Approved MA Policy Count'],['opportunities','Opportunity Count']];
const value=c=>{const v=c.value;if(v&&typeof v==='object'&&!(v instanceof Date))throw Error('Use the original export without formulas or edited cells.');return v;};
const number=v=>{if(v==null||v==='')return null;if(!Number.isSafeInteger(v)||v<0)throw Error('Invalid count in workbook.');return v;};
function table(sheet){
 if(!sheet||sheet.rowCount>10000||sheet.columnCount>100)throw Error('Missing or oversized report sheet.');
 const headers=sheet.getRow(5).values.map(v=>String(v||'').trim());
 const col=name=>{const i=headers.indexOf(name);if(i<1)throw Error('Missing column: '+name);return i;};
 const get=(r,name)=>value(sheet.getCell(r,col(name)));
 return {sheet,headers,col,get};
}
function periodOf(t){const raw=String(value(t.sheet.getCell(2,2))||''),m=raw.match(/^(\d{2})-(\d{2})-(\d{4}) (\d{2})-(\d{2})-(\d{4})$/);if(!m)throw Error('Missing Datorama widget date range.');const p={start:`${m[3]}-${m[2]}-${m[1]}`,end:`${m[6]}-${m[5]}-${m[4]}`};if(!validDate(p.start)||!validDate(p.end)||p.end<p.start||Date.parse(p.end)-Date.parse(p.start)>3999*86400000)throw Error('Invalid report period.');return p;}
function daily(t,keys,period){
 const rows=new Map();let totals=null;
 for(let r=6;r<=t.sheet.rowCount;r++){const raw=t.get(r,'Day');if(raw==null)continue;if(raw==='Totals'){if(totals)throw Error('Duplicate total row.');totals=Object.fromEntries(keys.map(([k,h])=>[k,number(t.get(r,h))]));continue;}
 const date=raw instanceof Date?raw.toISOString().slice(0,10):String(raw).slice(0,10);if(!validDate(date)||date<period.start||date>period.end||rows.has(date))throw Error('Invalid or duplicate daily date.');rows.set(date,Object.fromEntries(keys.map(([k,h])=>[k,number(t.get(r,h))])));
 }if(!totals||!rows.size)throw Error('Daily rows and Totals are required.');
 for(const [k] of keys)if(totals[k]!==[...rows.values()].reduce((s,v)=>s+(v[k]??0),0))throw Error('Daily values do not reconcile with Totals: '+k);
 return {rows,totals};
}
export async function parseDatorama(buffer,filename,exportedAt){
 const b=Buffer.from(buffer);if(b.length>IMPORT_LIMIT)throw Error('Choose an XLSX workbook smaller than 3 MB.');checkZip(b);
 if(!Number.isFinite(Date.parse(exportedAt))||Date.parse(exportedAt)>Date.now()+300000)throw Error('Choose the actual export date and time, not a future date.');
 const w=new ExcelJS.Workbook();await w.xlsx.load(b);
 const sheets=w.worksheets.map(s=>table(s));
 const find=(column,day)=>{const matches=sheets.filter(t=>t.headers.includes(column)&&t.headers.includes(day?'Day':'Lead URL')&&(day||t.headers.includes('Channel')));if(matches.length!==1)throw Error('Export the full SEO report with daily Gross/Approved and SEO KPIs sheets.');return matches[0];};
 const gross=find('Gross MS Policy Count',true),approved=find('Approved MS Policy Count',true),period=periodOf(gross);
 if(JSON.stringify(periodOf(approved))!==JSON.stringify(period))throw Error('Report sheets have different periods.');
 const grossKeys=definitions.filter(([k])=>!k.startsWith('approved')),approvedKeys=definitions.filter(([k])=>!k.startsWith('gross'));
 const g=daily(gross,grossKeys,period),a=daily(approved,approvedKeys,period);
 for(const [date,v] of g.rows)for(const k of ['allLeads','filteredLeads','soldLeads','eipLeads','opportunities'])if(v[k]!==a.rows.get(date)?.[k])throw Error('Gross and Approved lead counts do not agree.');
 // Daily aggregates cannot be filtered by site after export. Require URL-level scope evidence and reconciliation.
 for(const [column,source,keys] of [['Gross MS Policy Count',g,grossKeys],['Approved MS Policy Count',a,approvedKeys]]){
  const t=find(column,false);if(JSON.stringify(periodOf(t))!==JSON.stringify(period))throw Error('SEO and daily periods differ.');
  const supported=keys.filter(([,h])=>t.headers.includes(h)),sums=Object.fromEntries(supported.map(([k])=>[k,0]));let count=0;
  for(let r=6;r<=t.sheet.rowCount;r++){const channel=t.get(r,'Channel');if(channel==='Totals'||channel==null)continue;let u;try{u=new URL(String(t.get(r,'Lead URL')));}catch{throw Error('The export includes missing or invalid landing URLs. Filter Datorama to MedicareFAQ only.');}
   if(channel!=='SEO'||!['medicarefaq.com','www.medicarefaq.com'].includes(u.hostname)||!['https:','http:'].includes(u.protocol))throw Error('This export contains other websites or channels. Filter to MedicareFAQ.com and SEO, then export again.');
   count++;for(const [k,h] of supported)sums[k]+=number(t.get(r,h))??0;
  }if(!count||supported.some(([k])=>sums[k]!==source.totals[k]))throw Error('MedicareFAQ URL totals do not match the daily report. Check filters and export all rows.');
 }
 const rows=[];for(let d=Date.parse(period.start);d<=Date.parse(period.end);d+=86400000){const date=new Date(d).toISOString().slice(0,10);rows.push({date,values:Object.fromEntries(definitions.map(([k])=>[k,(k.startsWith('approved')?a:g).rows.get(date)?.[k]??null]))});}
 const through=rows.filter(r=>r.values.allLeads!==null).at(-1)?.date;if(!through)throw Error('No lead data found.');
 const data=validateDaily({version:2,scopeId:'medicarefaq-production',scope:'Datorama SEO channel; MedicareFAQ.com production URLs only. URL totals reconciled with daily counts.',dateBasis:'Policies reported on lead-created date',timezone:'Timezone not supplied',url:'https://platform.datorama.com/72141/visualize',period,leadDataThrough:through,exportedAt:new Date(exportedAt).toISOString(),metrics:definitions.map(([key,label])=>({key,label:key==='opportunities'?'Salesforce Opportunity Count':label})),rows,totals:Object.fromEntries(definitions.map(([k])=>[k,rows.reduce((s,r)=>s+(r.values[k]??0),0)]))});
 return {id:createHash('sha256').update(b).digest('hex'),filename:String(filename).slice(0,200),data};
}
export function importPreview(report,current){const d=report.data;return {id:report.id,filename:report.filename,period:d.period,exportedAt:d.exportedAt,leadDataThrough:d.leadDataThrough,metrics:d.metrics.map(m=>({...m,total:d.totals[m.key],missingDays:d.rows.filter(r=>r.values[m.key]===null).length})),blocked:current&&(Date.parse(d.exportedAt)<=Date.parse(current.exportedAt)||d.period.start>current.period.start||d.period.end<current.period.end||d.leadDataThrough<current.leadDataThrough)?'This export is older or covers less history than the current report. Export the full reporting history through the latest date.':null};}
