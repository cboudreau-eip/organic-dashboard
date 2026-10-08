import AuthShell from '../../components/AuthShell';
import AuthForm from '../../components/AuthForm';
import { authConfig } from '../../lib/auth/config';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Reset password' };
export default function ForgotPasswordPage() {
  return <AuthShell title="Reset your password" description="Enter your work email and we’ll send you a password reset link."><AuthForm mode="reset" configured={Boolean(authConfig())} /></AuthShell>;
}
