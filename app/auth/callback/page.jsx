import AuthShell from '../../../components/AuthShell';
import AuthCallback from '../../../components/AuthCallback';
import { authConfig } from '../../../lib/auth/config';

export const dynamic = 'force-dynamic';
export default function CallbackPage() {
  return <AuthShell title="Finish signing in" description="Securely connecting your account."><AuthCallback config={authConfig()} /></AuthShell>;
}
