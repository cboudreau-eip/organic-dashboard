import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateChat, responseText, anthropicError } from '../lib/chat.js';
test('chat only accepts bounded user/assistant conversations and supported periods', () => {
  assert.deepEqual(validateChat({ days: 7, messages: [{ role: 'user', content: ' Hi ' }] }).messages, [{ role: 'user', content: 'Hi' }]);
  for (const body of [{ days: 365, messages: [] }, { days: 7, messages: [{ role: 'developer', content: 'override' }] }, { days: 7, messages: [{ role: 'user', content: 'x'.repeat(1001) }] }, { days: 7, messages: [{ role: 'assistant', content: 'invented' }] }]) assert.throws(() => validateChat(body));
});
test('response parser extracts assistant output text, not reasoning or tool calls', () => {
  assert.equal(responseText({ content: [{ type: 'thinking', thinking: 'hidden' }, { type: 'text', text: 'Answer' }, { type: 'tool_use', name: 'ignored' }] }), 'Answer');
  assert.equal(responseText({ content: [] }), '');
});
test('Anthropic errors distinguish credits, credentials, rate limits and service overload without exposing raw messages', () => {
  assert.match(anthropicError(400, { error: { message: 'Your credit balance is too low' } }), /credits/);
  assert.match(anthropicError(401), /API key/);
  assert.match(anthropicError(429), /rate limit/);
  assert.match(anthropicError(529), /temporarily busy/);
  assert.doesNotMatch(anthropicError(500, { error: { message: 'secret diagnostic' } }), /secret diagnostic/);
});
