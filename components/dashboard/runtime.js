import { installChatHistory, MAX_MESSAGES } from './chat-history.js';
import { startPortraitSpeech } from './speech.js';
// Live navigation, source status, and Ask Charlie lifecycle.
export function initializeDashboard(root, userId, { growthAllowed = false } = {}) {
const controller = new AbortController();
const listen = (type, handler) => root.addEventListener(type, handler, { signal: controller.signal });

const icons={overview:'<path d="M3 13h7V3H3zM14 21h7V11h-7zM14 3h7v4h-7zM3 17h7v4H3z"/>',acquisition:'<path d="M3 17 9 11l4 4 8-9M15 6h6v6"/>',leads:'<path d="M3 4h18l-7 8v6l-4 3v-9z"/>',content:'<path d="M4 3h16v18H4zM8 8h8M8 12h8M8 16h5"/>',opportunities:'<path d="M12 3a7 7 0 0 0-4 12v3h8v-3a7 7 0 0 0-4-12zM9 21h6"/>',measurement:'<path d="M4 4h16v16H4zM8 15l3-3 2 2 4-5"/>'};
icons.connections='<path d="M8 3v4M16 3v4M5 7h14v4a7 7 0 0 1-14 0zM12 18v4"/>';icons.keywords='<circle cx="10" cy="10" r="6"/><path d="m15 15 6 6"/>';
const state={view:'overview'};
const $=id=>root.querySelector('#'+id);
const safe=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function section(title,right=''){return '<div class="section-heading"><h2>'+title+'</h2><small>'+right+'</small></div>'}
const views=[['overview','Overview'],['acquisition','Acquisition'],['leads','Leads & funnel'],['connections','Data sources']];
if (growthAllowed) { views.splice(3,0,['growth','Growth Hunter']); icons.growth=icons.opportunities; }
function render(){
 root.dataset.activeView=state.view;
 $('organic-live-host').hidden=state.view!=='overview';
 $('gsc-live-host').hidden=state.view!=='acquisition';
 $('organic-leads-host').hidden=state.view!=='leads';
 if ($('growth-hunter-host')) $('growth-hunter-host').hidden=state.view!=='growth';
 root.dispatchEvent(new root.ownerDocument.defaultView.CustomEvent('growth-visibility', { detail: state.view==='growth' }));
 const label=views.find(v=>v[0]===state.view)[1];
 $('view-title').textContent=label;$('crumb').textContent=label;
 root.querySelectorAll('[data-nav]').forEach(b=>{b.classList.toggle('active',b.dataset.nav===state.view);if(b.dataset.nav===state.view)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current')});
 $('app').innerHTML=state.view==='connections'?connectionsView():'';
}
const connectors=[
{id:'posthog',name:'PostHog',mark:'P',color:'#df9842',kind:'Organic traffic & tracked events'},
{id:'gsc',name:'Google Search Console',mark:'G',color:'#4285f4',kind:'Search performance'},
{id:'datorama',name:'Datorama export',mark:'D',color:'#286547',kind:'Historical leads & policies'},
{id:'semrush',name:'Semrush',mark:'S',color:'#f17a3b',kind:'Keyword intelligence'},
{id:'crm',name:'CRM / Salesforce',mark:'SF',color:'#209dcc',kind:'Lead and sales records'},
{id:'calls',name:'Call tracking',mark:'☎',color:'#7363b4',kind:'Phone lead attribution'}];
const sourceChecks={};let sourceBusy=false,sourceStarted=false;const sourceActivity=[];
function sourceTime(value){return value?new Date(value).toLocaleString(): 'Not checked yet'}
function connectionsView(){
 if(!sourceStarted){sourceStarted=true;queueMicrotask(()=>refreshSources('all',false))}
 return '<div class="panel-head"><div><h2>Source overview</h2><p class="mock-note">Live PostHog/GSC checks and historical imports · See each source for coverage.</p></div><button class="button primary" data-refresh="all" '+(sourceBusy?'disabled':'')+'>'+(sourceBusy?'Checking…':'Refresh all')+'</button></div><div class="source-grid">'+connectors.map(c=>{
 const live=['posthog','gsc'].includes(c.id),imported=c.id==='datorama',check=sourceChecks[c.id],status=check?.status||((live||imported)?'Not checked yet':'Not connected');
 return '<details class="card connection-card dashboard-source-section" open><summary class="connection-top"><span class="source-logo" style="--source-color:'+c.color+'">'+c.mark+'</span><span><strong>'+c.name+'</strong><small style="display:block">'+c.kind+'</small></span><span class="connection-state" style="color:'+(status==='Connected'?'#168455':'#68736c')+'">'+safe(status)+'</span><span class="dashboard-source-toggle"><span class="when-open">Collapse ▴</span><span class="when-closed">Expand ▾</span></span></summary><dl><dt>Workspace</dt><dd>'+ (imported?'SEO: Landing Page · workspace 72141':live?(c.id==='posthog'?'MedicareFAQ · Project 452683':'https://www.medicarefaq.com/'):'Not configured')+'</dd><dt>Report retrieved</dt><dd>'+safe(sourceTime(check?.fetchedAt))+'</dd><dt>Last checked</dt><dd>'+safe(sourceTime(check?.checkedAt))+'</dd><dt>Refresh behavior</dt><dd>'+(imported?'Manual import · no automatic sync':live?'On demand · '+(c.id==='posthog'?'5':'15')+' minute report cache':'Not connected')+'</dd><dt>Report coverage</dt><dd>'+(check?.period?safe(check.period.start+' – '+check.period.end+' · '+check.timezone):'—')+'</dd></dl><footer><span>'+(check?.error?safe(check.error):imported?'Historical export in Leads & funnel. Source definitions require confirmation.':live?(c.id==='posthog'?'Organic traffic; tracked submissions and phone clicks available in Leads & funnel.':'Finalized Google Web search data; availability lags today.'):'No live data is connected to this dashboard.')+'</span>'+(live?'<button class="refresh-btn" data-refresh="'+c.id+'" '+(sourceBusy?'disabled':'')+'>Refresh</button>':'')+'</footer></details>'
 }).join('')+'</div><details class="card panel dashboard-source-section" open><summary><strong>Refresh activity</strong><span class="dashboard-source-toggle"><span class="when-open">Collapse ▴</span><span class="when-closed">Expand ▾</span></span></summary><p>Checks from this page session · Refresh retrieves a report, not new events from your website.</p><div aria-live="polite">'+(sourceActivity.length?sourceActivity.map(x=>'<div class="activity-row"><span>'+safe(sourceTime(x.time))+'</span><b>'+safe(x.name)+'</b><span>'+safe(x.status)+'</span></div>').join(''):'No checks completed yet.')+'</div></details>';
}
async function refreshSources(id,refresh=true){
 if(sourceBusy||controller.signal.aborted)return;sourceBusy=true;if(state.view==='connections')render();
 try{const response=await fetch('/api/analytics/sources?source='+encodeURIComponent(id)+'&refresh='+(refresh?'1':'0'),{cache:'no-store',signal:controller.signal});if(!response.ok)throw new Error('Source check failed');const result=await response.json();for(const check of result.sources){sourceChecks[check.id]=check;sourceActivity.unshift({time:check.checkedAt,name:connectors.find(c=>c.id===check.id).name,status:check.status})}}
 catch{if(!controller.signal.aborted)for(const key of id==='all'?['posthog','gsc']:[id]){sourceChecks[key]={status:'Unavailable',checkedAt:new Date().toISOString(),error:'Unable to check this source. Please retry.'};sourceActivity.unshift({time:new Date().toISOString(),name:connectors.find(c=>c.id===key).name,status:'Check failed'})}}
 finally{sourceBusy=false;sourceActivity.splice(10);if(!controller.signal.aborted&&state.view==='connections')render()}
}
function updateChatScope(){if($('chat-scope'))$('chat-scope').textContent='MedicareFAQ · Live PostHog + GSC · Historical Datorama import · Chat period below.'}
function welcomeChat(){$('chat-log').innerHTML=`<div class="chat-message assistant"><p><b>What would you like to know?</b></p><p>Ask me about your real organic traffic and Google search performance. Your question and relevant analytics summaries are sent to Anthropic (Claude).</p><div class="chat-prompts">${['Summarize performance','Which pages need attention?','What are our top Google queries?','Show keyword opportunities'].map(q=>`<button type="button" data-chat-prompt="${q}">${q}</button>`).join('')}</div></div>`}
function toggleChat(open){$('data-chat').hidden=!open;$('chat-launcher').setAttribute('aria-expanded',String(open));if(open){updateChatScope();$('chat-input').focus()}else $('chat-launcher').focus()}
let chatMessages=[], chatPending=null, savedChat=null;
const chatHistory=installChatHistory(root,userId,{current:()=>savedChat,open:restoreChat});
function restoreChat(chat){resetChat();if(!chat)return;savedChat=structuredClone(chat);chatMessages=savedChat.messages;
 $('chat-period').value=String(chat.days);$('chat-log').replaceChildren();
 for(const message of chatMessages){const item=document.createElement('div');item.className='chat-message '+message.role+' chat-plain';item.textContent=message.content;if(message.sources?.length){const cite=document.createElement('div');cite.className='chat-citation';cite.textContent=message.sources.join(' · ')+(message.incomplete?' · Response shortened':'');item.appendChild(cite)}$('chat-log').appendChild(item)}$('chat-input').value='';
}
function resetChat(){chatPending?.abort();chatPending=null;chatMessages=[];savedChat=null;chatHistory.reset();$('chat-form').querySelector('button[type="submit"]').disabled=false;welcomeChat()}
async function submitChat(text){
 text=String(text||'').trim().slice(0,1000);if(!text||chatPending)return;if(chatMessages.length>=MAX_MESSAGES){chatHistory.limit();return;}
 const log=$('chat-log'),user=document.createElement('div');user.className='chat-message user';user.textContent=text;log.appendChild(user);
 const pending=document.createElement('div');pending.className='chat-message assistant';pending.textContent='Charlie is checking your data…';log.appendChild(pending);
 const request=new AbortController();chatPending=request;const timer=setTimeout(()=>request.abort(),100000);
 const button=$('chat-form').querySelector('button[type="submit"]');button.disabled=true;$('chat-input').value='';log.scrollTop=log.scrollHeight;
 const messages=[...chatMessages.slice(-10).map(({role,content})=>({role,content:content.slice(0,role==='user'?1000:8000)})),{role:'user',content:text}];
 try{
  const response=await fetch('/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({days:Number($('chat-period').value),messages}),signal:request.signal});
  const result=await response.json();if(!response.ok)throw Error(result.error||'Charlie could not answer. Try again.');
  if(chatPending!==request)return;
  pending.textContent=result.answer;pending.classList.add('chat-plain');
  const citation=document.createElement('div');citation.className='chat-citation';citation.textContent=(result.sources||[]).join(' · ')+(result.incomplete?' · Response shortened; ask a follow-up.':'');pending.appendChild(citation);
  chatMessages=[...chatMessages,{role:'user',content:text},{role:'assistant',content:result.answer,sources:(result.sources||[]),incomplete:Boolean(result.incomplete)}];
  const timestamp=new Date().toISOString();savedChat={id:savedChat?.id||crypto.randomUUID(),title:savedChat?.title||text.slice(0,90),days:Number($('chat-period').value),createdAt:savedChat?.createdAt||timestamp,updatedAt:timestamp,messages:chatMessages};chatHistory.saved(savedChat);
 }catch(error){if(chatPending!==request)return;pending.textContent=request.signal.aborted?'Request timed out. Please try again.':error.message;pending.setAttribute('role','alert');$('chat-input').value=text;}
 finally{clearTimeout(timer);if(chatPending===request){chatPending=null;button.disabled=false;log.scrollTop=log.scrollHeight;}}
}
$('chat-expand').addEventListener('click',()=>{const expanded=$('data-chat').classList.toggle('is-expanded');$('chat-expand').setAttribute('aria-pressed',String(expanded));$('chat-expand').setAttribute('aria-label',expanded?'Collapse chat':'Expand chat');$('chat-expand').title=expanded?'Collapse chat':'Expand chat'});
$('chat-launcher').addEventListener('click',()=>toggleChat($('data-chat').hidden));$('chat-close').addEventListener('click',()=>toggleChat(false));$('chat-clear').addEventListener('click',()=>{resetChat();$('chat-input').value='';$('chat-input').focus()});$('chat-form').addEventListener('submit',e=>{e.preventDefault();submitChat($('chat-input').value)});$('chat-input').addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();submitChat($('chat-input').value)}});listen('click',e=>{let prompt=e.target.closest('[data-chat-prompt]');if(prompt)submitChat(prompt.dataset.chatPrompt);if(e.target.closest('[data-chat-drilldown]'))toggleChat(false)});listen('keydown',e=>{if(e.key==='Escape'&&!$('data-chat').hidden)toggleChat(false)});$('chat-period').addEventListener('change',()=>resetChat());welcomeChat();updateChatScope();

let navHTML=views.map(([key,label])=>`<button data-nav="${key}" aria-label="${label}"><svg viewBox="0 0 24 24" aria-hidden="true">${icons[key]}</svg><span>${label}</span></button>`).join('');
$('nav').innerHTML=navHTML;$('mobile-nav').innerHTML=views.map(([key,label])=>`<button data-nav="${key}">${label}</button>`).join('');
listen('click',e=>{const target=e.target.closest('[data-nav],[data-go]');const view=target?.dataset.nav||target?.dataset.go;if(views.some(v=>v[0]===view)){state.view=view;render();scrollTo({top:0,behavior:'smooth'})}const refresh=e.target.closest('[data-refresh]');if(refresh)refreshSources(refresh.dataset.refresh)});
render();
const stopSpeech=startPortraitSpeech(root.querySelector('.portrait-speech'));
return ()=>{chatPending?.abort();chatPending=null;stopSpeech();controller.abort();document.body.style.overflow='';};
}
