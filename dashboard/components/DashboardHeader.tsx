'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { FormEvent, useEffect, useRef, useState } from 'react';
import { IconBell, IconPlus, IconUser } from '@/components/icons';

export type HeaderNotification = {
  id: string;
  title: string | null;
  url: string;
  kind: string | null;
  source: string;
  timeLabel: string;
};

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
}

function notificationType(notification: HeaderNotification) {
  return notification.kind === 'agreement' || notification.source === 'agreement'
    ? 'Agreement ready to review'
    : 'Bookmark captured';
}

export default function DashboardHeader({
  name,
  notifications,
  accountType,
}: {
  name: string;
  notifications: HeaderNotification[];
  accountType: 'user' | 'demo' | 'development';
}) {
  const pathname = usePathname();
  const router = useRouter();
  const notificationWrap = useRef<HTMLDivElement>(null);
  const notificationButton = useRef<HTMLButtonElement>(null);
  const [greeting, setGreeting] = useState('Welcome');
  const [saveOpen, setSaveOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [url, setUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const isOverview = pathname === '/overview';

  useEffect(() => {
    const hour = new Date().getHours();
    setGreeting(hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening');
  }, []);

  useEffect(() => {
    if (!notificationsOpen) return;
    function closeOnOutsidePress(event: PointerEvent) {
      if (!notificationWrap.current?.contains(event.target as Node)) setNotificationsOpen(false);
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setNotificationsOpen(false);
        notificationButton.current?.focus();
      }
    }
    document.addEventListener('pointerdown', closeOnOutsidePress);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsidePress);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [notificationsOpen]);

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
        {isOverview ? (
          <div className="dashboard-greeting">
            <h1>{greeting}, {name} <span aria-hidden="true">👋</span></h1>
            <p>Here&apos;s what matters most right now.</p>
          </div>
        ) : (
          <div className="dashboard-header-spacer" aria-hidden="true" />
        )}
        <div className="dashboard-actions">
          <button className="dashboard-save" type="button" onClick={() => { setSaveOpen(true); setNotificationsOpen(false); setProfileOpen(false); }}>
            <IconPlus size={17} /> Save
          </button>
          <div className="notification-menu-wrap" ref={notificationWrap}>
            <button
              className="dashboard-icon-button"
              type="button"
              ref={notificationButton}
              onClick={() => {
                const opening = !notificationsOpen;
                setNotificationsOpen(opening);
                setProfileOpen(false);
                if (opening) router.refresh();
              }}
              aria-label={`${notifications.length} recent notifications`}
              aria-expanded={notificationsOpen}
              aria-controls="notification-menu"
            >
              <IconBell size={18} />
              {notifications.length > 0 && <span>{notifications.length}</span>}
            </button>
            {notificationsOpen && (
              <section className="notification-menu" id="notification-menu" aria-label="Recent notifications">
                <div className="notification-menu-head">
                  <div><strong>Notifications</strong><small>Recent captures and reviews</small></div>
                  <span>{notifications.length}</span>
                </div>
                <div className="notification-menu-list">
                  {notifications.length === 0 ? (
                    <div className="notification-empty">New bookmarks and agreement reviews will appear here.</div>
                  ) : notifications.map((notification) => (
                    <Link
                      key={notification.id}
                      href={`/items/${notification.id}`}
                      className="notification-item"
                      onClick={() => setNotificationsOpen(false)}
                    >
                      <span className={`notification-dot ${notification.kind === 'agreement' ? 'agreement' : 'bookmark'}`} aria-hidden="true" />
                      <span className="notification-copy">
                        <strong>{notification.title || notification.url}</strong>
                        <small>{notificationType(notification)}{notification.timeLabel ? ` · ${notification.timeLabel}` : ''}</small>
                      </span>
                    </Link>
                  ))}
                </div>
                <Link className="notification-view-all" href="/inbox" onClick={() => setNotificationsOpen(false)}>View all in Inbox</Link>
              </section>
            )}
          </div>
          <div className="profile-menu-wrap">
            <button className="dashboard-avatar" type="button" onClick={() => { setProfileOpen((value) => !value); setNotificationsOpen(false); }} aria-expanded={profileOpen} aria-label="Open profile menu">
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
