import { test } from 'node:test';
import assert from 'node:assert/strict';
import { authConfig, isTeamUser, passwordError, validEmail } from '../lib/auth/config.js';

test('auth configuration fails closed and never exposes privileged keys', () => {
  const url = 'https://example.supabase.co';
  assert.equal(authConfig({}), null);
  assert.equal(authConfig({ SUPABASE_URL: url, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_secret_not_public' }), null);
  const jwt = role => 'header.' + Buffer.from(JSON.stringify({role})).toString('base64url') + '.signature';
  assert.equal(authConfig({ SUPABASE_URL: url, SUPABASE_ANON_KEY: jwt('service_role') }), null);
  assert.equal(authConfig({ SUPABASE_URL: 'http://external.test', SUPABASE_ANON_KEY: jwt('anon') }), null);
  assert.deepEqual(authConfig({ SUPABASE_URL: url, SUPABASE_ANON_KEY: jwt('anon') }), {url, key: jwt('anon')});
  assert.equal(authConfig({ SUPABASE_URL: url, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_example' }).url, url);
});

test('only verified, nonanonymous email users can enter the dashboard', () => {
  const user = {id:'user',email:'team@example.com',email_confirmed_at:'2026-10-08',is_anonymous:false};
  assert.equal(isTeamUser(user), true);
  for (const invalid of [null, {}, {...user,is_anonymous:true}, {...user,email_confirmed_at:null}, {...user,email:null}]) assert.equal(isTeamUser(invalid),false);
});

test('password setup requires length and exact confirmation; email is bounded', () => {
  assert.equal(passwordError('twelve chars!', 'twelve chars!'), null);
  assert.ok(passwordError('short', 'short'));
  assert.ok(passwordError('twelve chars!', 'different'));
  assert.ok(passwordError('a'.repeat(129), 'a'.repeat(129)));
  assert.equal(validEmail('team@example.com'), true);
  for (const invalid of ['',null,'not-an-email','a @example.com','a'.repeat(260)+'@example.com']) assert.equal(validEmail(invalid),false);
});
