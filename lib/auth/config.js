// Only publishable/anon keys may leave the server. Never use a service-role key.
export function authConfig(env = process.env) {
  const url = env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL;
  const key = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(parsed.hostname)) return null;
    if (!key.startsWith('sb_publishable_')) {
      const payload = JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString());
      if (payload.role !== 'anon') return null;
    }
    return { url: parsed.origin, key };
  } catch { return null; }
}

export function siteUrl() {
  return process.env.SITE_URL || 'https://organic-dashboard-psi.vercel.app';
}

export function isTeamUser(user) {
  return Boolean(user?.id && user.email && user.email_confirmed_at && !user.is_anonymous);
}

export function validEmail(value) {
  return typeof value === 'string' && value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function passwordError(password, confirmation) {
  if (typeof password !== 'string' || password.length < 12 || password.length > 128) return 'Use a password between 12 and 128 characters.';
  if (password !== confirmation) return 'The passwords do not match.';
  return null;
}
