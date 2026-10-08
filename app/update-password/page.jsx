import AuthShell from '../../components/AuthShell';
import AuthForm from '../../components/AuthForm';
import { requireUser } from '../../lib/auth/server';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Set your password' };
export default async function UpdatePasswordPage() {
  await requireUser();
  return <AuthShell title="Set your password" description="Choose a password for your Organic Growth account. Then sign in with your email and new password."><AuthForm mode="update" /></AuthShell>;
}
