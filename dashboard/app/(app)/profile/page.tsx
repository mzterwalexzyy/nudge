import { notFound } from 'next/navigation';
import TopBar from '@/components/TopBar';
import ExtensionConnect from '@/components/ExtensionConnect';
import { currentUser } from '@/lib/users';

export const dynamic = 'force-dynamic';

export default function ProfilePage() {
  const user = currentUser();
  if (!user) notFound();
  return (
    <>
      <TopBar title="Profile" subtitle="Your account, browser companion, and session details." />
      <div className="profile-grid">
        <section className="profile-card">
          <span className="profile-avatar-large">{user.display_name.slice(0, 2).toUpperCase()}</span>
          <div><h2>{user.display_name}</h2><p>{user.email || 'Temporary demo profile'}</p></div>
          <span className="profile-type">{user.account_type}</span>
        </section>
        <section className="profile-card profile-card-stack" id="extension">
          <div><h2>Browser extension</h2><p>{user.extension_last_seen_at ? `Last connected ${user.extension_last_seen_at}` : 'Connect the NUDGE extension to save directly from supported pages.'}</p></div>
          <ExtensionConnect disabled={user.account_type === 'demo'} />
        </section>
        {user.account_type === 'demo' && (
          <section className="profile-card profile-card-stack"><div><h2>Temporary Demo</h2><p>This isolated profile expires automatically. Changes never affect another judge or registered user.</p></div></section>
        )}
        <form action="/api/auth/logout" method="post"><button className="btn btn-secondary" type="submit">Sign out</button></form>
      </div>
    </>
  );
}
