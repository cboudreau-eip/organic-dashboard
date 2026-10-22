
import { validateSnapshot } from './import.js';
const reply=(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'private, no-store'}});
const uuid=s=>/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s||'');
export function semrushHandlers({access,origin}) {
 return {
 async GET(request) {
  try {
   const {client,role}=await access('read');const params=new URL(request.url).searchParams,id=params.get('id');
   if([...params.keys()].some(k=>!['id','offset'].includes(k)||params.getAll(k).length>1))return reply({error:'Invalid report options.'},400);
   if(id){
    if(!uuid(id))return reply({error:'Invalid snapshot.'},400);
    const {data,error}=await client.from('semrush_snapshots').select('id,created_at,input').eq('id',id).maybeSingle();
    if(error)throw Error('storage');if(!data)return reply({error:'Snapshot not found.'},404);
    return reply({snapshot:{id:data.id,created_at:data.created_at,payload:validateSnapshot(data.input)},role});
   }
   const offset=Number(params.get('offset')||0);
   if(!Number.isSafeInteger(offset)||offset<0||offset>100000)return reply({error:'Invalid history offset.'},400);
   const {data,error}=await client.from('semrush_snapshots').select('id,created_at,summary').order('created_at',{ascending:false}).order('id').range(offset,offset+49);
   if(error)throw Error('storage');
   return reply({snapshots:data,role,hasMore:data.length===50});
  }catch(e){return reply({error:e.status===403?'You do not have access to keyword imports.':e.status===401?'Sign in to view tracked keywords.':'Keyword storage is unavailable. Please retry.'},[401,403,404].includes(e.status)?e.status:503);}
 },
 async POST(request) {
  try{
   if(request.headers.get('origin')!==new URL(origin()).origin)return reply({error:'Import from the dashboard.'},403);
   const {client}=await access('import');
   let text='';const reader=request.body?.getReader();if(!reader)return reply({error:'Choose a report.'},400);
   const chunks=[];let bytes=0;
   try{for(;;){const {done,value}=await reader.read();if(done)break;bytes+=value.byteLength;if(bytes>3_000_000){await reader.cancel();return reply({error:'Report exceeds 3 MB of worksheet data.'},413);}chunks.push(value);}}finally{reader.releaseLock();}
   const all=new Uint8Array(bytes);let at=0;for(const c of chunks){all.set(c,at);at+=c.length;}text=new TextDecoder().decode(all);
   let input,payload;
   try{input=JSON.parse(text);payload=validateSnapshot(input);}catch(e){return reply({error:e.message||'Invalid report.'},422);}
   const normalized={report:{matrix:input.report.matrix},scope:{...payload.scope,confirmed:true}};
   const summary={campaignId:payload.campaignId,start:payload.start,end:payload.end,scope:payload.scope,count:payload.rows.length};
   const {data,error}=await client.from('semrush_snapshots').insert({input:normalized,summary}).select('id,created_at').single();
   if(error?.code==='23505')return reply({duplicate:true,message:'This exact report and campaign setup are already saved.'});
   if(error)throw Error('storage');
   return reply({snapshot:{...data,payload}},201);
  }catch(e){return reply({error:e.status===403?'Analyst access is required to save imports.':e.status===401?'Sign in to import.':'The report could not be saved. Please retry.'},[401,403,404].includes(e.status)?e.status:503);}
 }
 };
}
