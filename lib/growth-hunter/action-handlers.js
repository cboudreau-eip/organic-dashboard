import {actionInput,actionWindow,ActionError,uuid,ACTION_STATUSES} from './actions.js';
const reply=(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'private, no-store'}});
const fail=(message,status=503)=>{throw new ActionError(message,status);};
async function body(request){
 const reader=request.body?.getReader();if(!reader)fail('Enter action details.',400);
 const chunks=[];let size=0;
 try{for(;;){const {value,done}=await reader.read();if(done)break;size+=value.byteLength;if(size>16000){await reader.cancel();fail('Action request is too large.',413);}chunks.push(value);}}
 finally{reader.releaseLock();}
 const bytes=new Uint8Array(size);let at=0;for(const chunk of chunks){bytes.set(chunk,at);at+=chunk.length;}
 try{return JSON.parse(new TextDecoder().decode(bytes));}catch{fail('Invalid request.',400);}
}
const caught=e=>reply({error:e instanceof ActionError||[401,403,404].includes(e.status)?e.message:'Action storage is unavailable. Please retry.'},e.status||503);
export function actionHandlers({access,origin,measure}){
 async function one(client,id){
  const r=await client.from('growth_actions').select('*').eq('id',id).maybeSingle();
  if(r.error)fail('Action storage is unavailable.');if(!r.data)fail('Action not found.',404);return r.data;
 }
 return {
 async GET(request){try{
  const {client,role}=await access('read'),params=new URL(request.url).searchParams,id=params.get('id');
  if(id){if(!uuid(id))fail('Invalid action.',400);const action=await one(client,id);
   const r=await client.from('growth_action_results').select('*').eq('action_id',id).order('created_at',{ascending:false}).limit(10);
   if(r.error)fail('Saved results are unavailable.');return reply({action,results:r.data,role});
  }
  const offset=Number(params.get('offset')||0),status=params.get('status')||'all';
  if(!Number.isInteger(offset)||offset<0||offset>100000||!['all',...ACTION_STATUSES].includes(status))fail('Invalid action filter.',400);
  let query=client.from('growth_actions').select('id,page,title,notes,status,published_on,source_snapshot,created_at,updated_at,version',{count:'exact'});
  if(status!=='all')query=query.eq('status',status);
  const r=await query.order('updated_at',{ascending:false}).order('id').range(offset,offset+24);
  if(r.error)fail('Action storage is unavailable.');return reply({actions:r.data,total:r.count,role});
 }catch(e){return caught(e);}},
 async POST(request){try{
  if(request.headers.get('origin')!==new URL(origin()).origin)fail('Save actions from the dashboard.',403);
  const {client}=await access('run'),input=await body(request);
  if(input.operation==='measure'){
   if(!uuid(input.id)||!Number.isSafeInteger(input.version))fail('Reload this action.',400);
   const action=await one(client,input.id);
   if(action.version!==input.version)fail('This action changed. Reload it before measuring.',409);
   if(!['published','monitoring'].includes(action.status))fail('Mark this action published or monitoring first.');
   const selection=actionWindow(action.published_on,Number(input.days));
   const payload=await measure(client,action,selection);
   const latest=await one(client,input.id);
   if(latest.version!==action.version)fail('The action changed during measurement. Reload and retry.',409);
   const r=await client.from('growth_action_results').insert({action_id:action.id,action_version:action.version,published_on:action.published_on,window_days:Number(input.days),payload}).select('*').single();
   if(r.error)fail('Could not save the measurement. Reload the action and retry.',409);
   return reply({result:r.data},201);
  }
  const normalized=actionInput(input);
  const r=await client.from('growth_actions').insert(normalized).select('*').single();
  if(r.error?.code==='23505')fail('An active action already exists for this page. Open it in Saved actions.',409);
  if(r.error)fail('Could not save the action.');return reply({action:r.data},201);
 }catch(e){return caught(e);}},
 async PATCH(request){try{
  if(request.headers.get('origin')!==new URL(origin()).origin)fail('Edit actions from the dashboard.',403);
  const {client}=await access('run'),input=await body(request),normalized=actionInput(input,true);
  const r=await client.from('growth_actions').update(normalized).eq('id',input.id).eq('version',input.version).select('*').maybeSingle();
  if(r.error?.code==='23505')fail('Another active action already exists for this page.',409);
  if(r.error)fail('Could not update the action.');
  if(!r.data)fail('This action changed or is unavailable. Reload before saving.',409);
  return reply({action:r.data});
 }catch(e){return caught(e);}}
 };
}
