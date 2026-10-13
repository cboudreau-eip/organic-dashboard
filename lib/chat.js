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
  return (data.output || []).filter(x => x.type === 'message').flatMap(x => x.content || []).filter(x => x.type === 'output_text').map(x => x.text).join('\n').trim();
}
