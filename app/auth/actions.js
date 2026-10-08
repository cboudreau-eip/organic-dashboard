'use server';

import { redirect } from 'next/navigation';
import { serverAuth, requireUser } from '../../lib/auth/server';
import { isTeamUser, validEmail, passwordError, siteUrl } from '../../lib/auth/config';

const unavailable = { error: 'Sign-in is not available yet. Please contact your workspace administrator.' };

export async function login(_previous, form) {
  const email = String(form.get('email') || '').trim();
  const password = form.get('password');
  if (!validEmail(email) || typeof password !== 'string' || !password || password.length > 128) return { error: 'Enter your email address and password.' };
  const client = await serverAuth();
  if (!client) return unavailable;
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error || !isTeamUser(data.user)) {
    if (data.session) await client.auth.signOut({ scope: 'local' });
    return { error: 'Unable to sign in. Check your email and password, or contact your administrator for access.' };
  }
  redirect('/dashboard');
}

export async function resetPassword(_previous, form) {
  const email = String(form.get('email') || '').trim();
  if (!validEmail(email)) return { error: 'Enter a valid email address.' };
  const client = await serverAuth();
  if (!client) return unavailable;
  const { error } = await client.auth.resetPasswordForEmail(email, { redirectTo: new URL('/auth/callback', siteUrl()).href });
  // Do not reveal account existence or provider-specific email delivery errors.
  if (error) return { error: 'We could not send a reset link. Please try again later or contact your administrator.' };
  return { message: 'If this email has an account, a reset link will arrive shortly. Open it in this browser.' };
}

export async function updatePassword(_previous, form) {
  const error = passwordError(form.get('password'), form.get('confirmation'));
  if (error) return { error };
  const { client } = await requireUser();
  const result = await client.auth.updateUser({ password: form.get('password') });
  if (result.error) return { error: 'Could not update your password. Use a different password or request a fresh reset link.' };
  await client.auth.signOut({ scope: 'local' });
  redirect('/?notice=password-updated');
}

export async function signOut() {
  const client = await serverAuth();
  if (client) await client.auth.signOut({ scope: 'local' });
  redirect('/');
}
