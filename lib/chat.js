export function validateChat(body) {
  if (!body || ![7, 28, 30].includes(body.days) || !Array.isArray(body.messages) || !body.messages.length || body.messages.length > 12) throw new Error('Invalid chat request.');
  const messages = body.messages.map((m, i) => {
    if (!m || m.role !== (i % 2 ? 'assistant' : 'user') || typeof m.content !== 'string' || !m.content.trim() || m.content.length > (m.role === 'user' ? 1000 : 8000)) throw new Error('Invalid chat message.');
    return { role: m.role, content: m.content.trim() };
  });
  if (messages.at(-1).role !== 'user') throw new Error('A question is required.');
  return { days: body.days, messages };
}
export function responseText(data) {
  return (data.content || []).filter(x => x.type === 'text' && typeof x.text === 'string').map(x => x.text).join('\n').trim();
}
export function anthropicError(status, data = {}) {
  if (status === 401) return 'Anthropic rejected the API key. Check ANTHROPIC_API_KEY in Vercel and redeploy.';
  if (/credit balance|billing|insufficient.*credit/i.test(data.error?.message || '')) return 'Anthropic API credits are unavailable. Check billing in your Anthropic Console, then try again.';
  if (status === 429) return 'Claude rate limit reached. Please wait a minute and try again.';
  if (status === 403 || status === 404) return 'This Anthropic account cannot access the configured model. Check key permissions and ANTHROPIC_MODEL.';
  if (status === 529) return 'Claude is temporarily busy. Please try again shortly.';
  return 'Claude could not answer right now. Please try again.';
}
