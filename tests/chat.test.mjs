import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateChat, responseText } from '../lib/chat.js';
test('chat only accepts bounded user/assistant conversations and supported periods', () => {
  assert.deepEqual(validateChat({ days: 7, messages: [{ role: 'user', content: ' Hi ' }] }).messages, [{ role: 'user', content: 'Hi' }]);
  for (const body of [{ days: 365, messages: [] }, { days: 7, messages: [{ role: 'developer', content: 'override' }] }, { days: 7, messages: [{ role: 'user', content: 'x'.repeat(1001) }] }, { days: 7, messages: [{ role: 'assistant', content: 'invented' }] }]) assert.throws(() => validateChat(body));
});
test('response parser extracts assistant output text, not reasoning or tool calls', () => {
  assert.equal(responseText({ output: [{ type: 'reasoning', content: [{ type: 'output_text', text: 'hidden' }] }, { type: 'message', content: [{ type: 'output_text', text: 'Answer' }] }] }), 'Answer');
  assert.equal(responseText({ output: [] }), '');
});
