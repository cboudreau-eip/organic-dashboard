import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { authConfig, isTeamUser } from './config';

export async function serverAuth() {
  const config = authConfig();
  if (!config) return null;
  const store = await cookies();
  return createServerClient(config.url, config.key, {
    cookies: {
      getAll: () => store.getAll(),
      setAll(values) {
        try { values.forEach(({ name, value, options }) => store.set(name, value, options)); }
        catch { /* Server Components cannot write cookies; proxy refreshes them. */ }
      },
    },
  });
}

// Reuse this check in every future private API/data action, not just the page.
export async function requireUser() {
  const client = await serverAuth();
  if (!client) redirect('/?notice=setup');
  const { data, error } = await client.auth.getUser();
  if (error || !isTeamUser(data.user)) redirect('/');
  return { client, user: data.user };
}
