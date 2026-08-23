import { inbox, getParentTitle } from '@/lib/db';
import type { Item } from '@/lib/db';
import TopBar from '@/components/TopBar';
import AttentionRow from '@/components/AttentionRow';

export const dynamic = 'force-dynamic';

export default function InboxPage() {
  let items: Item[] = [];
  try { items = inbox(); } catch { /* empty */ }

  return (
    <>
      <TopBar title="Inbox" />
      <div className="feed-intro">
        <p>New captures, ranked in one calm feed instead of buried in folders.</p>
        <span>{items.length} item{items.length === 1 ? '' : 's'}</span>
      </div>

      <div className="panel">
        <div className="panel-body">
          {items.length === 0 ? (
            <div className="empty-state-compact">
              <strong>Your inbox is clear.</strong>
              <span>Bookmark a post on X or visit an agreement page to capture something.</span>
            </div>
          ) : (
            items.map((item) => (
              <AttentionRow key={item.id} item={item} parentTitle={getParentTitle(item.parent_id)} iconMode="source" />
            ))
          )}
        </div>
      </div>

      {items.length > 0 && (
        <p className="feed-end">That&rsquo;s everything. New captures appear here automatically.</p>
      )}
    </>
  );
}
