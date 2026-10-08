import '../app/login.css';

export default function AuthShell({ title, description, children }) {
  return <main className="login-page auth-page"><section className="auth-card"><a className="brand" href="/"><span className="brand-icon" aria-hidden="true">↗</span>Organic Growth</a><h1>{title}</h1><p className="intro">{description}</p>{children}</section></main>;
}
