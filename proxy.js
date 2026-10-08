import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';
import { authConfig } from './lib/auth/config';

export async function proxy(request) {
  let response = NextResponse.next({ request });
  const config = authConfig();
  if (config) {
    const client = createServerClient(config.url, config.key, {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(values, headers) {
          values.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          values.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
          Object.entries(headers || {}).forEach(([name, value]) => response.headers.set(name, value));
        },
      },
    });
    // Refresh before Server Components render. Authorization is checked there too.
    await client.auth.getUser();
  }
  response.headers.set('Cache-Control', 'private, no-store');
  response.headers.set('Referrer-Policy', 'no-referrer');
  return response;
}

export const config = { matcher: ['/', '/dashboard/:path*', '/forgot-password', '/update-password', '/auth/:path*'] };
