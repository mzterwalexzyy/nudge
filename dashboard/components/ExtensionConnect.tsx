'use client';

import { useState } from 'react';

export default function ExtensionConnect({ disabled = false }: { disabled?: boolean }) {
  const [token, setToken] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function generate() {
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/profile/capture-token', { method: 'POST' });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.error || 'Could not create a connection token.');
      setToken(result.token);
    } catch (caught: any) {
      setError(caught.message);
    } finally {
      setBusy(false);
    }
  }

  if (disabled) return <p className="profile-muted">Extension pairing is unavailable in temporary Demo profiles.</p>;
  return (
    <div className="extension-connect">
      <button className="dashboard-save" type="button" onClick={generate} disabled={busy}>{busy ? 'Generating…' : token ? 'Rotate connection token' : 'Generate connection token'}</button>
      {token && (
        <div className="extension-token">
          <strong>Copy this token now</strong>
          <code>{token}</code>
          <button type="button" onClick={() => navigator.clipboard.writeText(token)}>Copy</button>
          <small>For security, NUDGE stores only its hash. Rotating invalidates the previous token.</small>
        </div>
      )}
      {error && <p className="auth-error" role="alert">{error}</p>}
    </div>
  );
}
