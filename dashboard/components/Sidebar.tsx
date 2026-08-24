'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { IconLogo, IconTarget, IconInbox, IconFolder, IconMop, IconShield, IconUser, IconExternal } from '@/components/icons';

const NAV = [
  { href: '/overview', label: 'Overview', Icon: IconTarget },
  { href: '/inbox', label: 'Inbox', Icon: IconInbox },
  { href: '/organized', label: 'Organized', Icon: IconFolder },
  { href: '/sanitize', label: 'Sanitize', Icon: IconMop },
  { href: '/agreements', label: 'Agreements', Icon: IconShield },
];

type ExtensionState = 'connected' | 'stale' | 'ready' | 'unavailable';

const EXTENSION_COPY: Record<ExtensionState, string> = {
  connected: 'Connected recently',
  stale: 'Reconnect extension',
  ready: 'Ready to connect',
  unavailable: 'Unavailable in demo',
};

export default function Sidebar({
  name,
  extensionState,
}: {
  name: string;
  extensionState: ExtensionState;
}) {
  const path = usePathname();
  const extensionActive = extensionState === 'connected';

  return (
    <aside className="sidebar-shell">
      <nav className="sidebar" aria-label="NUDGE sections">
        <Link href="/" className="brand" aria-label="NUDGE landing page">
          <IconLogo /> <span>NUDGE</span>
        </Link>
        <div className="sidebar-links">
          {NAV.map(({ href, label, Icon }) => {
            const active = path === href || (href === '/organized' && path.startsWith('/organized'));
            return (
              <Link key={href} href={href} className={`nav-link ${active ? 'active' : ''}`} aria-current={active ? 'page' : undefined}>
                <Icon /> <span>{label}</span>
              </Link>
            );
          })}
        </div>
        <div className="sidebar-footer">
          <Link href="/profile" className={`sidebar-profile-link ${path === '/profile' ? 'active' : ''}`}>
            <IconUser size={17} />
            <span>Profile</span>
          </Link>
          <Link href="/profile#extension" className={`ext-status ${extensionActive ? 'connected' : extensionState}`}>
            <span className={`ext-dot ${extensionActive ? 'active' : ''}`} aria-hidden="true" />
            <div>
              <div className="ext-status-title">Browser extension</div>
              <div className="ext-status-copy">{EXTENSION_COPY[extensionState]}</div>
            </div>
            <IconExternal size={14} />
          </Link>
          <div className="sidebar-user-caption" title={name}>{name}</div>
        </div>
      </nav>
    </aside>
  );
}
