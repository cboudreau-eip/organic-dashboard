import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readChats, saveChat, historyKey, chatTranscript, MAX_CHATS } from '../components/dashboard/chat-history.js';
const storage = () => { const values=new Map(); return {getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v)}; };
const chat = id => ({id,title:'Saved question',days:28,createdAt:'2026-10-01T12:00:00Z',updatedAt:'2026-10-01T12:00:00Z',messages:[{role:'user',content:'Question'},{role:'assistant',content:'Answer <script>unsafe</script>',sources:['GSC: 2026-09-01 to 2026-09-28'],incomplete:true}]});
test('history is account-scoped, updates without duplicates, retains sources, and caps conversations',()=>{
  const store=storage(),key=historyKey('user-one');
  for(let i=0;i<MAX_CHATS+3;i++)saveChat(store,key,chat(String(i)));
  assert.equal(readChats(store,key).length,MAX_CHATS);
  assert.equal(readChats(store,historyKey('user-two')).length,0);
  assert.equal(historyKey(undefined),null);
  saveChat(store,key,{...chat('32'),title:'Updated'});
  assert.equal(readChats(store,key).filter(c=>c.id==='32').length,1);
  assert.equal(readChats(store,key)[0].title,'Updated');
  assert.match(chatTranscript(readChats(store,key)[0]),/GSC: 2026-09-01/);
  assert.match(chatTranscript(readChats(store,key)[0]),/Answer was shortened/);
});
test('invalid saved records are ignored and storage failures are not reported as successful saves',()=>{
  const store=storage(),key=historyKey('one');
  store.setItem(key,JSON.stringify([chat('ok'),{...chat('bad'),days:365},{...chat('bad-role'),messages:[{role:'assistant',content:'Wrong'}]}]));
  assert.equal(readChats(store,key).length,1);
  assert.throws(()=>saveChat({getItem:()=>null,setItem:()=>{throw Error('Quota exceeded')}},key,chat('1')));
  store.setItem(key,'broken json');assert.throws(()=>readChats(store,key));
});
