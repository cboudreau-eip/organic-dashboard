import {parsePaidWorkbook,PAID_LIMIT} from './paid-search-import.js';
export function paidImportHandler({access,origin}){return async function POST(request){
 try{
  if(request.headers.get('origin')!==new URL(origin()).origin)return Response.json({error:'Import from the dashboard.'},{status:403});
  const {client}=await access('import');
  // Stream-limit multipart input before parsing it.
  const reader=request.body?.getReader();if(!reader)return Response.json({error:'Choose a workbook.'},{status:400});
  let size=0;const chunks=[];try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>PAID_LIMIT+100000){await reader.cancel();return Response.json({error:'Choose a workbook smaller than 3 MB.'},{status:413});}chunks.push(value);}}finally{reader.releaseLock();}
  const form=await new Response(Buffer.concat(chunks),{headers:{'Content-Type':request.headers.get('content-type')||''}}).formData(),file=form.get('file');
  if(!file||typeof file.arrayBuffer!=='function'||!file.name.endsWith('.xlsx'))return Response.json({error:'Choose an XLSX paid-search workbook.'},{status:422});
  let source;try{source=await parsePaidWorkbook(await file.arrayBuffer(),file.name);}catch(e){return Response.json({error:e.message},{status:422});}
  const existing=await client.from('paid_search_research').select('id').eq('fingerprint',source.fingerprint).maybeSingle();if(existing.error)throw Error('storage');if(existing.data)return Response.json({id:existing.data.id,duplicate:true});
  const result=await client.from('paid_search_research').insert(source).select('id').single();if(result.error){if(result.error.code==='23505')return Response.json({duplicate:true});throw Error('storage');}
  return Response.json({id:result.data.id,terms:source.payload.rows.length},{status:201});
 }catch(e){return Response.json({error:[401,403,404].includes(e.status)?e.message:'Import could not be saved. The previous source and calendar are unchanged.'},{status:[401,403,404].includes(e.status)?e.status:503});}
}
; }
