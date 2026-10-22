'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { signOut } from '../../app/auth/actions';
import { dashboardMarkup } from './markup';
import { initializeDashboard } from './runtime';
import OrganicOverview from './OrganicOverview';
import OrganicConversions from './OrganicConversions';
import SearchPerformance from './SearchPerformance';
import TrackedKeywords from './TrackedKeywords';
import DatoramaSnapshot from './DatoramaSnapshot';
import DatoramaPeriods from './DatoramaPeriods';
import CharlieLaunch from './CharlieLaunch';
import GrowthHunter from '../growth-hunter/GrowthHunter';
import '../growth-hunter/growth-hunter.css';

// React owns this boundary; the preserved demo renderer owns its descendants.
export default function Dashboard({ userEmail, userId, growthAllowed = false }) {
  const host = useRef(null);
  const [launching, setLaunching] = useState(true);
  const finishLaunch = useCallback(() => setLaunching(false), []);
  const [accountHost, setAccountHost] = useState(null);
  const [analyticsHost, setAnalyticsHost] = useState(null);
  const [leadsHost, setLeadsHost] = useState(null);
  const [searchHost, setSearchHost] = useState(null);
  const [days, setDays] = useState(7);
  const [growthHost, setGrowthHost] = useState(null);
  const [growthActive, setGrowthActive] = useState(false);
  useEffect(() => {
    const root = host.current;
    root.innerHTML = dashboardMarkup;
    setAccountHost(root.querySelector('#account-controls'));
    setAnalyticsHost(root.querySelector('#organic-live-host'));
    setLeadsHost(root.querySelector('#organic-leads-host'));
    setSearchHost(root.querySelector('#gsc-live-host'));
    if (growthAllowed) {
      const node = document.createElement('div'); node.id = 'growth-hunter-host'; node.hidden = true;
      root.querySelector('#app').before(node); setGrowthHost(node);
    } else setGrowthHost(null);
    const visibility = event => setGrowthActive(event.detail);
    root.addEventListener('growth-visibility', visibility);
    const dispose = initializeDashboard(root, userId, { growthAllowed });
    return () => { root.removeEventListener('growth-visibility', visibility); dispose(); root.replaceChildren(); };
  }, [userId, growthAllowed]);
  return <>{growthHost && createPortal(<GrowthHunter active={growthActive} />, growthHost)}{launching && <CharlieLaunch onComplete={finishLaunch} />}<div className="dashboard-page" ref={host} inert={launching} aria-hidden={launching || undefined}>
    <p role="status">Loading dashboard…</p>
    <noscript>Enable JavaScript to explore the interactive dashboard.</noscript>
  </div>{searchHost && createPortal(<><SearchPerformance />{growthAllowed && <TrackedKeywords />}</>, searchHost)}{analyticsHost && createPortal(<OrganicOverview days={days} setDays={setDays} />, analyticsHost)}{leadsHost && createPortal(<section className="organic-live"><DatoramaPeriods /><details className="organic-definitions"><summary>Archived July–September 2026 landing-page report</summary><DatoramaSnapshot /></details><div className="organic-heading"><span className="organic-badge">POSTHOG · ORGANIC SEARCH</span><label>Conversion reporting period<select value={days} onChange={e => setDays(Number(e.target.value))}><option value={7}>Last 7 complete days</option><option value={28}>Last 28 complete days</option><option value={30}>Last 30 complete days</option></select></label></div><OrganicConversions key={days} days={days} detailed /></section>, leadsHost)}{accountHost && createPortal(<form action={signOut} className="account-form"><span className="account-email" title={userEmail}>{userEmail}</span><button type="submit" className="button">Sign out</button></form>, accountHost)}</>;
}
