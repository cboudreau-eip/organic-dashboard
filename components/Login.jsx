'use client';
import { useState } from 'react';
export default function Login() {
const [message, setMessage] = useState(false);
return <div className="login-page">
<main className="login-layout">
<section className="story" aria-label="Organic Growth workspace">
<a className="brand" href="/"><span className="brand-icon" aria-hidden="true">↗</span><span>Organic Growth<small>PERFORMANCE CENTER</small></span></a>
<div className="story-content"><span className="eyebrow">A SHARED VIEW OF GROWTH</span><h1>Better insight.<br />Stronger decisions.</h1><p>Bring traffic, content, and lead performance into one place for your team.</p><div className="signal" aria-hidden="true"><span className="signal-label">FROM DISCOVERY TO IMPACT</span><div className="steps"><span>Discover</span><i></i><span>Understand</span><i></i><span>Act</span></div><svg viewBox="0 0 460 130" fill="none"><path d="M0 115H460M0 65H460M0 15H460" stroke="#365246"/><path d="M0 111C40 111 50 85 92 91S150 110 184 70S250 81 280 52S340 68 375 29S425 35 460 8" stroke="#c9e66d" strokeWidth="3"/></svg></div></div>
<footer>Marketing intelligence, built for your team.</footer>
</section>
<section className="signin" aria-labelledby="signin-title">
<div className="signin-card"><span className="workspace-tag">TEAM WORKSPACE</span><h2 id="signin-title">Welcome back</h2><p className="intro">Use your Microsoft 365 work account to access Organic Growth.</p>
<button onClick={() => setMessage(true)} id="microsoft-signin" type="button" aria-describedby="setup-note"><svg width="20" height="20" viewBox="0 0 21 21" aria-hidden="true"><path fill="#f25022" d="M0 0h10v10H0z"/><path fill="#7fba00" d="M11 0h10v10H11z"/><path fill="#00a4ef" d="M0 11h10v10H0z"/><path fill="#ffb900" d="M11 11h10v10H11z"/></svg>Sign in with Microsoft</button>
<p className="account-note">For your organization's approved team members.</p>
<div className="setup-note" id="setup-note"><strong>Microsoft sign-in is being set up</strong><p>This preview does not authenticate users yet. Explore the demo while your workspace is being connected.</p></div>
<p id="login-status" role="status" aria-live="polite" hidden={!message}>{message ? "Microsoft sign-in is not connected yet. Authentication will be configured separately; use the demo link to explore sample data." : ""}</p>
<div className="demo"><span>Take a look around</span><a href="/dashboard">Explore the demo dashboard <span aria-hidden="true">→</span></a><small>Sample data · No sign-in required</small></div>
</div><p className="help">Need access? Contact your workspace administrator.</p>
</section>
</main>
</div>;
}
