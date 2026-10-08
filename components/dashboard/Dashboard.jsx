'use client';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { signOut } from '../../app/auth/actions';
import { dashboardMarkup } from './markup';
import { initializeDashboard } from './runtime';

// React owns this boundary; the preserved demo renderer owns its descendants.
export default function Dashboard({ userEmail }) {
  const host = useRef(null);
  const [accountHost, setAccountHost] = useState(null);
  useEffect(() => {
    const root = host.current;
    root.innerHTML = dashboardMarkup;
    setAccountHost(root.querySelector('#account-controls'));
    const dispose = initializeDashboard(root);
    return () => { dispose(); root.replaceChildren(); };
  }, []);
  return <><div className="dashboard-page" ref={host}>
    <p role="status">Loading dashboard…</p>
    <noscript>Enable JavaScript to explore the interactive dashboard.</noscript>
  </div>{accountHost && createPortal(<form action={signOut} className="account-form"><span className="account-email" title={userEmail}>{userEmail}</span><button type="submit" className="button">Sign out</button></form>, accountHost)}</>;
}
