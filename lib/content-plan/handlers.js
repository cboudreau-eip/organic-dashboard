import {PlanError,planInput,mergePlan} from './contracts.js';
const reply=(data,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'private, no-store'}});
const caught=e=>reply({error:e instanceof PlanError||[401,403,404].includes(e.status)?e.message:'Content plan storage is unavailable. Please retry.'},e.status||503);
async function readBody(request){
 const reader=request.body?.getReader();if(!reader)throw new PlanError('Enter opportunity details.',400);
 let size=0;const chunks=[];
 try{for(;;){const {value,done}=await reader.read();if(done)break;size+=value.byteLength;if(size>60000){await reader.cancel();throw new PlanError('Brief request is too large.',413);}chunks.push(value);}}finally{reader.releaseLock();}
 const bytes=new Uint8Array(size);let offset=0;for(const part of chunks){bytes.set(part,offset);offset+=part.length;}
 try{return JSON.parse(new TextDecoder().decode(bytes));}catch{throw new PlanError('Invalid request.',400);}
}
export function planHandlers({access,origin,shortlist}){return {
 async GET(){try{
  const {client,role}=await access('read');
  const result=await client.from('content_plan_items').select('*');
  if(result.error)throw Error('Storage unavailable');
  return reply({...mergePlan(shortlist,result.data||[]),canEdit:role==='analyst'||role==='admin'});
 }catch(e){return caught(e);}},
 async PATCH(request){try{
  if(request.headers.get('origin')!==new URL(origin()).origin)throw new PlanError('Save from the dashboard.',403);
  const {client}=await access('run');
  const input=planInput(await readBody(request),shortlist.items.map(item=>item.id));
  const {id,version,...fields}=input;
  const result=version===0
   ?await client.from('content_plan_items').insert({id,...fields}).select('*').single()
   :await client.from('content_plan_items').update(fields).eq('id',id).eq('version',version).select('*').maybeSingle();
  if(result.error?.code==='23505'||(!result.error&&!result.data))throw new PlanError('Someone changed this opportunity. Reload before saving.',409);
  if(result.error)throw Error('Save failed');
  return reply({item:mergePlan(shortlist,[result.data]).items.find(item=>item.id===id)});
 }catch(e){return caught(e);}}
};}
