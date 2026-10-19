import Dashboard from '../../components/dashboard/Dashboard';
import './dashboard.css';
import { requireUser } from '../../lib/auth/server';
import { growthEnabled, authorizeGrowth } from '../../lib/growth-hunter/access';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Performance Command Center' };
export default async function DashboardPage() {
  const { user, client } = await requireUser();
  let growthAllowed = false;
  if (growthEnabled()) {
    try { await authorizeGrowth(client, true); growthAllowed = true; }
    catch { /* Optional module fails closed without breaking the dashboard. */ }
  }
  return <Dashboard userEmail={user.email} userId={user.id} growthAllowed={growthAllowed} />;
}
