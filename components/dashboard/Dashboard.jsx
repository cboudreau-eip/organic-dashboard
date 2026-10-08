'use client';
import { useEffect, useRef } from 'react';
import { dashboardMarkup } from './markup';
import { initializeDashboard } from './runtime';

// React owns this boundary; the preserved demo renderer owns its descendants.
// Move individual views to React components as real data is connected.
export default function Dashboard() {
  const host = useRef(null);
  useEffect(() => {
    const root = host.current;
    root.innerHTML = dashboardMarkup;
    const dispose = initializeDashboard(root);
    return () => { dispose(); root.replaceChildren(); };
  }, []);
  return <div className="dashboard-page" ref={host}>
    <p role="status">Loading demo dashboard…</p>
    <noscript>Enable JavaScript to explore the interactive dashboard.</noscript>
  </div>;
}
