'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import { IconBell, IconPlus, IconUser } from '@/components/icons';

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
}

export default function DashboardHeader({
  name,
  notificationCount,
  accountType,
}: {
  name: string;
  notificationCount: number;
  accountType: 'user' | 'demo' | 'development';
}) {
  const [greeting, setGreeting] = useState('Welcome');
  const [saveOpen, setSaveOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [url, setUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const hour = new Date().getHours();
    setGreeting(hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening');
  }, []);

  async function save(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setMessage('');
    try {
      const response = await fetch('/api/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.error || 'Could not save this URL.');
      setMessage(result.deduplicated ? 'Already saved.' : 'Saved and queued for intelligence.');
      setUrl('');
    } catch (error: any) {
      setMessage(error.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <header className="dashboard-header">
        <div className="dashboard-greeting">
          <h1>{greeting}, {name} <span aria-hidden="true">👋</span></h1>
          <p>Here&apos;s what matters most right now.</p>
        </div>
        <div className="dashboard-actions">
          <button className="dashboard-save" type="button" onClick={() => setSaveOpen(true)}>
            <IconPlus size={17} /> Save
          </button>
          <Link className="dashboard-icon-button" href="/needs-attention" aria-label={`${notificationCount} items need attention`}>
            <IconBell size={18} />
            {notificationCount > 0 && <span>{Math.min(notificationCount, 99)}</span>}
          </Link>
          <div className="profile-menu-wrap">
            <button className="dashboard-avatar" type="button" onClick={() => setProfileOpen((value) => !value)} aria-expanded={profileOpen} aria-label="Open profile menu">
              {initials(name) || <IconUser size={17} />}
            </button>
            {profileOpen && (
              <div className="profile-menu">
                <strong>{name}</strong>
                <small>{accountType === 'demo' ? 'Temporary demo profile' : accountType === 'development' ? 'Development profile' : 'NUDGE account'}</small>
                <Link href="/profile" onClick={() => setProfileOpen(false)}>Profile settings</Link>
                <form action="/api/auth/logout" method="post"><button type="submit">Sign out</button></form>
              </div>
            )}
          </div>
        </div>
      </header>

      {saveOpen && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSaveOpen(false); }}>
          <section className="save-modal" role="dialog" aria-modal="true" aria-labelledby="save-title">
            <button className="modal-close" type="button" onClick={() => setSaveOpen(false)} aria-label="Close">×</button>
            <span className="save-modal-icon"><IconPlus size={18} /></span>
            <h2 id="save-title">Save a link</h2>
            <p>Paste a public URL. NUDGE will organize it and extract useful intelligence.</p>
            <form onSubmit={save}>
              <label htmlFor="save-url">URL</label>
              <input id="save-url" type="url" value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://…" required autoFocus />
              <button className="dashboard-save" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save to NUDGE'}</button>
            </form>
            {message && <div className="save-message" role="status">{message}</div>}
          </section>
        </div>
      )}
    </>
  );
}
