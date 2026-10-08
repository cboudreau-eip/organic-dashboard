'use client';

import { useActionState } from 'react';
import { login, resetPassword, updatePassword } from '../app/auth/actions';

const actions = { login, reset: resetPassword, update: updatePassword };
export default function AuthForm({ mode = 'login', configured = true }) {
  const [state, action, pending] = useActionState(actions[mode], {});
  return <form action={action} className="auth-form">
    {mode !== 'update' && <label>Email address<input name="email" type="email" autoComplete="username" required maxLength={254} /></label>}
    {mode !== 'reset' && <label>{mode === 'update' ? 'New password' : 'Password'}<input name="password" type="password" autoComplete={mode === 'update' ? 'new-password' : 'current-password'} required minLength={mode === 'update' ? 12 : undefined} maxLength={128} /></label>}
    {mode === 'update' && <><label>Confirm new password<input name="confirmation" type="password" autoComplete="new-password" required minLength={12} maxLength={128} /></label><small>Use 12–128 characters.</small></>}
    <div aria-live="polite">{state.error && <p className="auth-error" role="alert">{state.error}</p>}{state.message && <p role="status">{state.message}</p>}{!configured && <p className="auth-error">Sign-in is being configured. Please contact your administrator.</p>}</div>
    <button className="auth-submit" disabled={pending || !configured}>{pending ? 'Please wait…' : mode === 'login' ? 'Sign in' : mode === 'reset' ? 'Send reset link' : 'Save password'}</button>
    <a className="auth-link" href={mode === 'login' ? '/forgot-password' : '/'}>{mode === 'login' ? 'Forgot your password?' : 'Back to sign in'}</a>
  </form>;
}
