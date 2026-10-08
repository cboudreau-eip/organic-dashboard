import Login from '../components/Login';
import './login.css';
import { authConfig } from '../lib/auth/config';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Sign in' };
export default function HomePage() { return <Login configured={Boolean(authConfig())} />; }
