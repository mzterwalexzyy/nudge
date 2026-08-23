import {
  IconArticle, IconGithub, IconVideo, IconShield, IconBookmark,
  IconTrophy, IconRocket, IconGift, IconIdea, IconEvent, IconFolder,
  IconX, IconYoutube, IconNotion, IconStripe, IconGlobe,
} from '@/components/icons';

/* ---------------- Kind → icon ---------------- */

const KIND_ICON: Record<string, React.ComponentType<{ size?: number }>> = {
  article: IconArticle,
  repo: IconGithub,
  video: IconVideo,
  agreement: IconShield,
  opportunity: IconTrophy,
  tool: IconBookmark,
  idea: IconIdea,
  entertainment: IconVideo,
  collection: IconFolder,
};

const KIND_BG: Record<string, { bg: string; color: string }> = {
  article: { bg: 'var(--blue-bg)', color: 'var(--blue)' },
  tool: { bg: 'var(--blue-bg)', color: 'var(--blue)' },
  repo: { bg: 'var(--green-bg)', color: 'var(--green)' },
  video: { bg: 'var(--pink-bg)', color: 'var(--pink)' },
  entertainment: { bg: 'var(--pink-bg)', color: 'var(--pink)' },
  agreement: { bg: 'var(--yellow-bg)', color: 'var(--yellow)' },
  opportunity: { bg: 'var(--red-bg)', color: 'var(--red)' },
  idea: { bg: 'var(--grey-bg)', color: 'var(--grey)' },
  collection: { bg: 'var(--grey-bg)', color: 'var(--grey)' },
};

/**
 * Refine an opportunity's glyph from its title so a hackathon, an accelerator,
 * a grant and a plain event don't all share one icon (matches the reference).
 */
function refineOpportunity(title: string | null | undefined): React.ComponentType<{ size?: number }> {
  const t = (title || '').toLowerCase();
  if (/\b(program|accelerator|startup|cohort|fellowship|residency|incubat)/.test(t)) return IconRocket;
  if (/\b(grant|fund|bounty|prize pool|scholarship)/.test(t)) return IconGift;
  if (/\b(summit|conference|meetup|event|expo|demo day)/.test(t)) return IconEvent;
  return IconTrophy; // hackathons and the general case
}

/**
 * Icon tile for an item. `title` optionally refines opportunities.
 * Backwards compatible: <KindIcon kind={x} /> still works.
 */
export function KindIcon({ kind, title, size = 20 }: { kind: string | null; title?: string | null; size?: number }) {
  const k = kind || 'idea';
  const Icon = k === 'opportunity' ? refineOpportunity(title) : (KIND_ICON[k] || IconArticle);
  const c = KIND_BG[k] || KIND_BG.idea;
  return (
    <span className="row-icon" style={{ background: c.bg, color: c.color }}>
      <Icon size={size} />
    </span>
  );
}

export function KindPill({ kind }: { kind: string | null }) {
  if (!kind) return null;
  return <span className={`pill ${kind}`}>{kind}</span>;
}

/* ---------------- Source domain → brand mark ---------------- */

type Brand = { Icon: React.ComponentType<{ size?: number }>; bg: string; color: string };

const BRANDS: Record<string, Brand> = {
  x: { Icon: IconX, bg: '#15181c', color: '#ffffff' },
  github: { Icon: IconGithub, bg: '#1f2328', color: '#ffffff' },
  youtube: { Icon: IconYoutube, bg: 'var(--red-bg)', color: 'var(--red)' },
  notion: { Icon: IconNotion, bg: 'var(--grey-bg)', color: 'var(--text)' },
  stripe: { Icon: IconStripe, bg: '#eef0ff', color: '#635bff' },
  web: { Icon: IconGlobe, bg: 'var(--grey-bg)', color: 'var(--grey)' },
};

function brandKey(url: string | null | undefined, source?: string | null): keyof typeof BRANDS {
  if (source === 'x_bookmark') return 'x';
  let host = '';
  try { host = new URL(url || '').hostname.replace(/^www\./, '').toLowerCase(); } catch { /* noop */ }
  if (host.includes('x.com') || host.includes('twitter.com')) return 'x';
  if (host.includes('github')) return 'github';
  if (host.includes('youtube') || host.includes('youtu.be')) return 'youtube';
  if (host.includes('notion')) return 'notion';
  if (host.includes('stripe')) return 'stripe';
  return 'web';
}

/**
 * Brand-mark tile chosen from the item's source/URL. Use on source-forward
 * surfaces like the "Recently saved" cards and the Inbox. When the domain is
 * not a known brand it falls back to the kind glyph (so an ethglobal.com
 * opportunity still shows a trophy, a stripe.com agreement a shield, etc.).
 */
export function SourceIcon(
  { url, source, kind, title, size = 18 }:
  { url?: string | null; source?: string | null; kind?: string | null; title?: string | null; size?: number },
) {
  const key = brandKey(url, source);
  if (key === 'web' && kind !== undefined) {
    return <KindIcon kind={kind ?? null} title={title} size={size + 2} />;
  }
  const b = BRANDS[key];
  const B = b.Icon;
  return (
    <span className="row-icon" style={{ background: b.bg, color: b.color }}>
      <B size={size} />
    </span>
  );
}
