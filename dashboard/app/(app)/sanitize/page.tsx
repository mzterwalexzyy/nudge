import { sanitizeBuckets } from '@/lib/db';
import type { SanitizeBuckets } from '@/lib/db';
import { FEATURES } from '@/lib/features';
import TopBar from '@/components/TopBar';
import SanitizeCenter from '@/components/SanitizeCenter';

export const dynamic = 'force-dynamic';

const EMPTY: SanitizeBuckets = { expired: [], unattended: [], duplicates: [], dead: [], stale: [] };

export default function SanitizePage() {
  let buckets: SanitizeBuckets = EMPTY;
  try { buckets = sanitizeBuckets(); } catch { buckets = EMPTY; }

  return (
    <>
      <TopBar title="Sanitize" />
      <p className="subtitle" style={{ marginTop: -18 }}>
        Clean up what no longer matters. Every action is proposed and requires your confirmation.
      </p>

      <div className="premium-banner" data-feature-enabled={FEATURES.premiumBookmarkBackfill}>
        <div>
          <span className="premium-tag">PREMIUM</span>{'  '}
          <strong style={{ marginLeft: 8 }}>Import my past X bookmarks</strong>
          <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 3 }}>
            Not built in the free MVP. Future options: best-effort DOM backfill (beta) or the paid official X bookmarks API.
          </div>
        </div>
        <button className="btn" disabled={!FEATURES.premiumBookmarkBackfill} title="Premium backfill is not available on the free tier">
          Import (Premium)
        </button>
      </div>

      <SanitizeCenter buckets={buckets} />
    </>
  );
}
