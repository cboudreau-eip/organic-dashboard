export const MAX_CHATS = 30;
export const MAX_MESSAGES = 200;
const validDate = value => typeof value === 'string' && Number.isFinite(Date.parse(value));
export function historyKey(userId) {
  return typeof userId === 'string' && userId ? `organic-charlie-history-v1:${userId}` : null;
}
export function readChats(storage, key) {
  if (!key) return [];
  const value = JSON.parse(storage.getItem(key) || '[]');
  if (!Array.isArray(value)) throw new Error('Invalid saved history');
  return value.filter(chat => chat && typeof chat.id === 'string' && typeof chat.title === 'string' &&
    [7,28,30].includes(chat.days) && validDate(chat.createdAt) && validDate(chat.updatedAt) &&
    Array.isArray(chat.messages) && chat.messages.length > 0 && chat.messages.length <= MAX_MESSAGES && chat.messages.length % 2 === 0 &&
    chat.messages.every((m,i) => m && m.role === (i % 2 ? 'assistant' : 'user') && typeof m.content === 'string' && m.content.length <= 20000 &&
      (!m.sources || (Array.isArray(m.sources) && m.sources.length <= 20 && m.sources.every(s => typeof s === 'string' && s.length <= 2000)))))
    .sort((a,b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, MAX_CHATS);
}
export function saveChat(storage, key, chat) {
  if (!key) throw new Error('Sign-in identity unavailable');
  const existing = readChats(storage, key).filter(c => c.id !== chat.id);
  storage.setItem(key, JSON.stringify([chat, ...existing].slice(0, MAX_CHATS)));
}
export function chatTranscript(chat) {
  return ['Ask Charlie', chat.title, `Saved: ${chat.updatedAt}`, `Chat reporting setting: last ${chat.days} days`,
    'Historical conversation. Source dates below reflect the original answers; new replies use current evidence.', '',
    ...chat.messages.flatMap(m => [m.role === 'user' ? 'You:' : 'Charlie:', m.content,
      ...(m.sources?.length ? ['Sources:', ...m.sources] : []), ...(m.incomplete ? ['Answer was shortened.'] : []), ''])].join('\n');
}

export function installChatHistory(root, userId, { open, current }) {
  const key = historyKey(userId);
  const log = root.querySelector('#chat-log'), form = root.querySelector('#chat-form');
  const period = root.querySelector('.chat-period-label');
  const toolbar = document.createElement('div'); toolbar.className = 'chat-history-toolbar';
  toolbar.innerHTML = '<div><button type="button" id="chat-history-toggle" aria-expanded="false">History</button><button type="button" id="chat-download" disabled>Download chat</button></div><small id="chat-save-status" role="status">Completed replies save automatically in this browser.</small>';
  log.before(toolbar);
  const panel = document.createElement('section'); panel.className = 'chat-history-panel'; panel.hidden = true; panel.setAttribute('aria-label','Saved chat history'); log.before(panel);
  const toggle = toolbar.querySelector('#chat-history-toggle'), download = toolbar.querySelector('#chat-download'), status = toolbar.querySelector('#chat-save-status');
  function showHistory(show) {
    panel.hidden = !show; log.hidden = show; form.hidden = show; if (period) period.hidden = show;
    toggle.textContent = show ? 'Back to chat' : 'History'; toggle.setAttribute('aria-expanded',String(show));
    if (show) render();
  }
  function render() {
    panel.replaceChildren();
    const note = document.createElement('p'); note.textContent = 'Saved on this browser for your account, not synced across devices. Keeps the latest 30 conversations, up to 100 exchanges each. Clearing browser data removes them. Download any you want to keep.'; panel.append(note);
    let chats;
    try { chats = readChats(localStorage,key); }
    catch { const error = document.createElement('p'); error.setAttribute('role','alert'); error.textContent = 'Saved chats could not be read. Browser storage may be unavailable.'; panel.append(error); return; }
    if (!chats.length) { const empty = document.createElement('p'); empty.textContent = 'No saved chats yet. Ask Charlie a question to start.'; panel.append(empty); }
    for (const chat of chats) {
      const item = document.createElement('div'); item.className = 'chat-history-item';
      const button = document.createElement('button'); button.type = 'button'; button.className = 'chat-history-open';
      const title = document.createElement('strong'); title.textContent = chat.title;
      const detail = document.createElement('small'); detail.textContent = `${new Date(chat.updatedAt).toLocaleString()} · ${chat.messages.length / 2} replies · Last ${chat.days} days`;
      button.append(title,detail); button.addEventListener('click',() => { open(chat); showHistory(false); status.textContent = 'Opened saved chat. New replies use current source data.'; download.disabled = false; root.querySelector('#chat-input').focus(); });
      const remove = document.createElement('button'); remove.type='button'; remove.textContent='Delete'; remove.setAttribute('aria-label',`Delete chat: ${chat.title}`);
      remove.addEventListener('click',() => {
        if (!window.confirm('Delete this saved chat from this browser? Download it first if you want to keep a copy.')) return;
        try { localStorage.setItem(key,JSON.stringify(readChats(localStorage,key).filter(c=>c.id!==chat.id))); if (current()?.id === chat.id) open(null); render(); }
        catch { status.textContent='Could not delete the saved chat.'; }
      });
      item.append(button,remove); panel.append(item);
    }
  }
  toggle.addEventListener('click',() => showHistory(panel.hidden));
  download.addEventListener('click',() => {
    const chat = current(); if (!chat?.messages.length) return;
    const url = URL.createObjectURL(new Blob([chatTranscript(chat)],{type:'text/plain;charset=utf-8'}));
    const link = document.createElement('a'); link.href=url; link.download=`ask-charlie-${chat.updatedAt.slice(0,10)}.txt`; link.click(); setTimeout(()=>URL.revokeObjectURL(url),1000);
  });
  return {
    saved(chat) {
      download.disabled = false;
      try { saveChat(localStorage,key,chat); status.textContent='Saved in this browser.'; }
      catch { status.textContent='Could not save in this browser. Download this chat to keep it.'; }
      if (!panel.hidden) render();
    },
    reset() { showHistory(false); download.disabled=true; status.textContent='Completed replies save automatically in this browser.'; },
    limit() { status.textContent='This chat has reached 100 exchanges. Download it or start a new chat.'; },
    showHistory,
  };
}
