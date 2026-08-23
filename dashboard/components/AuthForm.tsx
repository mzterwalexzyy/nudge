'use client';

import Link from 'next/link';
import { FormEvent, useState } from 'react';

export default function AuthForm({ mode }: { mode: 'signup' | 'login' }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    const form = new FormData(event.currentTarget);
    const body = mode === 'signup'
      ? { displayName: form.get('displayName'), email: form.get('email'), password: form.get('password') }
      : { email: form.get('email'), password: form.get('password') };
    try {
      const response = await fetch(`/api/auth/${mode === 'signup' ? 'register' : 'login'}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.error || 'Please try again.');
      window.location.assign(result.redirect || '/needs-attention');
    } catch (caught: any) {
      setError(caught.message);
      setBusy(false);
    }
  }

  return (
    <form className="auth-form" onSubmit={submit}>
      {mode === 'signup' && (
        <label>Display name<input name="displayName" autoComplete="name" minLength={2} maxLength={50} required /></label>
      )}
      <label>Email<input name="email" type="email" autoComplete="email" maxLength={254} required /></label>
      <label>Password<input name="password" type="password" autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} minLength={10} maxLength={128} required /></label>
      <button className="auth-submit" type="submit" disabled={busy}>{busy ? 'Please wait…' : mode === 'signup' ? 'Create account' : 'Sign in'}</button>
      {error && <p className="auth-error" role="alert">{error}</p>}
      <p className="auth-switch">
        {mode === 'signup' ? 'Already have an account? ' : 'New to NUDGE? '}
        <Link href={mode === 'signup' ? '/login' : '/signup'}>{mode === 'signup' ? 'Sign in' : 'Create an account'}</Link>
      </p>
    </form>
  );
}
