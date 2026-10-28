// Match the source closing ratio: policies divided by EIP leads, not all leads.
export function policyConversions(metrics) {
  const build = (keys, previous) => {
    const metric = key => {
      const value = metrics.find(m => m.key === key);
      return previous ? value.previous : value;
    };
    const leads = metric('eipLeads');
    const policies = keys.map(metric);
    const complete = [leads, ...policies].every(m => m.missingDays === 0 && m.total !== null);
    const count = policies.every(m => m.total !== null) ? policies.reduce((sum, m) => sum + m.total, 0) : null;
    return { leads: leads.total, policies: count, complete,
      rate: complete && leads.total > 0 ? count / leads.total * 100 : null,
      status: !complete ? 'Incomplete data' : leads.total === 0 ? 'No EIP leads' : 'Complete' };
  };
  return [
    ['gross', 'Gross', 'grossMS', 'grossMA'],
    ['approved', 'Approved', 'approvedMS', 'approvedMA'],
  ].flatMap(([status, label, ms, ma]) => [
    ['all', 'All Medicare (MS + MA)', [ms, ma]],
    ['ms', 'Medicare Supplement', [ms]],
    ['ma', 'Medicare Advantage', [ma]],
  ].map(([type, coverage, keys]) => {
    const current = build(keys, false), previous = build(keys, true);
    return { key: `${status}-${type}`, label: `${label} · ${coverage}`, current, previous,
      change: current.rate !== null && previous.rate !== null ? current.rate - previous.rate : null };
  }));
}
