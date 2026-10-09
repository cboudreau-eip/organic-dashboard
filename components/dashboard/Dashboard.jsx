'use client';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { signOut } from '../../app/auth/actions';
import { dashboardMarkup } from './markup';
import { initializeDashboard } from './runtime';
import OrganicOverview from './OrganicOverview';
import OrganicConversions from './OrganicConversions';

// React owns this boundary; the preserved demo renderer owns its descendants.
export default function Dashboard({ userEmail }) {
  const host = useRef(null);
  const [accountHost, setAccountHost] = useState(null);
  const [analyticsHost, setAnalyticsHost] = useState(null);
  const [leadsHost, setLeadsHost] = useState(null);
  const [days, setDays] = useState(7);
  useEffect(() => {
    const root = host.current;
    root.innerHTML = dashboardMarkup;
    setAccountHost(root.querySelector('#account-controls'));
    setAnalyticsHost(root.querySelector('#organic-live-host'));
    setLeadsHost(root.querySelector('#organic-leads-host'));
    const dispose = initializeDashboard(root);
    return () => { dispose(); root.replaceChildren(); };
  }, []);
  return <><div className="dashboard-page" ref={host}>
    <p role="status">Loading dashboard…</p>
    <noscript>Enable JavaScript to explore the interactive dashboard.</noscript>
  </div>{analyticsHost && createPortal(<OrganicOverview days={days} setDays={setDays} />, analyticsHost)}{leadsHost && createPortal(<section className="organic-live"><div className="organic-heading"><span className="organic-badge">POSTHOG · ORGANIC SEARCH</span><label>Conversion reporting period<select value={days} onChange={e => setDays(Number(e.target.value))}><option value={7}>Last 7 complete days</option><option value={28}>Last 28 complete days</option><option value={30}>Last 30 complete days</option></select></label></div><OrganicConversions key={days} days={days} detailed /></section>, leadsHost)}{accountHost && createPortal(<form action={signOut} className="account-form"><span className="account-email" title={userEmail}>{userEmail}</span><button type="submit" className="button">Sign out</button></form>, accountHost)}</>;
}
