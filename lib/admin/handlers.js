import {isOwner,OWNER_ID} from '../auth/access.js';
import {validEmail} from '../auth/config.js';
const uuid=v=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
const reply=(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'private, no-store','Referrer-Policy':'no-referrer'}});
const fail=(message,status=400)=>{throw Object.assign(new Error(message),{status});};
async function readBody(request){
 const reader=request.body?.getReader();if(!reader)fail('Enter user details.');
 let text='',size=0;const decoder=new TextDecoder();
 try{while(true){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>4096){await reader.cancel();fail('Request is too large.',413);}text+=decoder.decode(value,{stream:true});}}finally{reader.releaseLock();}
 try{return JSON.parse(text+decoder.decode());}catch{fail('Invalid request.');}
}
export function adminHandlers({getUser,getStore,origin}){
 async function authorize(){const user=await getUser();if(!isOwner(user))fail('Only the dashboard owner can manage users.',403);return user;}
 async function directory(store){const r=await store.rpc('admin_user_directory');if(r.error)fail('User list is unavailable.',503);return r.data;}
 async function save(store,actor,input){const r=await store.rpc('admin_save_member',{actor:actor.id,target:input.id,display_name:input.name,level:input.access,enabled:input.active,expected_version:input.version});if(r.error)fail(r.error.code==='40001'?'This user changed. Reload the list before saving.':'Could not save access. Reload the list and try again.',r.error.code==='40001'?409:503);}
 const caught=e=>reply({error:e.status?e.message:'User management is temporarily unavailable.'},e.status||503);
 return {
 async GET(){try{await authorize();return reply({users:await directory(getStore()),ownerId:OWNER_ID});}catch(e){return caught(e);}},
 async POST(request){try{
  if(request.headers.get('origin')!==new URL(origin()).origin)fail('Manage users from this dashboard.',403);
  const actor=await authorize(),input=await readBody(request);
  if(!input||typeof input!=='object'||Array.isArray(input))fail('Invalid request.');
  const keys={create:['operation','email','name','access'],edit:['operation','id','name','access','active','version'],setup:['operation','id'],delete:['operation','id','email','version']}[input.operation];
  if(!keys||Object.keys(input).some(k=>!keys.includes(k)))fail('Invalid user operation.');
  if(input.operation!=='create'&&(!uuid(input.id)||input.id===OWNER_ID))fail('Your owner account is protected.',403);
  if(['create','edit'].includes(input.operation)){
   if(typeof input.name!=='string'||input.name.trim().length>100||!['basic','viewer','analyst'].includes(input.access))fail('Choose a valid name and access level.');
   input.name=input.name.trim();
  }
  if(input.operation==='edit'&&(typeof input.active!=='boolean'||!Number.isSafeInteger(input.version)||input.version<0))fail('Reload this user before saving.');
  if(input.operation==='create'){
   if(typeof input.email!=='string')fail('Enter a valid email address.');input.email=input.email.trim().toLowerCase();if(!validEmail(input.email))fail('Enter a valid email address.');
  }
  const store=getStore();
  if(input.operation==='delete'){
   if(typeof input.email!=='string'||!validEmail(input.email)||!Number.isSafeInteger(input.version)||input.version<0)fail('Enter the user’s email to confirm deletion.');
   const prepared=await store.rpc('admin_prepare_user_deletion',{actor:actor.id,target:input.id,confirmation_email:input.email,expected_version:input.version});
   if(prepared.error)fail('Could not confirm deletion. Reload the list and check the email address.',409);
   let result;try{result=await store.auth.admin.deleteUser(input.id,true);}catch{fail('Access is blocked, but account deletion did not finish. Reload the list and retry Delete user.',503);}
   if(result.error)fail('Access is blocked, but account deletion did not finish. Reload the list and retry Delete user.',503);
   return reply({message:'User deleted. Their sign-in access has been removed; shared work and history are retained.'});
  }
  if(input.operation==='edit'){await save(store,actor,input);return reply({message:'User access saved.'});}
  const users=await directory(store);
  let selected;
  if(input.operation==='create'){
   if(users.some(u=>u.email?.toLowerCase()===input.email))fail('This email already has an account. Edit it in the list.',409);
  }else{
   selected=users.find(u=>u.id===input.id);if(!selected?.active)fail('Enable this user before creating a setup link.');
  }
  const result=await store.auth.admin.generateLink({type:selected?.confirmed?'recovery':'invite',email:selected?.email||input.email,options:{redirectTo:new URL('/auth/callback',origin()).href}});
  if(result.error||!result.data?.user?.id||!result.data?.properties?.action_link)fail('Could not create a setup link. Reload the user list before retrying.',503);
  if(input.operation==='create'){
   try{await save(store,actor,{...input,id:result.data.user.id,active:true,version:0});}
   catch{fail('The account was created but access was not enabled. Reload the list, enable the user, then create a setup link.',503);}
  }
  return reply({message:'Setup link created. Share it privately with this user. No email was sent.',email:selected?.email||input.email,setupLink:result.data.properties.action_link},input.operation==='create'?201:200);
 }catch(e){return caught(e);}}
 };
}
