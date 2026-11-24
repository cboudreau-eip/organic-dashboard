import {parseDatorama,importPreview,IMPORT_LIMIT} from './import.js';
export function createImportHandler({authorize,origin,load,save,parse=parseDatorama}){return async request=>{
 const reply=(v,s=200)=>Response.json(v,{status:s,headers:{'Cache-Control':'private, no-store'}});
 try{
  if(request.headers.get('origin')!==new URL(origin()).origin)return reply({error:'Import from the dashboard.'},403);
  const user=await authorize();if(!user)return reply({error:'Only the dashboard owner can import Datorama reports.'},403);
  const reader=request.body?.getReader();if(!reader)return reply({error:'Choose a workbook.'},400);const chunks=[];let size=0;
  try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>IMPORT_LIMIT+100000){await reader.cancel();return reply({error:'Choose a workbook smaller than 3 MB.'},413);}chunks.push(value);}}finally{reader.releaseLock();}
  const form=await new Response(Buffer.concat(chunks),{headers:{'Content-Type':request.headers.get('content-type')||''}}).formData(),file=form.get('file'),action=form.get('action');
  if(!['preview','import'].includes(action)||!file||typeof file.arrayBuffer!=='function'||!file.name.toLowerCase().endsWith('.xlsx'))return reply({error:'Choose an original Datorama XLSX export.'},422);
  if(form.get('scopeConfirmed')!=='yes')return reply({error:'Confirm the export uses MedicareFAQ.com SEO traffic and lead-created dates.'},422);
  let report;try{report=await parse(await file.arrayBuffer(),file.name,form.get('exportedAt'));}catch(e){return reply({error:e.message},422);}
  const current=await load(),preview=importPreview(report,current);
  if(action==='preview')return reply({preview});
  if(form.get('previewId')!==report.id)return reply({error:'Preview this file before importing.'},409);
  if(preview.blocked)return reply({error:preview.blocked},409);
  const result=await save(report,user,current);return reply({saved:true,duplicate:result?.duplicate||false,preview});
 }catch{return reply({error:'The import could not be saved. Your current report is unchanged. Please retry.'},503);}
};}
