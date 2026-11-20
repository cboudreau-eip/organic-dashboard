import {uuid} from '../research/contracts.js';
import {WORK_STATUSES,LEGACY_WORK_STATUSES,storedWorkStatus} from './model.js';
const reply=(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'private, no-store'}});
function read(r){if(r.error){if(r.error.code==='40001')throw Object.assign(Error('This queue or source plan changed. Reload before saving; your unsaved brief is still in the editor.'),{status:409});throw Error('Work queue storage is unavailable.');}return r.data;}
export function workQueueHandlers({access,origin}){
 const fail=e=>reply({error:[400,401,403,404,409,422].includes(e.status)?e.message:'Unable to load or save the work queue. Your calendar is unchanged.'},e.status||503);
 async function sources(client,queue){if(!queue)return queue;const p=read(await client.from('proposed_content_plans').select('sourceDates:payload->sourceDates,calendar').eq('id',queue.source_plan_id).maybeSingle());return {...queue,entries:queue.entries.map(e=>({...e,planned_date:p?.calendar?.dates?.[e.assignment_id]||e.planned_date})),sourceDates:p?.sourceDates||{}};}
 return {
 async GET(){try{const {client,role}=await access('read');const queue=read(await client.from('content_work_pilots').select('*').order('created_at',{ascending:false}).limit(1).maybeSingle()),plan=read(await client.from('proposed_content_plans').select('id,version').order('created_at',{ascending:false}).limit(1).maybeSingle());return reply({queue:await sources(client,queue),plan,canEdit:['admin','analyst'].includes(role)});}catch(e){return fail(e);}},
 async POST(request){try{
  if(request.headers.get('origin')!==new URL(origin()).origin)throw Object.assign(Error('Make changes from the dashboard.'),{status:403});
  const {client}=await access('run');let bytes=0;const stream=request.body?.getReader();if(!stream)throw Object.assign(Error('Missing request.'),{status:400});
  const chunks=[];try{for(;;){const r=await stream.read();if(r.done)break;bytes+=r.value.length;if(bytes>100000){await stream.cancel();throw Object.assign(Error('Brief is too large.'),{status:422});}chunks.push(r.value);}}finally{stream.releaseLock();}
  let input;try{input=JSON.parse(Buffer.concat(chunks).toString());}catch{throw Object.assign(Error('Invalid request.'),{status:400});}
  if(!input||typeof input!=='object'||Array.isArray(input)||!Number.isInteger(input.version))throw Object.assign(Error('Invalid request.'),{status:422});
  let result;
  if(input.action==='start'){
   if(!uuid(input.planId))throw Object.assign(Error('Choose a saved plan.'),{status:422});
   result=await client.rpc('start_content_work_pilot',{plan_id:input.planId,expected_version:input.version}).single();
  }else if(input.action==='save'){
   if(!uuid(input.queueId)||typeof input.assignmentId!=='string'||input.assignmentId.length>100||typeof input.owner!=='string'||input.owner.length>120||![...WORK_STATUSES,...LEGACY_WORK_STATUSES].includes(input.status)||typeof input.brief!=='string'||!input.brief.trim()||input.brief.length>20000||Object.keys(input).some(k=>!['action','queueId','version','assignmentId','owner','status','brief'].includes(k)))throw Object.assign(Error('Choose a valid owner, status and brief (up to 20,000 characters).'),{status:422});
   result=await client.rpc('save_content_work_task',{pilot_id:input.queueId,expected_version:input.version,assignment_id:input.assignmentId,owner_name:input.owner.trim(),work_status:storedWorkStatus(input.status),work_brief:input.brief}).single();
  }else throw Object.assign(Error('Unknown queue action.'),{status:422});
  return reply({queue:await sources(client,read(result))},201);
 }catch(e){return fail(e);}}
 };
}
