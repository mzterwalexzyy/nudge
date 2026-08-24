import { inboxPage, getParentTitle } from '@/lib/db';
import type { Item } from '@/lib/db';
import TopBar from '@/components/TopBar';
import AttentionRow from '@/components/AttentionRow';
import Pagination, { pageFromSearchParam, type PageSearchParams } from '@/components/Pagination';

export const dynamic = 'force-dynamic';

export default function InboxPage({ searchParams }: { searchParams?: PageSearchParams }) {
  let pageItems: Item[] = [];
  let itemCount = 0;
  let page = 1;
  let totalPages = 1;
  try {
    const result = inboxPage(pageFromSearchParam(searchParams?.page), 10);
    pageItems = result.items;
    itemCount = result.totalItems;
    page = result.page;
    totalPages = result.totalPages;
  } catch { /* empty */ }

  return (
    <>
      <TopBar title="Inbox" />
      <div className="feed-intro">
        <p>New captures, ranked in one calm feed instead of buried in folders.</p>
        <span>{itemCount} item{itemCount === 1 ? '' : 's'}</span>
      </div>

      <div className="panel">
        <div className="panel-body">
          {itemCount === 0 ? (
            <div className="empty-state-compact">
              <strong>Your inbox is clear.</strong>
              <span>Bookmark a post on X or visit an agreement page to capture something.</span>
            </div>
          ) : (
            pageItems.map((item) => (
              <AttentionRow key={item.id} item={item} parentTitle={getParentTitle(item.parent_id)} iconMode="source" />
            ))
          )}
        </div>
        <Pagination basePath="/inbox" page={page} totalPages={totalPages} label="Inbox pages" />
      </div>

      {itemCount > 0 && page === totalPages && (
        <p className="feed-end">That&rsquo;s everything. New captures appear here automatically.</p>
      )}
    </>
  );
}
