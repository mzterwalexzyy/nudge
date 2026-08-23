import Link from 'next/link';
import type { Item } from '@/lib/db';
import { KindIcon, KindPill, SourceIcon } from '@/components/kind';
import { IconChevron } from '@/components/icons';
import { agoLabel, countdownLabel, dateDisplay, parseHighlights } from '@/lib/ui';

const SOURCE_LABEL: Record<string, string> = {
  x_bookmark: 'Saved from X',
  bookmark_backfill: 'Imported',
  save_button: 'Saved',
  paste: 'Pasted',
  agreement: 'Analyzed',
};

function statusText(item: Item): { text: string; cls: string } {
  if (item.kind === 'agreement') return { text: 'Worth reviewing', cls: 'status-yellow' };
  const dd = dateDisplay(item);
  if (!item.deadline) return { text: 'no date', cls: 'status-dim' };
  const label = countdownLabel(item.deadline);
  const cls =
    item.attention === 'high' ? 'status-red'
    : item.attention === 'important' ? 'status-orange'
    : 'status-yellow';
  return { text: dd.muted ? `${label} ≈` : label, cls };
}

export default function AttentionRow(
  { item, parentTitle, iconMode = 'kind' }:
  { item: Item; parentTitle?: string | null; iconMode?: 'kind' | 'source' },
) {
  const src = SOURCE_LABEL[item.source] || 'Saved';
  const st = statusText(item);
  const preview = parseHighlights(item)[0] || item.summary;
  return (
    <Link href={`/items/${item.id}`} className="row">
      {iconMode === 'source'
        ? <SourceIcon url={item.url} source={item.source} kind={item.kind} title={item.title} />
        : <KindIcon kind={item.kind} title={item.title} />}
      <div className="row-main">
        <div className="row-title">{item.title || item.url}</div>
        {preview && <div className="row-preview">{preview}</div>}
        <div className="row-meta">
          <KindPill kind={item.kind} />
          <span>{src}</span>
          <span>·</span>
          <span>{agoLabel(item.created_at)}</span>
          {parentTitle && (<><span>·</span><span>from: {parentTitle}</span></>)}
        </div>
      </div>
      <div className="row-right">
        <span className={`row-status ${st.cls}`}>{st.text}</span>
        <IconChevron size={16} />
      </div>
    </Link>
  );
}
