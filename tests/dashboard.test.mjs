import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { dashboardMarkup } from '../components/dashboard/markup.js';
import { initializeDashboard } from '../components/dashboard/runtime.js';

test('dashboard retains navigation, filters, saved views and remount cleanup', async () => {
  const dom = new JSDOM('<div id="host"></div>', { url: 'http://localhost/dashboard' });
  const { window } = dom;
  const names = ['window', 'document', 'localStorage', 'AbortController', 'scrollTo', 'fetch'];
  const previous = names.map(name => Object.getOwnPropertyDescriptor(globalThis, name));
  Object.assign(globalThis, { window, document: window.document, localStorage: window.localStorage, AbortController: window.AbortController, scrollTo: () => {}, fetch: async () => ({ ok: true, json: async () => ({ answer: 'Test reply <img src=x onerror=alert(1)>', sources: ['Fixture only'] }) }) });
  const root = document.getElementById('host');
  let dispose;
  try {
    root.innerHTML = dashboardMarkup;
    dispose = initializeDashboard(root, "test-user");
    assert.equal(root.querySelector('#view-title').textContent, 'Overview');
    assert.match(root.querySelector('#app').textContent, /19,601/);
    const site = root.querySelector('#site');
    site.value = 'faq'; site.dispatchEvent(new window.Event('change', { bubbles: true }));
    assert.doesNotMatch(root.querySelector('#app').textContent, /19,601/);
    root.querySelector('#saved-view-name').value = 'Team test';
    root.querySelector('#saved-view-form').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
    assert.equal(JSON.parse(localStorage.getItem('organic-demo-saved-views')).length, 1);
    for (const key of ['acquisition','leads','content','opportunities','keywords','connections','measurement','overview']) {
      root.querySelector(`[data-nav="${key}"]`).click();
      if (key === 'acquisition') { assert.equal(root.querySelector('#gsc-live-host').hidden,false); assert.equal(root.querySelector('#app').textContent,''); } else if (key === 'leads') { assert.equal(root.querySelector('#organic-leads-host').hidden,false); assert.equal(root.querySelector('#app').textContent,''); } else { assert.ok(root.querySelector('#app').textContent.length > 100, key); assert.equal(root.querySelector('#organic-leads-host').hidden,true); }
    }
    root.querySelector('[data-page]').click();
    assert.ok(root.querySelector('#drawer').classList.contains('open'));
    root.querySelector('.portrait-stage').click();
    assert.equal(root.querySelector('.charlie-presence').hidden, true);
    assert.equal(root.querySelector('#chat-launcher').hidden, false);
    dispose();
    assert.equal(document.body.style.overflow, '');
    root.querySelector('[data-nav="keywords"]').click();
    assert.equal(root.querySelector('#view-title').textContent, 'Overview');
    root.innerHTML = dashboardMarkup;
    dispose = initializeDashboard(root, "test-user");
    assert.equal(root.querySelector('.charlie-presence').hidden, true, 'hidden choice survives a fresh mount');
    assert.equal(root.querySelector('.charlie-restore').hidden, false);
    root.querySelector('.charlie-restore').click();
    assert.equal(root.querySelector('.charlie-presence').hidden, false);
    assert.equal(root.querySelector('.charlie-restore').hidden, true);
    assert.equal(root.querySelector('#data-chat').hidden, true, 'restore does not open chat');
    assert.equal(localStorage.getItem('organic-charlie-hidden'), 'false');
    root.querySelector('#chat-launcher').click();
    assert.equal(root.querySelector('#data-chat').hidden, false);
    root.querySelector('#chat-input').value = 'How many sessions?';
    root.querySelector('#chat-form').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
    assert.equal(root.querySelectorAll('.chat-message.user').length, 1);
    await new Promise(resolve=>setTimeout(resolve,0));
    assert.match(root.querySelector('.chat-plain').textContent,/Test reply/);
    assert.equal(root.querySelector('.chat-plain img'),null,'model HTML is never executed');
    assert.equal(root.querySelector('#chat-form button').disabled,false);
    root.querySelector('#chat-clear').click();
    assert.equal(root.querySelectorAll('.chat-message.user').length,0);
    assert.equal(root.querySelector('#saved-view-select').options.length, 2);
    root.querySelector('#chat-history-toggle').click();
    assert.equal(root.querySelectorAll('.chat-history-open').length,1);
    root.querySelector('.chat-history-open').click();
    assert.match(root.querySelector('.chat-plain').textContent,/How many sessions/);
    assert.match(root.querySelector('.chat-citation').textContent,/Fixture only/);
    assert.equal(root.querySelector('.chat-plain img'),null);
    assert.equal(root.querySelector('#chat-download').disabled,false);
    dispose();
    root.innerHTML=dashboardMarkup;
    dispose=initializeDashboard(root, "test-user");
    root.querySelector('#chat-history-toggle').click();
    assert.equal(root.querySelectorAll('.chat-history-open').length,1,'conversation survives remount');
    dispose();
    root.innerHTML=dashboardMarkup;
    dispose=initializeDashboard(root, "other-user");
    root.querySelector('#chat-history-toggle').click();
    assert.equal(root.querySelectorAll('.chat-history-open').length,0,'another account does not see the saved conversation');
  } finally {
    dispose?.(); dom.window.close();
    names.forEach((name,i) => previous[i] ? Object.defineProperty(globalThis,name,previous[i]) : delete globalThis[name]);
  }
});
