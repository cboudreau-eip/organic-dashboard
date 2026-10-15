export function pageFilters(page) {
  if (typeof page !== 'string' || !page.startsWith('/') || page.length > 1000) throw new Error('Invalid page path');
  const base = page.replace(/\/$/, '');
  const escaped = base.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return [{ dimension: 'page', operator: 'includingRegex', expression: `^https://www\\.medicarefaq\\.com${escaped}/?([?].*)?$` }];
}
