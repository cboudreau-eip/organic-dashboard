import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { startPortraitSpeech } from '../components/dashboard/speech.js';

test('speech cycles every ten seconds, pauses, resumes, and stops on unmount', t => {
  t.mock.timers.enable({ apis: ['setInterval'] });
  const dom = new JSDOM('<div class="charlie-presence"><img alt="Charlie"><button><span></span></button></div>');
  const button = dom.window.document.querySelector('button');
  const portrait = dom.window.document.querySelector('img');
  const stop = startPortraitSpeech(button);
  assert.equal(button.textContent, 'Get back to work!');
  t.mock.timers.tick(9999);
  assert.equal(button.textContent, 'Get back to work!');
  t.mock.timers.tick(1);
  assert.equal(button.textContent, "What ya' looking at?");
  assert.ok(portrait.classList.contains('is-speaking'));
  const ended = new dom.window.Event('animationend');
  Object.defineProperty(ended, 'animationName', { value: 'charlie-wiggle' });
  portrait.dispatchEvent(ended);
  assert.equal(portrait.classList.contains('is-speaking'), false);
  t.mock.timers.tick(10000);
  assert.equal(button.textContent, "What's brown and sticky? A stick!");
  t.mock.timers.tick(10000);
  assert.equal(button.textContent, 'Get back to work!');
  button.click();
  assert.ok(portrait.parentElement.classList.contains('motion-paused'));
  t.mock.timers.tick(20000);
  assert.equal(button.textContent, 'Get back to work!');
  button.click();
  t.mock.timers.tick(10000);
  assert.equal(button.textContent, "What ya' looking at?");
  stop();
  assert.equal(portrait.classList.contains('is-speaking'), false);
  t.mock.timers.tick(20000);
  assert.equal(button.textContent, "What ya' looking at?");
  dom.window.close();
});


test('poses alternate only when loaded and respect pause and cleanup', t => {
  t.mock.timers.enable({ apis: ['setInterval'] });
  const dom = new JSDOM('<div class="charlie-presence"><button><span></span></button><div class="portrait-stage"><img class="portrait-pose is-active"><img class="portrait-pose portrait-kick"></div></div>');
  const button = dom.window.document.querySelector('button');
  const [standing, kicking] = dom.window.document.querySelectorAll('img');
  for (const img of [standing, kicking]) Object.defineProperty(img, 'complete', { value: true });
  Object.defineProperty(standing, 'naturalWidth', { value: 1024 });
  Object.defineProperty(kicking, 'naturalWidth', { value: 0, configurable: true });
  const stop = startPortraitSpeech(button);
  t.mock.timers.tick(10000);
  assert.ok(standing.classList.contains('is-active'), 'failed/unloaded image must not blank portrait');
  Object.defineProperty(kicking, 'naturalWidth', { value: 1024 });
  t.mock.timers.tick(10000);
  assert.ok(kicking.classList.contains('is-active'));
  assert.equal(standing.classList.contains('is-active'), false);
  assert.equal(button.textContent, 'Kapow!!!');
  button.click();
  t.mock.timers.tick(20000);
  assert.ok(kicking.classList.contains('is-active'));
  assert.equal(button.textContent, 'Kapow!!!');
  button.click();
  t.mock.timers.tick(10000);
  assert.ok(standing.classList.contains('is-active'));
  assert.notEqual(button.textContent, 'Kapow!!!');
  stop();
  t.mock.timers.tick(20000);
  assert.ok(standing.classList.contains('is-active'));
  dom.window.close();
});


test('each new pose keeps its matching line throughout the four-pose rotation', t => {
  t.mock.timers.enable({ apis: ['setInterval'] });
  const dom = new JSDOM('<div class="charlie-presence"><button><span></span></button><div class="portrait-stage"><img class="portrait-pose is-active"><img class="portrait-pose portrait-kick"><img class="portrait-pose portrait-dancing"><img class="portrait-pose portrait-swole"></div></div>');
  const button = dom.window.document.querySelector('button');
  const poses = [...dom.window.document.querySelectorAll('img')];
  poses.forEach(img => { Object.defineProperty(img, 'complete', {value: true}); Object.defineProperty(img, 'naturalWidth', {value: 1024}); });
  const stop = startPortraitSpeech(button);
  for (const [index, line] of [[1,'Kapow!!!'],[2,'These numbers got me dancing!'],[3,'Check out these gains!'],[0,"What ya' looking at?"]]) {
    t.mock.timers.tick(10000);
    assert.equal(button.textContent,line);
    assert.deepEqual(poses.map(img=>img.classList.contains('is-active')),poses.map((_,i)=>i===index));
  }
  stop(); dom.window.close();
});
