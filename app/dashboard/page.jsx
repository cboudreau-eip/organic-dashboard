import Dashboard from '../../components/dashboard/Dashboard';
import './dashboard.css';
import { requireUser } from '../../lib/auth/server';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Performance Command Center' };
export default async function DashboardPage() {
  const { user } = await requireUser();
  return <Dashboard userEmail={user.email} />;
}
