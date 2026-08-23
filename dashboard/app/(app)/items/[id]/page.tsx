import Link from 'next/link';
import { notFound } from 'next/navigation';
import TopBar from '@/components/TopBar';
import { ItemCategoryMove } from '@/components/CategoryControls';
import { byId, categoryForItem, getChildren, organizedCategories } from '@/lib/db';
import type { Item } from '@/lib/db';
import {
  agoLabel,
  dateDisplay,
  kindLabel,
  parseClauses,
  parseHighlights,
  parseOutboundLinks,
} from '@/lib/ui';
import type { UsefulLink } from '@/lib/ui';

export const dynamic = 'force-dynamic';

const SOURCE_LABEL: Record<string, string> = {
  x_bookmark: 'X bookmark',
  bookmark_backfill: 'Imported bookmark',
  save_button: 'Saved page',
  paste: 'Pasted URL',
  agreement: 'Agreement capture',
};

function legacyLinkedUrl(item: Item, links: UsefulLink[]): UsefulLink[] {
  if (!item.linked_url || links.some((link) => link.url === item.linked_url)) return links;
  try {
    const parsed = new URL(item.linked_url);
    if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) return links;
    const host = parsed.hostname.toLowerCase();
    const isX = host === 'x.com' || host.endsWith('.x.com')
      || host === 'twitter.com' || host.endsWith('.twitter.com');
    if (isX) return links;
    return [...links, { url: parsed.toString(), label: '' }].slice(0, 20);
  } catch {
    return links;
  }
}

function linkLabel(link: UsefulLink): string {
  if (link.label) return link.label;
  try {
    return new URL(link.url).hostname.replace(/^www\./, '');
  } catch {
    return link.url;
  }
}

function IntelligenceSection(
  { title, children, empty }: { title: string; children?: React.ReactNode; empty: string },
) {
  return (
    <section className="detail-section">
      <h2>{title}</h2>
      {children || <p className="detail-empty">{empty}</p>}
    </section>
  );
}

export default function ItemDetailPage({ params }: { params: { id: string } }) {
  let item: Item | undefined;
  try {
    item = byId(params.id);
  } catch {
    notFound();
  }
  if (!item) notFound();

  const highlights = parseHighlights(item);
  const usefulLinks = legacyLinkedUrl(item, parseOutboundLinks(item));
  const clauses = parseClauses(item);
  const children = getChildren(item.id);
  const parent = item.parent_id ? byId(item.parent_id) : undefined;
  const deadline = dateDisplay(item);
  const itemCategory = categoryForItem(item);
  const categoryName = itemCategory
    ? itemCategory.category_name || kindLabel(itemCategory.category_key)
    : 'Unclassified';
  const categoryOptions = organizedCategories().map((category) => ({
    key: category.category_key,
    name: category.category_name || kindLabel(category.category_key),
  }));
  const isX = item.source === 'x_bookmark' || /(^|\.)x\.com$/i.test((() => {
    try { return new URL(item.url).hostname; } catch { return ''; }
  })());

  return (
    <>
      <TopBar title="Item intelligence" subtitle="Highlights, context, useful links, and the original source in one place." />

      <article className="detail-shell">
        <header className="detail-hero">
          <Link href="/organized" className="detail-back">← Back to Organized</Link>
          <div className="detail-kicker">
            <span className={`pill ${item.kind || ''}`}>{categoryName}</span>
            <span>{SOURCE_LABEL[item.source] || item.source}</span>
            <span>·</span>
            <span>saved {agoLabel(item.created_at)}</span>
          </div>
          <h1>{item.title || item.url}</h1>
          {item.author && <p className="detail-author">By {item.author}</p>}
          <div className="detail-actions">
            <a href={item.url} target="_blank" rel="noreferrer" className="btn detail-source-link">
              {isX ? 'View post on X' : 'View original source'}
            </a>
          </div>
        </header>

        <div className="detail-grid">
          <main className="detail-content">
            <section className="detail-section detail-overview">
              <div className="detail-overview-block">
                <h2>Summary</h2>
                {item.summary
                  ? <p className="detail-summary-copy">{item.summary}</p>
                  : <p className="detail-empty">No stored summary was produced for this item.</p>}
              </div>
              <div className="detail-overview-block detail-why-saved">
                <h2>Why you may have saved this</h2>
                {item.why_saved
                  ? <p>{item.why_saved}</p>
                  : <p className="detail-empty">No stored why-saved explanation was produced for this item.</p>}
              </div>
            </section>

            <IntelligenceSection title="Highlights" empty="No stored highlights were produced for this item.">
              {highlights.length > 0 ? (
                <ul className="detail-highlights">
                  {highlights.map((highlight, index) => <li key={index}>{highlight}</li>)}
                </ul>
              ) : undefined}
            </IntelligenceSection>

            <IntelligenceSection title="Useful links" empty="No external links were captured from this item.">
              {usefulLinks.length > 0 ? (
                <ul className="useful-links">
                  {usefulLinks.map((link) => (
                    <li key={link.url}>
                      <a href={link.url} target="_blank" rel="noreferrer">
                        <span>{linkLabel(link)}</span>
                        <small>{link.url}</small>
                      </a>
                    </li>
                  ))}
                </ul>
              ) : undefined}
            </IntelligenceSection>

            {clauses.length > 0 && (
              <IntelligenceSection title="Clauses" empty="No clauses were stored.">
                <div>
                  {clauses.map((clause, index) => (
                    <div key={index} className="clause">
                      <div className="clause-label">
                        <span className={`pill ${clause.level}`}>{clause.level}</span>
                        {clause.label}
                      </div>
                      <div className="clause-exp">{clause.plain_explanation}</div>
                    </div>
                  ))}
                </div>
              </IntelligenceSection>
            )}

            {(parent || children.length > 0) && (
              <IntelligenceSection title="Related organization" empty="No related items.">
                <div className="detail-relations">
                  {parent && (
                    <Link href={`/items/${parent.id}`}>
                      <small>Part of collection</small>
                      <strong>{parent.title || parent.url}</strong>
                    </Link>
                  )}
                  {children.map((child) => (
                    <Link key={child.id} href={`/items/${child.id}`}>
                      <small>Tracked item</small>
                      <strong>{child.title || child.url}</strong>
                    </Link>
                  ))}
                </div>
              </IntelligenceSection>
            )}
          </main>

          <aside className="detail-facts">
            <h2>At a glance</h2>
            <dl>
              <div><dt>Category</dt><dd>{categoryName}</dd></div>
              <div><dt>AI classification</dt><dd>{item.kind || 'Unclassified'}</dd></div>
              <div><dt>Status</dt><dd>{item.status}</dd></div>
              <div><dt>Attention</dt><dd>{item.attention}</dd></div>
              <div><dt>Action required</dt><dd>{item.action_required ? 'Yes' : 'No'}</dd></div>
              <div>
                <dt>Deadline</dt>
                <dd>{item.deadline || 'No stored date'}</dd>
                {item.deadline && deadline.text && <small>{deadline.text}</small>}
              </div>
              <div><dt>Date confidence</dt><dd>{item.date_confidence || 'none'}</dd></div>
            </dl>
            {itemCategory && (
              <div className="detail-category-control">
                <ItemCategoryMove
                  itemId={item.id}
                  currentCategoryKey={itemCategory.category_key}
                  categories={categoryOptions}
                />
              </div>
            )}
          </aside>
        </div>
      </article>
    </>
  );
}
