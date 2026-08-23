import Link from 'next/link';
import AuthForm from '@/components/AuthForm';
import { IconLogo } from '@/components/icons';

export const metadata = { title: 'Get started — NUDGE' };

export default function SignupPage() {
  return (
    <main className="auth-page">
      <Link className="auth-brand" href="/"><IconLogo size={20} /> NUDGE</Link>
      <section className="auth-card">
        <span className="auth-eyebrow">Start building your memory</span>
        <h1>Create your NUDGE account</h1>
        <p>Save what matters, keep the intelligence, and organize it your way.</p>
        <AuthForm mode="signup" />
      </section>
    </main>
  );
}
