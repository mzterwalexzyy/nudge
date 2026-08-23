import Link from 'next/link';
import { agreements } from '@/lib/db';
import type { Item } from '@/lib/db';
import TopBar from '@/components/TopBar';
import { KindIcon } from '@/components/kind';
import { parseClauses } from '@/lib/ui';

export const dynamic = 'force-dynamic';

const LEVEL_COLOR: Record<string, string> = {
  high: 'var(--red)', important: 'var(--orange)', review: 'var(--yellow)', low: 'var(--green)',
};

export default function AgreementsPage() {
  let items: Item[] = [];
  try { items = agreements(); } catch { /* empty */ }

  return (
    <>
      <TopBar title="Agreements" />
      <p className="subtitle" style={{ marginTop: -18 }}>
        Terms, privacy, and subscription pages you saved — with the clauses that actually matter.
      </p>

      {items.length === 0 ? (
        <div className="empty">No agreements analyzed yet. Visit a Terms page with the extension to see what matters.</div>
      ) : (
        items.map((it) => {
          const clauses = parseClauses(it);
          return (
            <div key={it.id} className="panel">
              <div className="row" style={{ borderRadius: 'var(--radius) var(--radius) 0 0' }}>
                <KindIcon kind="agreement" />
                <div className="row-main">
                  <div className="row-title">
                    <Link href={`/items/${it.id}`}>{it.title || it.url}</Link>
                  </div>
                  <div className="row-meta">
                    <span className="pill agreement">agreement</span>
                    <span>{clauses.length} clause{clauses.length === 1 ? '' : 's'} worth knowing</span>
                  </div>
                </div>
              </div>
              <div style={{ padding: '4px 20px 16px', borderTop: '1px solid var(--border)' }}>
                {clauses.map((c, i) => (
                  <div key={i} className="clause">
                    <div className="clause-label">
                      <span className="pill" style={{ background: 'transparent', color: LEVEL_COLOR[c.level] || 'var(--yellow)', border: `1px solid ${LEVEL_COLOR[c.level] || 'var(--yellow)'}` }}>
                        {c.level}
                      </span>
                      {c.label}
                    </div>
                    <div className="clause-exp">{c.plain_explanation}</div>
                  </div>
                ))}
                {clauses.length === 0 && <div style={{ fontSize: 13, color: 'var(--text-dim)', paddingTop: 10 }}>No clauses stored for this item.</div>}
              </div>
            </div>
          );
        })
      )}
    </>
  );
}
