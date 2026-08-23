'use client';

import { useEffect, useRef, useState } from 'react';
import type { Item } from '@/lib/db';

type Buckets = {
  expired: Item[];
  unattended: Item[];
  duplicates: Item[];
  dead: Item[];
  stale: Item[];
};

type BucketKey = keyof Buckets;

const BUCKET_META: Record<BucketKey, { name: string; desc: string; action: string; danger: boolean }> = {
  expired: { name: 'Expired', desc: 'Deadline already passed.', action: 'expire', danger: false },
  unattended: { name: 'Unattended', desc: 'Older than 6 months, never reopened.', action: 'stale', danger: false },
  duplicates: { name: 'Duplicates', desc: 'Near-identical to another saved item.', action: 'delete', danger: true },
  dead: { name: 'Dead links', desc: 'Returned 404/410 on last check.', action: 'delete', danger: true },
  stale: { name: 'Possibly stale', desc: 'Low attention, old, never opened.', action: 'stale', danger: false },
};

export default function SanitizeCenter({ buckets }: { buckets: Buckets }) {
  const [proposing, setProposing] = useState(false);
  const [confirm, setConfirm] = useState<BucketKey | null>(null);
  const [done, setDone] = useState<Partial<Record<BucketKey, string>>>({});
  const [busy, setBusy] = useState(false);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const order: BucketKey[] = ['expired', 'unattended', 'duplicates', 'dead', 'stale'];

  useEffect(() => {
    if (!confirm) return;
    cancelRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) setConfirm(null);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [confirm, busy]);

  async function runBucket(key: BucketKey) {
    setBusy(true);
    const meta = BUCKET_META[key];
    const ids = buckets[key].map((item) => item.id);
    try {
      const response = await fetch('/api/cleanup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids, bucket: key, confirmed: true }),
      });
      const result = await response.json();
      setDone((current) => ({
        ...current,
        [key]: result.ok ? `${result.updated} item(s) ${meta.action}d` : `Error: ${result.error}`,
      }));
    } catch (error: any) {
      setDone((current) => ({ ...current, [key]: `Error: ${error.message}` }));
    } finally {
      setBusy(false);
      setConfirm(null);
    }
  }

  return (
    <>
      <div className="cleanup-intro">
        <button
          className="btn"
          onClick={() => setProposing(true)}
          disabled={proposing}
          aria-expanded={proposing}
        >
          Run Smart Cleanup
        </button>
        {proposing && <span>Review and confirm each group. Nothing runs automatically.</span>}
      </div>

      {order.map((key) => {
        const meta = BUCKET_META[key];
        const list = buckets[key];
        return (
          <section key={key} className="bucket" aria-labelledby={`bucket-${key}`}>
            <div className="bucket-head">
              <div>
                <h2 className="bucket-name" id={`bucket-${key}`}>{meta.name}</h2>
                <div className="bucket-desc">{meta.desc}</div>
              </div>
              <div className="bucket-action">
                <div className="bucket-count">{list.length} item{list.length === 1 ? '' : 's'}</div>
                {proposing && list.length > 0 && !done[key] && (
                  <button
                    className={`btn ${meta.danger ? 'btn-danger' : 'btn-secondary'}`}
                    onClick={() => setConfirm(key)}
                    disabled={busy}
                  >
                    {meta.danger ? `Review deletion (${list.length})` : `Review update (${list.length})`}
                  </button>
                )}
                {done[key] && <div className="cleanup-result" role="status">{done[key]}</div>}
              </div>
            </div>

            {proposing && list.length > 0 && (
              <ul className="cleanup-preview">
                {list.slice(0, 8).map((item) => <li key={item.id}>{item.title || item.url}</li>)}
                {list.length > 8 && <li>…and {list.length - 8} more</li>}
              </ul>
            )}
          </section>
        );
      })}

      {confirm && (
        <div className="modal-overlay" onMouseDown={() => !busy && setConfirm(null)}>
          <div
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="cleanup-dialog-title"
            aria-describedby="cleanup-dialog-description"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <h3 id="cleanup-dialog-title">Confirm {BUCKET_META[confirm].name.toLowerCase()} cleanup</h3>
            <p id="cleanup-dialog-description">
              This will {BUCKET_META[confirm].action} <strong>{buckets[confirm].length}</strong> item(s).
              {BUCKET_META[confirm].danger
                ? ' This permanently deletes them and cannot be undone.'
                : ' This only changes their status; it does not delete them.'}
            </p>
            <div className="modal-actions">
              <button ref={cancelRef} className="btn btn-secondary" onClick={() => setConfirm(null)} disabled={busy}>
                Cancel
              </button>
              <button
                className={`btn ${BUCKET_META[confirm].danger ? 'btn-danger' : ''}`}
                onClick={() => runBucket(confirm)}
                disabled={busy}
              >
                {busy ? 'Working…' : BUCKET_META[confirm].danger ? 'Confirm permanent delete' : 'Confirm update'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
