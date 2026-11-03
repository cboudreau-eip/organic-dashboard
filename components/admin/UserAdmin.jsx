'use client';
import {useEffect,useState} from 'react';
const levels=[['basic','Dashboard only'],['viewer','Dashboard + Growth Hunter / AI visibility (view only)'],['analyst','Dashboard + Growth Hunter / AI visibility (can edit)']];
function AccessSelect({value,onChange}){return <select value={value} onChange={e=>onChange(e.target.value)}>{levels.map(([v,label])=><option key={v} value={v}>{label}</option>)}</select>;}
function UserRow({user,owner,busy,submit}){
 const [name,setName]=useState(user.name),[access,setAccess]=useState(user.access),[active,setActive]=useState(user.active);
 return <article className="admin-user"><header><h3>{user.email}</h3><span className={'admin-status '+(!user.active?'disabled':'')}>{owner?'Owner · only admin':user.active?'Enabled':'Disabled'}</span></header>
 <p>{user.confirmed?'Email confirmed':'Awaiting account setup'} · Last sign-in: {user.lastSignIn?new Date(user.lastSignIn).toLocaleString():'Never'}</p>
 {owner?<p>Your account is protected from edits and disabling here. No other user can be made an administrator.</p>:<form onSubmit={e=>{e.preventDefault();submit({operation:'edit',id:user.id,name,access,active,version:user.version});}}>
 <fieldset disabled={busy}><legend>Edit user access</legend><div className="admin-fields"><label>Name<input maxLength={100} value={name} onChange={e=>setName(e.target.value)}/></label><label>Permissions<AccessSelect value={access} onChange={setAccess}/></label><label>Account access<select value={active?'enabled':'disabled'} onChange={e=>setActive(e.target.value==='enabled')}><option value="enabled">Enabled</option><option value="disabled">Disabled</option></select></label></div>
 {!active&&<p>Saving Disabled blocks future dashboard requests and Growth Hunter access. Saved work stays in place.</p>}
 <div className="admin-actions"><button type="submit">Save user</button><button type="button" className="secondary" disabled={!user.active} onClick={()=>submit({operation:'setup',id:user.id})}>Create password setup link</button></div></fieldset></form>}
 </article>;
}
export default function UserAdmin(){
 const [data,setData]=useState(null),[error,setError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false),[link,setLink]=useState(null),[email,setEmail]=useState(''),[name,setName]=useState(''),[access,setAccess]=useState('basic');
 async function load(){const r=await fetch('/api/admin/users',{cache:'no-store'}),d=await r.json();if(!r.ok)throw Error(d.error||'Could not load users.');setData(d);}
 useEffect(()=>{load().catch(e=>setError(e.message));},[]);
 async function reload(){setBusy(true);setError('');try{await load();}catch(e){setError(e.message);}finally{setBusy(false);}}
 async function submit(input){setBusy(true);setError('');setNotice('');setLink(null);try{
  const r=await fetch('/api/admin/users',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(input)}),d=await r.json();if(!r.ok)throw Error(d.error||'Could not save user.');
  setNotice(d.message);if(d.setupLink)setLink({email:d.email,url:d.setupLink});if(input.operation==='create'){setEmail('');setName('');setAccess('basic');}await load();
 }catch(e){setError(e.message);}finally{setBusy(false);}}
 return <main className="user-admin"><header className="admin-heading"><div><span>ORGANIC GROWTH · OWNER ACCESS</span><h1>Manage users</h1><p>Only your account can open this area or change user access.</p></div><a href="/dashboard">← Back to dashboard</a></header>
 {error&&<p role="alert" className="admin-error">{error}</p>}{notice&&<p role="status" className="admin-notice">{notice}</p>}
 {link&&<section className="admin-link"><h2>Private setup link for {link.email}</h2><p>This link lets the recipient set a password. Share it only with that person. It expires and is not saved on this page after you leave.</p><label>Setup link<input readOnly value={link.url} onFocus={e=>e.target.select()}/></label><div className="admin-actions"><button onClick={async()=>{try{await navigator.clipboard.writeText(link.url);setNotice('Setup link copied.');}catch{setNotice('Select the link above and copy it manually.');}}}>Copy link</button><button className="secondary" onClick={()=>setLink(null)}>Dismiss link</button></div></section>}
 <section className="admin-create"><h2>Add a user</h2><p>Create an account and a private password setup link. No invitation email is sent automatically.</p><form onSubmit={e=>{e.preventDefault();submit({operation:'create',email,name,access});}}><fieldset disabled={busy||!data}><legend>New user details</legend><div className="admin-fields"><label>Email address<input required type="email" maxLength={254} value={email} onChange={e=>setEmail(e.target.value)} autoComplete="off"/></label><label>Name<input maxLength={100} value={name} onChange={e=>setName(e.target.value)}/></label><label>Permissions<AccessSelect value={access} onChange={setAccess}/></label></div><button type="submit">Add user &amp; create setup link</button></fieldset></form></section>
 <section><div className="admin-list-heading"><h2>Users {data?`(${data.users.length})`:''}</h2><button className="secondary" disabled={busy} onClick={reload}>Reload list</button></div><p>Dashboard-only users can view the standard reports. Viewer and analyst permissions add Growth Hunter and AI visibility; neither grants user-management access.</p>{!data&&!error&&<p role="status">Loading users…</p>}{data?.users.map(user=><UserRow key={user.id+':'+user.version} user={user} owner={user.id===data.ownerId} busy={busy} submit={submit}/>)}</section>
 </main>;
}
