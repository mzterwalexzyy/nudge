import Link from 'next/link';
import { organizedCategories } from '@/lib/db';
import type { OrganizedCategory } from '@/lib/db';
import TopBar from '@/components/TopBar';
import { KindIcon } from '@/components/kind';
import { agoLabel, kindDescription, kindLabel } from '@/lib/ui';

export const dynamic = 'force-dynamic';

function categoryName(category: OrganizedCategory): string {
  return category.category_name || kindLabel(category.category_key);
}

export default function OrganizedPage() {
  let categories: OrganizedCategory[] = [];
  try { categories = organizedCategories(); } catch { /* empty */ }

  return (
    <>
      <TopBar title="Organized" />
      <p className="subtitle" style={{ marginTop: -18 }}>
        AI organizes new saves by default. Rename categories or move items whenever your own structure fits better.
      </p>

      {categories.length === 0 ? (
        <div className="empty">Nothing classified yet. A category appears automatically when NUDGE classifies your first saved item.</div>
      ) : (
        <div className="category-grid">
          {categories.map((category) => (
            <Link
              key={category.category_key}
              href={`/organized/${encodeURIComponent(category.category_key)}`}
              className="category-card"
            >
              <div className="category-card-head">
                <KindIcon kind={category.icon_kind} />
                <span className="category-count" aria-label={`${category.item_count} saved items`}>
                  {category.item_count}
                </span>
              </div>
              <div className="category-card-copy">
                <h2>{categoryName(category)}</h2>
                <p>{category.category_key.startsWith('custom-')
                  ? 'A category you created and control.'
                  : kindDescription(category.icon_kind)}</p>
              </div>
              <div className="category-card-foot">
                <span>{category.item_count} saved item{category.item_count === 1 ? '' : 's'}</span>
                <span>Updated {agoLabel(category.latest_saved_at)}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
