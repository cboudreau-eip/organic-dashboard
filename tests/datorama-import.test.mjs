import test from 'node:test';import assert from 'node:assert/strict';import ExcelJS from 'exceljs';
import {parseDatorama,importPreview} from '../lib/datorama/import.js';
import {createImportHandler} from '../lib/datorama/import-handler.js';
async function workbook({host='www.medicarefaq.com',mismatch=false,duplicate=false}={}){
 const w=new ExcelJS.Workbook(),common=['Lead Count (All)','Lead Count (Filtered)','Lead Count (Sold)','Lead Count (EIP)'];
 for(const mode of ['Gross','Approved']){const metrics=[...common,`${mode} MS Policy Count`,`${mode} MA Policy Count`];for(const daily of [true,false]){const s=w.addWorksheet(`${mode} ${daily?'daily':'URLs'}`);s.addRow(['Widget Name:',mode]);s.addRow(['Widget Date Range:','01-01-2026 02-01-2026']);s.addRow([]);s.addRow([]);s.addRow(daily?['Day',...metrics,'Opportunity Count']:['Channel','Lead URL',...metrics]);
 if(daily){s.addRow([new Date('2026-01-01'),5,4,1,3,null,1,2]);if(duplicate)s.addRow([new Date('2026-01-01'),5,4,1,3,null,1,2]);s.addRow(['Totals',5,4,1,3,0,1,2]);}else{s.addRow(['SEO',`https://${host}/page/`,mismatch?6:5,4,1,3,null,1]);s.addRow(['Totals','',5,4,1,3,0,1]);}}}return w.xlsx.writeBuffer();
}
test('Datorama imports reconcile scope and preserve missing days and policy cells',async()=>{const r=await parseDatorama(await workbook(),'report.xlsx','2026-01-03');assert.equal(r.data.rows.length,2);assert.equal(r.data.rows[0].values.grossMS,null);assert.equal(r.data.rows[1].values.allLeads,null);assert.equal(r.data.totals.allLeads,5);assert.equal(r.data.leadDataThrough,'2026-01-01');assert.equal(importPreview(r,{...r.data,exportedAt:'2026-01-04'}).blocked!==null,true);});
test('reject mixed domains, mismatched totals and duplicate dates',async()=>{await assert.rejects(()=>workbook({host:'example.com'}).then(b=>parseDatorama(b,'r.xlsx','2026-01-03')),/other websites/);await assert.rejects(()=>workbook({mismatch:true}).then(b=>parseDatorama(b,'r.xlsx','2026-01-03')),/totals do not match/);await assert.rejects(()=>workbook({duplicate:true}).then(b=>parseDatorama(b,'r.xlsx','2026-01-03')),/duplicate daily/);});
test('import requires owner, same origin, preview and fresh coverage; preview never saves',async()=>{
 const report=await parseDatorama(await workbook(),'r.xlsx','2026-01-03');let writes=0,allowed=true,current=null;
 const handler=createImportHandler({authorize:async()=>allowed?{id:'owner'}:null,origin:()=> 'https://app.test',load:async()=>current,parse:async()=>report,save:async()=>{writes++;return {};}});
 const request=(action,id,origin='https://app.test')=>{const f=new FormData();f.set('file',new Blob(['test']),'r.xlsx');f.set('scopeConfirmed','yes');f.set('action',action);f.set('previewId',id||'');return new Request('https://app.test/api',{method:'POST',headers:{origin},body:f});};
 assert.equal((await handler(request('preview'))).status,200);assert.equal(writes,0);assert.equal((await handler(request('import'))).status,409);assert.equal((await handler(request('import',report.id))).status,200);assert.equal(writes,1);
 current={...report.data,exportedAt:'2026-01-04'};assert.equal((await handler(request('import',report.id))).status,409);allowed=false;assert.equal((await handler(request('preview'))).status,403);assert.equal((await handler(request('preview','','https://evil.test'))).status,403);assert.equal(writes,1);
});
