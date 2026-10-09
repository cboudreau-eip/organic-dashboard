// Runs a production Next build against an isolated mock Auth API. No real emails/accounts.
// Usage: npm run build && node scripts/test-auth-flow.mjs
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { JSDOM } from 'jsdom';

const appOrigin = 'http://127.0.0.1:3002';
const mockOrigin = 'http://127.0.0.1:3003';
const user = { id: '11111111-1111-4111-8111-111111111111', aud: 'authenticated', role: 'authenticated', email: 'test@example.com', email_confirmed_at: '2026-10-08T00:00:00Z', is_anonymous: false, app_metadata: {provider:'email',providers:['email']}, user_metadata: {}, created_at: '2026-10-08T00:00:00Z' };
const jwt = (exp, sub = user.id) => ['eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9', Buffer.from(JSON.stringify({ sub, role: 'authenticated', exp, iat: Math.floor(Date.now()/1000), iss: mockOrigin+'/auth/v1', aud: 'authenticated' })).toString('base64url'), 'test-signature'].join('.');
const access = jwt(Math.floor(Date.now()/1000)+3600);
const session = {access_token: access,refresh_token:'test-refresh-token',expires_in:3600,token_type:'bearer',user};
let resets = 0, updates = 0, refreshes = 0, signouts = 0, password = 'test-password-123';
const mock = createServer(async (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  let body = ''; for await (const chunk of req) body += chunk;
  const input = body ? JSON.parse(body) : {};
  const url = new URL(req.url, mockOrigin);
  const send = (status, value) => {res.statusCode = status;res.end(JSON.stringify(value));};
  if (url.pathname === '/auth/v1/token') {
    if (url.searchParams.get('grant_type') === 'refresh_token' && input.refresh_token === session.refresh_token) {refreshes++;return send(200,session);}
    if (input.email === user.email && input.password === password) return send(200,session);
    return send(400,{code:'invalid_credentials',message:'Invalid login credentials'});
  }
  if (url.pathname === '/auth/v1/recover') {resets++;assert.equal(url.searchParams.get('redirect_to'), appOrigin+'/auth/callback');return send(200,{});}
  if (req.headers.authorization !== 'Bearer '+access) return send(401,{code:'bad_jwt',message:'Invalid token'});
  if (url.pathname === '/auth/v1/user' && req.method === 'GET') return send(200,user);
  if (url.pathname === '/auth/v1/user' && req.method === 'PUT') {updates++;password=input.password;return send(200,user);}
  if (url.pathname === '/auth/v1/logout') {signouts++;return send(204,undefined);}
  send(404,{message:'Not found'});
});
await new Promise(resolve => mock.listen(3003,'127.0.0.1',resolve));
const child = spawn(process.execPath,['node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port','3002'],{
  env:{...process.env,SUPABASE_URL:mockOrigin,NEXT_PUBLIC_SUPABASE_URL:mockOrigin,NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:'sb_publishable_test_only',SITE_URL:appOrigin},stdio:['ignore','pipe','pipe'],windowsHide:true
});
let logs=''; child.stdout.on('data',chunk=>{logs+=chunk;process.stdout.write(chunk);});child.stderr.on('data',chunk=>{logs+=chunk;process.stderr.write(chunk);});
const jar = new Map();
async function request(path, init={}) {
  const res = await fetch(appOrigin+path,{...init,redirect:'manual',signal:AbortSignal.timeout(5000),headers:{Origin:appOrigin,Cookie:[...jar].map(([k,v])=>k+'='+v).join('; '),...init.headers}});
  for (const cookie of res.headers.getSetCookie()) {const [pair] = cookie.split(';');const i=pair.indexOf('=');const k=pair.slice(0,i),v=pair.slice(i+1);if (v) jar.set(k,v);else jar.delete(k);}
  return res;
}
async function submit(path, fields, matchText) {
  const response=await request(path);assert.equal(response.status,200);
  const dom=new JSDOM(await response.text());
  const forms=[...dom.window.document.querySelectorAll('form')];
  const form=matchText?forms.find(f=>f.textContent.includes(matchText)):forms[0];
  assert.ok(form,'form should be present');
  const data=new FormData();
  for (const input of form.querySelectorAll('input[name]')) data.append(input.name,input.value);
  for (const [k,v] of Object.entries(fields)) data.set(k,v);
  dom.window.close();
  return request(path,{method:'POST',body:data});
}
try {
  let ready=false;
  for(let n=0;n<60;n++){try{if((await request('/')).status===200){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,250));}
  assert.ok(ready,'Next server did not start: '+logs);
  for (const path of ['/dashboard','/update-password']) {const res=await request(path);assert.equal(res.status,307);assert.equal(res.headers.get('location'),'/');}
  console.log('PASS: unauthenticated dashboard and password page blocked');
  assert.equal((await request('/api/analytics/overview')).status,401);
  assert.equal((await request('/api/analytics/details')).status,401);
  console.log('PASS: private analytics API rejects unauthenticated requests');
  let result=await submit('/',{email:user.email,password:'incorrect-password'});
  assert.equal(result.status,200);assert.match(await result.text(),/Unable to sign in/);assert.equal(jar.size,0);
  console.log('PASS: incorrect credentials rejected');
  result=await submit('/',{email:user.email,password});
  assert.equal(result.status,303);assert.equal(result.headers.get('location'),'/dashboard');assert.ok(jar.size>0);
  const dashboard=await request('/dashboard');assert.equal(dashboard.status,200);assert.match(await dashboard.text(),/test@example.com/);
  console.log('PASS: valid login sets cookies and grants protected page access');
  assert.equal((await request('/api/analytics/overview?days=365')).status,400);
  assert.equal((await request('/api/analytics/details?days=365')).status,400);
  console.log('PASS: analytics API restricts query periods');
  const sessionCookie=[...jar.keys()].find(k=>/auth-token$/.test(k));assert.ok(sessionCookie);
  
  jar.set(sessionCookie,'base64-'+Buffer.from(JSON.stringify({...session,access_token:jwt(Math.floor(Date.now()/1000)+3600,'forged-id')})).toString('base64url'));
  assert.equal((await request('/dashboard')).status,307);
  jar.set(sessionCookie,'base64-'+Buffer.from(JSON.stringify({...session,access_token:jwt(Math.floor(Date.now()/1000)-3600),expires_at:Math.floor(Date.now()/1000)-3600})).toString('base64url'));
  assert.equal((await request('/dashboard')).status,200);assert.ok(refreshes>0);const refreshed = JSON.parse(Buffer.from(jar.get(sessionCookie).slice(7),'base64url').toString());assert.equal(refreshed.access_token,access);
  console.log('PASS: forged session rejected; expired session refreshed');
  result=await submit('/update-password',{password:'short',confirmation:'short'});
  assert.equal(result.status,200);assert.equal(updates,0);assert.match(await result.text(),/between 12 and 128/);
  result=await submit('/update-password',{password:'updated-password-456',confirmation:'updated-password-456'});
  assert.equal(result.status,303);assert.equal(updates,1);assert.equal(jar.size,0);assert.equal((await request('/dashboard')).status,307);
  console.log('PASS: password validation and authenticated update, followed by sign-out');
  result=await submit('/forgot-password',{email:user.email});assert.equal(result.status,200);assert.equal(resets,1);assert.match(await result.text(),/If this email has an account/);
  console.log('PASS: reset request uses configured callback URL (mock only; no email sent)');
  // The sign-out control is a React portal, so exercise its server action via the RSC reference
  // in a hydrated browser rather than inventing an action ID here.
  console.log('All HTTP auth flow checks passed. Sign-out calls observed:',signouts);
  if (process.argv.includes('--serve')) { console.log('Mock fixture ready at '+appOrigin+' for browser checks.'); await new Promise(resolve=>process.once('SIGINT',resolve)); }
} finally {
  child.kill();
  await new Promise(resolve=>mock.close(resolve));
}
