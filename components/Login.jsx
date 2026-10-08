'use client';
import { useEffect, useState } from 'react';
import AuthForm from './AuthForm';
export default function Login({ configured }) {
const [notice, setNotice] = useState('');
useEffect(() => {
  const hash = new URLSearchParams(window.location.hash.slice(1));
  const query = new URLSearchParams(window.location.search);
  if (hash.has('access_token') || hash.has('error') || query.has('code')) {
    window.location.replace('/auth/callback' + window.location.search + window.location.hash);
    return;
  }
  if (query.get('notice') === 'password-updated') setNotice('Your password is saved. Sign in with your new password.');
}, []);
return <div className="login-page">
<main className="login-layout">
<section className="story" aria-label="Organic Growth workspace">
<a className="brand" href="/"><span className="brand-icon" aria-hidden="true">↗</span><span>Organic Growth<small>PERFORMANCE CENTER</small></span></a>
<div className="story-content"><span className="eyebrow">A SHARED VIEW OF GROWTH</span><h1>Better insight.<br />Stronger decisions.</h1><p>Bring traffic, content, and lead performance into one place for your team.</p><div className="signal" aria-hidden="true"><span className="signal-label">FROM DISCOVERY TO IMPACT</span><div className="steps"><span>Discover</span><i></i><span>Understand</span><i></i><span>Act</span></div><svg viewBox="0 0 460 130" fill="none"><path d="M0 115H460M0 65H460M0 15H460" stroke="#365246"/><path d="M0 111C40 111 50 85 92 91S150 110 184 70S250 81 280 52S340 68 375 29S425 35 460 8" stroke="#c9e66d" strokeWidth="3"/></svg></div></div>
<footer>Marketing intelligence, built for your team.</footer>
</section>
<section className="signin" aria-labelledby="signin-title">
<div className="signin-card"><span className="workspace-tag">TEAM WORKSPACE</span><h2 id="signin-title">Welcome back</h2><p className="intro">Sign in with your work email and password to access Organic Growth.</p>
{notice && <p role="status">{notice}</p>}
<AuthForm configured={configured} />
<p className="account-note">Access is managed by your workspace administrator.</p>
</div><p className="help">Need access? Contact your workspace administrator.</p>
</section>
</main>
</div>;
}
