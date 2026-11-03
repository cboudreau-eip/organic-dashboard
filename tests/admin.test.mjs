import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {OWNER_ID,dashboardUser,isOwner} from '../lib/auth/access.js';
import {adminHandlers} from '../lib/admin/handlers.js';
const target='1538055c-3f97-4b97-9e05-5c845378cc03';
const owner={id:OWNER_ID,email:'owner@example.test',email_confirmed_at:'2026-01-01'};
const req=input=>new Request('https://dashboard.test/api/admin/users',{method:'POST',headers:{origin:'https://dashboard.test','Content-Type':'application/json'},body:JSON.stringify(input)});
test('owner gate rejects forged metadata and other authenticated users before opening privileged storage',async()=>{
 for(const user of [null,{...owner,id:target,user_metadata:{role:'admin'},app_metadata:{role:'admin'}},{...owner,email_confirmed_at:null}]){
  const h=adminHandlers({getUser:async()=>user,getStore:()=>{throw Error('must not access');},origin:()=> 'https://dashboard.test'});
  assert.equal((await h.GET()).status,403);
  assert.equal((await h.POST(req({operation:'create'}))).status,403);
  assert.equal((await h.POST(req({operation:'delete',id:target,email:'user@example.test',version:1}))).status,403);
 }
 assert.equal(isOwner({...owner,email:'changed@example.test'}),true);
});
test('dashboard authorization checks current database membership and fails closed',async()=>{
 for(const result of [{data:false},{data:null},{error:{message:'private'}}]){
  const c={auth:{getUser:async()=>({data:{user:owner}})},rpc:async()=>result};
  assert.equal((await dashboardUser(c)).data.user,null);
 }
 const c={auth:{getUser:async()=>({data:{user:owner}})},rpc:async()=>({data:true})};
 assert.equal((await dashboardUser(c)).data.user.id,OWNER_ID);
});
test('admin mutation validates origin, owner protection, roles, and keeps link generation explicit',async()=>{
 const calls=[];const store={rpc:async(name,args)=>{calls.push([name,args]);return name==='admin_user_directory'?{data:[]}:{data:null};},auth:{admin:{generateLink:async args=>{calls.push(['link',args]);return {data:{user:{id:target},properties:{action_link:'https://auth.test/setup'}}};}}}};
 const h=adminHandlers({getUser:async()=>owner,getStore:()=>store,origin:()=> 'https://dashboard.test'});
 const cross=new Request('https://dashboard.test/api/admin/users',{method:'POST',headers:{origin:'https://evil.test'},body:'{}'});assert.equal((await h.POST(cross)).status,403);
 assert.equal((await h.POST(req({operation:'edit',id:OWNER_ID,name:'Owner',access:'basic',active:false,version:1}))).status,403);
 assert.equal((await h.POST(req({operation:'create',email:'new@example.test',name:'New',access:'admin'}))).status,400);
 assert.equal(calls.length,0);
 const response=await h.POST(req({operation:'create',email:'New@Example.test',name:'New',access:'viewer'}));
 assert.equal(response.status,201);assert.equal((await response.json()).setupLink,'https://auth.test/setup');
 assert.equal(calls[1][1].type,'invite');assert.equal(calls[1][1].options.redirectTo,'https://dashboard.test/auth/callback');
 assert.equal(calls[2][1].actor,OWNER_ID);assert.equal(calls[2][1].level,'viewer');
});
test('database denies direct access, preserves owner, and atomically disables existing-session access',async()=>{
 const db=new PGlite();try{
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;
 create function auth.uid() returns uuid language sql as $$select nullif(current_setting('test.uid',true),'')::uuid$$;
 create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}',banned_until timestamptz,email_confirmed_at timestamptz,last_sign_in_at timestamptz,created_at timestamptz default now(),deleted_at timestamptz);
 create table public.growth_members(user_id uuid primary key references auth.users,role text,active boolean);
 create table public.growth_settings(id boolean primary key,enabled boolean);insert into public.growth_settings values(true,true);
 insert into auth.users(id,email) values('${OWNER_ID}','owner@example.test'),('${target}','user@example.test');
 insert into public.growth_members values('${OWNER_ID}','analyst',true),('${target}','viewer',true);
 grant usage on schema public,auth to anon,authenticated,service_role;
 `);
 await db.exec(await readFile(new URL('../supabase/migrations/20261103190000_owner_user_management.sql',import.meta.url),'utf8'));
 await db.exec(`set role authenticated;set test.uid='${target}';`);
 assert.equal((await db.query('select public.dashboard_access() as access')).rows[0].access,true);
 await assert.rejects(db.exec('select public.admin_user_directory()'),e=>e.code==='42501');
 await assert.rejects(db.exec(`update public.dashboard_members set active=true`),e=>e.code==='42501');
 await assert.rejects(db.exec(`select public.admin_save_member('${OWNER_ID}','${target}','Forged','analyst',true,1)`),e=>e.code==='42501');
 await db.exec('reset role;set role service_role;');
 await assert.rejects(db.exec(`select public.admin_save_member('${OWNER_ID}','${OWNER_ID}','Oops','basic',false,1)`),e=>e.code==='42501');
 await assert.rejects(db.exec(`select public.admin_save_member('${target}','${target}','Oops','analyst',true,1)`),e=>e.code==='42501');
 await db.exec(`select public.admin_save_member('${OWNER_ID}','${target}','User','viewer',false,1)`);
 await assert.rejects(db.exec(`select public.admin_save_member('${OWNER_ID}','${target}','Stale','analyst',true,1)`),e=>e.code==='40001');
 await db.exec('reset role;set role authenticated;');
 assert.equal((await db.query('select public.dashboard_access() as access,public.growth_access() as growth')).rows[0].access,false);
 assert.equal((await db.query('select public.growth_access() as growth')).rows[0].growth,null);
 await db.exec('reset role;');assert.equal((await db.query('select count(*) as count from public.dashboard_user_audit')).rows[0].count,1);
 await db.exec(await readFile(new URL('../supabase/migrations/20261103193206_owner_user_deletion.sql',import.meta.url),'utf8'));
 await db.exec('set role authenticated;');
 await assert.rejects(db.exec(`select public.admin_prepare_user_deletion('${OWNER_ID}','${target}','user@example.test',2)`),e=>e.code==='42501');
 await db.exec('reset role;set role service_role;');
 await assert.rejects(db.exec(`select public.admin_prepare_user_deletion('${target}','${target}','user@example.test',2)`),e=>e.code==='42501');
 await assert.rejects(db.exec(`select public.admin_prepare_user_deletion('${OWNER_ID}','${OWNER_ID}','owner@example.test',1)`),e=>e.code==='42501');
 await assert.rejects(db.exec(`select public.admin_prepare_user_deletion('${OWNER_ID}','${target}','wrong@example.test',2)`),e=>e.code==='22023');
 await assert.rejects(db.exec(`select public.admin_prepare_user_deletion('${OWNER_ID}','${target}','user@example.test',1)`),e=>e.code==='40001');
 await db.exec(`select public.admin_prepare_user_deletion('${OWNER_ID}','${target}','user@example.test',2)`);
 await assert.rejects(db.exec(`select public.admin_save_member('${OWNER_ID}','${target}','User','analyst',true,3)`),e=>e.code==='42501');
 await db.exec(`select public.admin_prepare_user_deletion('${OWNER_ID}','${target}','user@example.test',3)`);
 await db.exec('reset role;set role authenticated;');
 assert.equal((await db.query('select public.dashboard_access() as access')).rows[0].access,false);
 await db.exec('reset role;');
 await db.exec(`update auth.users set deleted_at=now() where id='${target}'`);
 const directory=(await db.query('select public.admin_user_directory() as users')).rows[0].users;
 assert.equal(directory.length,1);assert.equal(directory[0].id,OWNER_ID);
 assert.equal((await db.query('select count(*) as count from public.dashboard_user_audit')).rows[0].count,3);
 }finally{await db.close();}
});

test('deletion validates confirmation, blocks access before Auth deletion, and handles partial failure',async()=>{
 const calls=[];let prepareError=null,deleteError=null;
 const h=adminHandlers({getUser:async()=>owner,origin:()=> 'https://dashboard.test',getStore:()=>({rpc:async(name,args)=>{calls.push([name,args]);return {error:prepareError};},auth:{admin:{deleteUser:async(id,soft)=>{calls.push(['delete',id,soft]);return {error:deleteError};}}}})});
 const input={operation:'delete',id:target,email:'user@example.test',version:1};
 assert.equal((await h.POST(req({...input,id:OWNER_ID}))).status,403);
 assert.equal((await h.POST(req({...input,email:''}))).status,400);
 assert.equal((await h.POST(req({...input,version:-1}))).status,400);
 assert.equal(calls.length,0);
 prepareError={code:'40001'};assert.equal((await h.POST(req(input))).status,409);assert.equal(calls.length,1);
 calls.length=0;prepareError=null;deleteError={message:'private provider detail'};
 const failed=await h.POST(req(input));assert.equal(failed.status,503);assert.match((await failed.json()).error,/Access is blocked/);
 assert.equal(calls[0][0],'admin_prepare_user_deletion');assert.deepEqual(calls[1],['delete',target,true]);
 deleteError=null;assert.equal((await h.POST(req(input))).status,200);
});

test('password operations enforce owner protection and validation before privileged storage',async()=>{
 const password='Test-only-password-123';
 for(const user of [null,{...owner,id:target}]){
  const h=adminHandlers({getUser:async()=>user,getStore:()=>assert.fail('privileged access'),origin:()=> 'https://dashboard.test'});
  for(const operation of ['password','create_password'])assert.equal((await h.POST(req({operation,id:target,password,confirmation:password}))).status,403);
 }
 const h=adminHandlers({getUser:async()=>owner,getStore:()=>assert.fail('invalid password reached storage'),origin:()=> 'https://dashboard.test'});
 for(const [p,c] of [['short','short'],[password,'different'],['a'.repeat(129),'a'.repeat(129)]])assert.equal((await h.POST(req({operation:'password',id:target,password:p,confirmation:c}))).status,400);
 assert.equal((await h.POST(req({operation:'password',id:OWNER_ID,password,confirmation:password}))).status,403);
});

test('owner creates and replaces passwords without exposing secrets or changing existing permissions',async()=>{
 const password='Test-only-password-123',calls=[];
 let users=[],providerError=null,saveError=null;
 const store={rpc:async(name,args)=>{calls.push([name,args]);return name==='admin_user_directory'?{data:users}:{error:saveError};},auth:{admin:{
 createUser:async args=>{calls.push(['create',args]);return {data:{user:{id:target}},error:providerError};},
 updateUserById:async(id,args)=>{calls.push(['password',id,args]);return {data:{user:{id}},error:providerError};}
 }}};
 const h=adminHandlers({getUser:async()=>owner,getStore:()=>store,origin:()=> 'https://dashboard.test'});
 const create={operation:'create_password',email:'New@Example.test',name:'New',access:'viewer',password,confirmation:password};
 let r=await h.POST(req(create));assert.equal(r.status,201);assert.ok(!(await r.text()).includes(password));
 assert.deepEqual(calls[1],['create',{email:'new@example.test',password,email_confirm:true}]);
 assert.deepEqual(calls[2],['admin_save_member',{actor:OWNER_ID,target,display_name:'New',level:'viewer',enabled:true,expected_version:0}]);
 const input={operation:'password',id:target,password,confirmation:password};
 for(const list of [[],[{id:target,active:false}],[{id:target,active:true,deletionPending:true}]]){
  users=list;calls.length=0;assert.equal((await h.POST(req(input))).status,400);assert.equal(calls.length,1);
 }
 users=[{id:target,active:true}];calls.length=0;
 r=await h.POST(req(input));assert.equal(r.status,200);assert.ok(!(await r.text()).includes(password));
 assert.deepEqual(calls,[['admin_user_directory',undefined],['password',target,{password,email_confirm:true}]]);
 providerError={message:password};r=await h.POST(req(input));assert.equal(r.status,503);assert.ok(!(await r.text()).includes(password));
 users=[];providerError=null;saveError={code:'unavailable'};r=await h.POST(req(create));assert.equal(r.status,503);assert.match((await r.json()).error,/access was not enabled/);
});
