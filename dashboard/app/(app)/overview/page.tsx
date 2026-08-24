import Link from 'next/link';
import { needsAttentionPage, getParentTitle, dashboardStats, recentlySaved } from '@/lib/db';
import type { Item } from '@/lib/db';
import AttentionRow from '@/components/AttentionRow';
import Pagination, { pageFromSearchParam, type PageSearchParams } from '@/components/Pagination';
import { KindPill, SourceIcon } from '@/components/kind';
import { IconClock, IconAlert, IconBookmark, IconCheck, IconChevron } from '@/components/icons';
import { agoLabel } from '@/lib/ui';

export const dynamic = 'force-dynamic';

export default function OverviewPage({ searchParams }: { searchParams?: PageSearchParams }) {
  let pageItems: Item[] = [];
  let itemCount = 0;
  let page = 1;
  let totalPages = 1;
  let stats = { deadlinesApproaching: 0, needReview: 0, recentlySaved: 0, totalItems: 0 };
  let recent: Item[] = [];
  try {
    const result = needsAttentionPage(pageFromSearchParam(searchParams?.page), 3);
    pageItems = result.items;
    itemCount = result.totalItems;
    page = result.page;
    totalPages = result.totalPages;
    stats = dashboardStats();
    recent = recentlySaved(4);
  } catch { /* empty db */ }

  return (
    <>
      <div className="stat-row">
        <StatCard color="red" icon={<IconClock />} value={stats.deadlinesApproaching} label="Deadlines approaching" />
        <StatCard color="orange" icon={<IconAlert />} value={stats.needReview} label="Need your review" />
        <StatCard color="blue" icon={<IconBookmark />} value={stats.recentlySaved} label="Recently saved" />
        <StatCard color="green" icon={<IconCheck />} value={stats.totalItems} label="Total items" />
      </div>

      <div className="panel">
        <div className="panel-head">
          <h2>Needs your attention</h2>
        </div>
        <div className="panel-body">
          {itemCount === 0 ? (
            <div style={{ padding: 28, textAlign: 'center', color: 'var(--text-dim)', fontSize: 14 }}>
              Nothing urgent right now. Items with near deadlines will surface here.
            </div>
          ) : (
            pageItems.map((it) => <AttentionRow key={it.id} item={it} parentTitle={getParentTitle(it.parent_id)} />)
          )}
        </div>
        <Pagination basePath="/overview" page={page} totalPages={totalPages} label="Needs your attention pages" />
      </div>

      <div className="panel">
        <div className="panel-head">
          <h2>Recently saved</h2>
          <Link href="/inbox" className="view-all">View all <IconChevron size={14} /></Link>
        </div>
        <div className="card-grid">
          {recent.length === 0 ? (
            <div style={{ color: 'var(--text-dim)', fontSize: 14, padding: 12 }}>No items yet.</div>
          ) : (
            recent.map((it) => (
              <Link key={it.id} href={`/items/${it.id}`} className="mini-card">
                <SourceIcon url={it.url} source={it.source} kind={it.kind} title={it.title} size={18} />
                <div className="mc-title">{(it.title || it.url).slice(0, 60)}</div>
                <div className="mc-meta">
                  <KindPill kind={it.kind} />
                  <span>{agoLabel(it.created_at)}</span>
                </div>
              </Link>
            ))
          )}
        </div>
      </div>
    </>
  );
}

function StatCard({ color, icon, value, label }: { color: string; icon: React.ReactNode; value: number; label: string }) {
  return (
    <div className={`stat-card c-${color}`}>
      <span className={`stat-icon c-${color}`}>{icon}</span>
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
}
