import {validDate} from './periods.js';

export function followUpMonths(month, dataThrough) {
  if (!validDate(`${month}-01`) || !validDate(dataThrough)) throw new Error('Invalid cohort dates');
  const [year, number] = month.split('-').map(Number);
  return Array.from({length: 4}, (_, i) => {
    const end = new Date(Date.UTC(year, number + i + 1, 0)).toISOString().slice(0, 10);
    return {number: i + 1, month: end.slice(0, 7), end,
      status: end > dataThrough ? 'Not yet due in this import' : 'Historical checkpoint unavailable'};
  });
}

export function cohortMetrics(cohort) {
  const find = key => cohort.metrics.find(metric => metric.key === key);
  const count = (label, keys) => {
    const metrics = keys.map(find);
    const total = metrics.every(m => m && m.total !== null) ? metrics.reduce((sum, m) => sum + m.total, 0) : null;
    return {label, total, incomplete: cohort.partial || metrics.some(m => !m || m.missingDays > 0), unavailable: false};
  };
  return [count('EIP leads', ['eipLeads']), count('Gross policies · MS + MA', ['grossMS', 'grossMA']),
    count('Approved policies · MS + MA', ['approvedMS', 'approvedMA']),
    {...count('Salesforce opportunities', ['opportunities']), unavailable: !find('opportunities')},
    ...['Actual revenue', 'First-year policy value', 'Policy persistency'].map(label => ({label, total: null, unavailable: true}))];
}
