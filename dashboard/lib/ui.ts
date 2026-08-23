import type { Item } from './db';

export const ATTENTION_COLOR: Record<string, string> = {
  low: '#3fb950',      // green
  review: '#d29922',   // yellow
  important: '#db6d28', // orange
  high: '#f85149',     // red
};

export const ATTENTION_LABEL: Record<string, string> = {
  low: 'Low',
  review: 'Review',
  important: 'Important',
  high: 'High',
};

const KIND_LABELS: Record<string, { singular: string; plural: string; description: string }> = {
  article: { singular: 'Article', plural: 'Articles', description: 'Reading, summaries, and captured references.' },
  opportunity: { singular: 'Opportunity', plural: 'Opportunities', description: 'Deadlines, applications, and things to act on.' },
  tool: { singular: 'Tool', plural: 'Tools', description: 'Products and utilities saved for later use.' },
  repo: { singular: 'Repository', plural: 'Repositories', description: 'Codebases and technical projects worth revisiting.' },
  video: { singular: 'Video', plural: 'Videos', description: 'Saved videos with their extracted intelligence.' },
  agreement: { singular: 'Agreement', plural: 'Agreements', description: 'Terms, policies, and clauses worth reviewing.' },
  idea: { singular: 'Idea', plural: 'Ideas', description: 'Concepts and inspiration captured for later.' },
  entertainment: { singular: 'Entertainment', plural: 'Entertainment', description: 'Things saved to watch, read, or enjoy.' },
  collection: { singular: 'Collection', plural: 'Collections', description: 'Grouped items tracked as a single collection.' },
};

export function kindLabel(kind: string, plural = true): string {
  const known = KIND_LABELS[kind];
  if (known) return plural ? known.plural : known.singular;
  const title = kind.replace(/[_-]+/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
  return plural && !title.endsWith('s') ? `${title}s` : title;
}

export function kindDescription(kind: string): string {
  return KIND_LABELS[kind]?.description || 'Saved items classified into this category.';
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function daysUntil(deadline: string | null, now: Date = new Date()): number | null {
  if (!deadline) return null;
  const dl = new Date(deadline + 'T23:59:59');
  if (isNaN(dl.getTime())) return null;
  return Math.floor((dl.getTime() - now.getTime()) / DAY_MS);
}

export function countdownLabel(deadline: string | null, now: Date = new Date()): string {
  const d = daysUntil(deadline, now);
  if (d === null) return '';
  if (d < 0) return `${Math.abs(d)}d overdue`;
  if (d === 0) return 'due today';
  if (d === 1) return 'due tomorrow';
  return `in ${d} days`;
}

export function agoLabel(iso: string | null, now: Date = new Date()): string {
  if (!iso) return '';
  const t = new Date(iso.replace(' ', 'T') + 'Z');
  if (isNaN(t.getTime())) return '';
  const diff = Math.floor((now.getTime() - t.getTime()) / DAY_MS);
  if (diff <= 0) return 'today';
  if (diff === 1) return 'yesterday';
  if (diff < 30) return `${diff}d ago`;
  if (diff < 365) return `${Math.floor(diff / 30)}mo ago`;
  return `${Math.floor(diff / 365)}y ago`;
}

export function parseHighlights(item: Item): string[] {
  if (!item.highlights) return [];
  try {
    const value: unknown = JSON.parse(item.highlights);
    if (!Array.isArray(value)) return [];
    return value
      .filter((entry): entry is string => typeof entry === 'string')
      .map((entry) => entry.trim())
      .filter(Boolean)
      .slice(0, 20);
  } catch {
    return [];
  }
}

export type UsefulLink = {
  url: string;
  label: string;
};

export function parseOutboundLinks(item: Item): UsefulLink[] {
  if (!item.outbound_links) return [];
  try {
    const value: unknown = JSON.parse(item.outbound_links);
    if (!Array.isArray(value)) return [];
    const links = new Map<string, UsefulLink>();
    for (const entry of value) {
      const rawUrl = typeof entry === 'string'
        ? entry
        : entry && typeof entry === 'object' && typeof (entry as Record<string, unknown>).url === 'string'
          ? String((entry as Record<string, unknown>).url)
          : '';
      const label = entry && typeof entry === 'object' && typeof (entry as Record<string, unknown>).label === 'string'
        ? String((entry as Record<string, unknown>).label).trim().slice(0, 300)
        : '';
      try {
        const parsed = new URL(rawUrl);
        if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) continue;
        const host = parsed.hostname.toLowerCase();
        const isX = host === 'x.com' || host.endsWith('.x.com')
          || host === 'twitter.com' || host.endsWith('.twitter.com');
        if (isX) continue;
        const url = parsed.toString();
        if (!links.has(url)) links.set(url, { url, label });
      } catch {
        // Invalid persisted metadata is ignored rather than rendered.
      }
      if (links.size >= 20) break;
    }
    return [...links.values()];
  } catch {
    return [];
  }
}

/**
 * How to present a deadline given its confidence. Only 'explicit' dates are
 * shown as trustworthy; 'inferred'/'none' are visually muted so the user
 * never trusts a guessed date.
 */
export function dateDisplay(item: Item, now: Date = new Date()): { text: string; muted: boolean; marker: string } {
  const conf = item.date_confidence || (item.deadline ? 'explicit' : 'none');
  if (!item.deadline) {
    return { text: 'no date', muted: true, marker: '' };
  }
  if (conf === 'explicit') {
    return { text: countdownLabel(item.deadline, now), muted: false, marker: '' };
  }
  // inferred
  return { text: `${countdownLabel(item.deadline, now)}`, muted: true, marker: '≈ estimated' };
}

export function parseClauses(item: Item): Array<{ label: string; level: string; plain_explanation: string }> {
  if (!item.clauses) return [];
  try {
    const c = JSON.parse(item.clauses);
    return Array.isArray(c) ? c : [];
  } catch {
    return [];
  }
}
