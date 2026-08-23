import Link from 'next/link';
import AuthForm from '@/components/AuthForm';
import { IconLogo } from '@/components/icons';

export const metadata = { title: 'Sign in — NUDGE' };

export default function LoginPage() {
  return (
    <main className="auth-page">
      <Link className="auth-brand" href="/"><IconLogo size={20} /> NUDGE</Link>
      <section className="auth-card">
        <span className="auth-eyebrow">Welcome back</span>
        <h1>Sign in to NUDGE</h1>
        <p>Your saved intelligence is waiting.</p>
        <AuthForm mode="login" />
      </section>
    </main>
  );
}
