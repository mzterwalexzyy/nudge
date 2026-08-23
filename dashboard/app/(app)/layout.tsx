import { redirect } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import DashboardHeader from '@/components/DashboardHeader';
import { needsAttention } from '@/lib/db';
import { currentUser } from '@/lib/users';

export const dynamic = 'force-dynamic';

function extensionState(accountType: 'user' | 'demo' | 'development', lastSeen: string | null) {
  if (accountType === 'demo') return 'unavailable' as const;
  if (!lastSeen) return 'ready' as const;
  const normalized = lastSeen.includes('T') ? lastSeen : `${lastSeen.replace(' ', 'T')}Z`;
  const lastSeenAt = Date.parse(normalized);
  const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
  return Number.isFinite(lastSeenAt) && lastSeenAt >= sevenDaysAgo ? 'connected' as const : 'stale' as const;
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const user = currentUser();
  if (!user) redirect('/login');
  const notificationCount = needsAttention().length;

  return (
    <div className="layout production-shell">
      <Sidebar
        name={user.display_name}
        extensionState={extensionState(user.account_type, user.extension_last_seen_at)}
      />
      <main className="main">
        <DashboardHeader
          name={user.display_name}
          notificationCount={notificationCount}
          accountType={user.account_type}
        />
        <div className="page-stage">{children}</div>
      </main>
    </div>
  );
}
