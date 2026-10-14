import { overviewQuery } from './overview.js';

// Extract only this site's URLs. Never fetch a URL supplied in a conversation.
export function conversationPages(messages) {
  for (const message of [...messages].reverse()) {
    const paths = [];
    for (const match of message.content.matchAll(/(?:https?:\/\/)?(?:www\.)?medicarefaq\.com\/[^\s<>"\])}]*/gi)) {
      try {
        const raw = match[0].replace(/[.,;:!?]+$/, '');
        const url = new URL(/^https?:/i.test(raw) ? raw : `https://${raw}`);
        if (!['medicarefaq.com', 'www.medicarefaq.com'].includes(url.hostname) || url.port || url.username || url.password) continue;
        if (url.pathname.length > 1000) continue;
        if (!paths.includes(url.pathname)) paths.push(url.pathname);
      } catch { /* Invalid references are not queries. */ }
    }
    if (paths.length) return paths.slice(0, 3);
  }
  return [];
}

export function pageQuery(period, pathname) {
  if (typeof pathname !== 'string' || !pathname.startsWith('/') || pathname.length > 1000) throw new Error('Invalid page path.');
  const query = overviewQuery(period);
  // Treat the site's slash/no-slash variants as one page; exclude query strings.
  const base = pathname.replace(/\/$/, '');
  query.properties.push({ key: '$pathname', type: 'event', operator: 'exact', value: base ? [base, `${base}/`] : ['/'] });
  return query;
}
