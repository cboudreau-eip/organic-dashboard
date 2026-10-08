'use client';

import { useEffect, useRef, useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';

// Also supports default Supabase invitation links that return tokens in a fragment.
export default function AuthCallback({ config }) {
  const started = useRef(false);
  const [error, setError] = useState('');
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    async function complete() {
      const hash = new URLSearchParams(window.location.hash.slice(1));
      const query = new URLSearchParams(window.location.search);
      window.history.replaceState(null, '', '/auth/callback');
      if (!config || hash.has('error') || query.has('error')) throw new Error('invalid link');
      const client = createBrowserClient(config.url, config.key, { auth: { detectSessionInUrl: false } });
      let result;
      if (query.has('code')) result = await client.auth.exchangeCodeForSession(query.get('code'));
      else if (hash.has('access_token') && hash.has('refresh_token')) result = await client.auth.setSession({ access_token: hash.get('access_token'), refresh_token: hash.get('refresh_token') });
      else throw new Error('missing credentials');
      if (result.error || !result.data.session) throw new Error('invalid session');
      window.location.replace('/update-password');
    }
    complete().catch(() => setError('This link is invalid or has expired. Request a new reset link, or ask your administrator for a new invitation.'));
  }, [config]);
  return error ? <><p role="alert" className="auth-error">{error}</p><a href="/forgot-password">Request a new reset link</a></> : <p role="status">Verifying your link…</p>;
}
