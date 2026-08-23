import Link from 'next/link';
import { notFound } from 'next/navigation';
import { organizedByCategory, organizedCategories, organizedCategory } from '@/lib/db';
import type { Item } from '@/lib/db';
import TopBar from '@/components/TopBar';
import { SourceIcon } from '@/components/kind';
import { CategoryRename, ItemCategoryMove } from '@/components/CategoryControls';
import { agoLabel, kindDescription, kindLabel, parseHighlights } from '@/lib/ui';

export const dynamic = 'force-dynamic';

const SOURCE_LABEL: Record<string, string> = {
  x_bookmark: 'Saved from X',
  bookmark_backfill: 'Imported bookmark',
  save_button: 'Saved page',
  paste: 'Pasted URL',
  agreement: 'Analyzed agreement',
};

export default function OrganizedCategoryPage({ params }: { params: { kind: string } }) {
  const categoryKey = params.kind.trim().toLowerCase();
  let items: Item[] = [];
  let category: ReturnType<typeof organizedCategory>;
  let allCategories: ReturnType<typeof organizedCategories> = [];
  try {
    category = organizedCategory(categoryKey);
    items = organizedByCategory(categoryKey);
    allCategories = organizedCategories();
  } catch { /* unavailable db */ }
  if (!category || items.length === 0) notFound();

  const name = category.category_name || kindLabel(category.category_key);
  const description = category.category_key.startsWith('custom-')
    ? 'A category you created and control.'
    : kindDescription(category.icon_kind);
  const options = allCategories.map((entry) => ({
    key: entry.category_key,
    name: entry.category_name || kindLabel(entry.category_key),
  }));

  return (
    <>
      <TopBar title={name} subtitle={description} />
      <div className="category-page-tools">
        <Link href="/organized" className="detail-back category-back">← All categories</Link>
        <CategoryRename categoryKey={categoryKey} currentName={name} />
      </div>

      <div className="organized-item-grid">
        {items.map((item) => {
          const preview = parseHighlights(item)[0] || item.summary || item.why_saved;
          return (
            <article key={item.id} className="organized-item-card">
              <Link href={`/items/${item.id}`} className="organized-item-card-link">
                <div className="organized-item-source">
                  <SourceIcon url={item.url} source={item.source} kind={item.kind} title={item.title} size={18} />
                  <span>{SOURCE_LABEL[item.source] || 'Saved item'}</span>
                </div>
                <h2>{item.title || item.url}</h2>
                {preview && <p>{preview}</p>}
                <div className="organized-item-foot">
                  <span>Saved {agoLabel(item.created_at)}</span>
                  {item.deadline && <span>Due {item.deadline}</span>}
                  <strong>Open →</strong>
                </div>
              </Link>
              <div className="organized-item-manage">
                <ItemCategoryMove
                  itemId={item.id}
                  currentCategoryKey={categoryKey}
                  categories={options}
                  compact
                />
              </div>
            </article>
          );
        })}
      </div>
    </>
  );
}
