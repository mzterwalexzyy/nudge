/**
 * Mirrors clicks on X's native bookmark ADD control into NUDGE.
 * One delegated document listener handles virtualized tweets; removal is ignored.
 *
 * Correctness rules:
 *  - Everything is read from the post the bookmark button belongs to, and
 *    quoted/embedded tweets inside it are excluded, so a post's own author,
 *    text, URL, links and media never get mixed with a nested tweet's.
 *  - X long-form Articles can place their headline/body outside the nearest
 *    tweet container. On a canonical status page, the top Article control may
 *    use a constrained Article scope; embedded tweet controls never do.
 */

const LISTENER_MARKER = 'secondBrainXBookmarkListener';
const STATUS_PATH = /^\/[^/]+\/status\/\d+/;
const X_HOSTS = new Set(['x.com', 'twitter.com']);
const ARTICLE_UI_HEADINGS = new Set([
  'article',
  'what’s happening',
  "what's happening",
  'relevant people',
  'live on x',
]);

type CapturedLink = {
  url: string;
  label: string;
};

type Capture = {
  url: string;
  source: 'x_bookmark';
  title: string;
  text: string;
  links: string[];
  outbound_links: CapturedLink[];
  author: string | null;
  timestamp: string | null;
  media: string[];
  bookmarked_at: string;
};

type CaptureScope = {
  root: HTMLElement;
  mode: 'tweet' | 'article';
};

const log = (...args: unknown[]) => console.log('[NUDGE]', ...args);
const warn = (...args: unknown[]) => console.warn('[NUDGE]', ...args);

function findTweetContainer(element: Element | null): HTMLElement | null {
  let node = element;
  while (node && node !== document.body) {
    if (
      node instanceof HTMLElement &&
      node.tagName === 'ARTICLE' &&
      node.getAttribute('data-testid') === 'tweet'
    ) return node;
    node = node.parentElement;
  }
  return null;
}

/**
 * True when `node` belongs to a quoted/embedded post within `scope`. Starting
 * at the node itself also excludes a selected nested tweet/card root.
 */
function insideQuotedTweet(node: Element, scope: HTMLElement): boolean {
  let current: Element | null = node;
  while (current && current !== scope) {
    if (current.tagName === 'ARTICLE' && current.getAttribute('data-testid') === 'tweet') {
      return true;
    }
    if (
      current.getAttribute('role') === 'link' &&
      (current.matches('a[href*="/status/"]') || current.querySelector('a[href*="/status/"]'))
    ) {
      return true;
    }
    current = current.parentElement;
  }
  return false;
}

/** First matching element that belongs to the selected post, not a quoted one. */
function firstOwn<T extends Element>(scope: HTMLElement, selector: string): T | null {
  const nodes = scope.querySelectorAll(selector);
  for (const node of nodes) {
    if (!insideQuotedTweet(node, scope)) return node as unknown as T;
  }
  return null;
}

function cleanText(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function normalizeTweetUrl(href: string): string {
  try {
    const url = new URL(href, location.origin);
    return `https://x.com${url.pathname}`;
  } catch {
    return href;
  }
}

function canonicalPageUrl(): string | null {
  return STATUS_PATH.test(location.pathname) ? normalizeTweetUrl(location.href) : null;
}

function readOwnStatusUrl(root: HTMLElement): string | null {
  const times = root.querySelectorAll('a[href*="/status/"] time');
  for (const time of times) {
    const anchor = time.closest('a') as HTMLAnchorElement | null;
    if (anchor?.href && !insideQuotedTweet(anchor, root)) return normalizeTweetUrl(anchor.href);
  }
  const own = firstOwn<HTMLAnchorElement>(root, 'a[href*="/status/"]');
  return own?.href ? normalizeTweetUrl(own.href) : null;
}

function readTweetUrl(scope: CaptureScope): string | null {
  if (scope.mode === 'article') return canonicalPageUrl();
  return readOwnStatusUrl(scope.root) || canonicalPageUrl();
}

/** The author handle is the first path segment of the canonical status URL. */
function authorFromUrl(url: string | null): string | null {
  if (!url) return null;
  try {
    const segments = new URL(url).pathname.split('/').filter(Boolean);
    return segments[0] ? `@${segments[0]}` : null;
  } catch {
    return null;
  }
}

function readAuthor(scope: CaptureScope, url: string | null): string | null {
  const fromUrl = authorFromUrl(url);
  if (fromUrl) return fromUrl;
  const anchor = firstOwn<HTMLAnchorElement>(scope.root, '[data-testid="User-Name"] a[href^="/"]');
  const match = anchor?.getAttribute('href')?.match(/^\/([^/]+)$/);
  return match ? `@${match[1]}` : null;
}

function isArticleHeading(text: string): boolean {
  const normalized = cleanText(text).toLowerCase();
  return normalized.length >= 8 && !ARTICLE_UI_HEADINGS.has(normalized);
}

/**
 * Article-specific selectors are authoritative. Generic headings are only a
 * fallback, and known X navigation/sidebar labels are never accepted.
 */
function readArticleHeading(root: HTMLElement): string {
  const selectorGroups = [
    '[data-testid="twitterArticleTitle"], [data-testid="articleTitle"]',
    '[role="heading"][aria-level="1"]',
    'h1',
  ];

  for (const selector of selectorGroups) {
    const candidates: string[] = [];
    root.querySelectorAll<HTMLElement>(selector).forEach((node) => {
      if (insideQuotedTweet(node, root)) return;
      const text = cleanText(node.textContent || '');
      if (isArticleHeading(text)) candidates.push(text);
    });
    if (candidates.length) return candidates.sort((a, b) => b.length - a.length)[0];
  }
  return '';
}

/** Clone visible DOM content and remove nested posts/cards and action chrome. */
function sanitizedText(root: HTMLElement): string {
  const clone = root.cloneNode(true) as HTMLElement;
  clone.querySelectorAll('article[data-testid="tweet"]').forEach((node) => node.remove());
  clone.querySelectorAll('[role="link"]').forEach((node) => {
    if (node.matches('a[href*="/status/"]') || node.querySelector('a[href*="/status/"]')) node.remove();
  });
  clone.querySelectorAll(
    'button, [role="button"], nav, [role="navigation"], aside, script, style, [data-testid="bookmark"], [data-testid="removeBookmark"]',
  ).forEach((node) => node.remove());
  return cleanText(clone.innerText || clone.textContent || '');
}

function readArticleBody(root: HTMLElement, heading: string): string {
  const bodySelectors = [
    '[data-testid="twitterArticleReadView"]',
    '[data-testid="twitterArticleBody"]',
    '[data-testid="longformRichText"]',
    '[data-testid="articleBody"]',
    '[data-testid="articleText"]',
  ];
  let best = '';
  for (const selector of bodySelectors) {
    root.querySelectorAll<HTMLElement>(selector).forEach((node) => {
      if (insideQuotedTweet(node, root)) return;
      const text = sanitizedText(node);
      if (text.length > best.length) best = text;
    });
  }
  if (best) return best;

  const pieces: string[] = [];
  root.querySelectorAll<HTMLElement>('p, [dir="auto"]').forEach((node) => {
    if (insideQuotedTweet(node, root)) return;
    const text = sanitizedText(node);
    if (text.length < 40 || text === heading || pieces.includes(text)) return;
    if (pieces.some((piece) => piece.includes(text))) return;
    pieces.push(text);
  });
  if (pieces.length) return pieces.slice(0, 20).join(' ');

  const whole = sanitizedText(root);
  return whole !== heading ? whole : '';
}

function readText(scope: CaptureScope): { text: string; isArticle: boolean; headline: string } {
  if (scope.mode === 'tweet') {
    const own = firstOwn<HTMLElement>(scope.root, '[data-testid="tweetText"]');
    if (own) return { text: cleanText(own.textContent || ''), isArticle: false, headline: '' };
  }

  const headline = readArticleHeading(scope.root);
  const body = scope.mode === 'article' ? readArticleBody(scope.root, headline) : '';
  const text = body && headline && !body.toLowerCase().includes(headline.toLowerCase())
    ? cleanText(`${headline} ${body}`)
    : cleanText(body || headline);
  return { text, isArticle: text.length > 0, headline };
}

function readTimestamp(scope: CaptureScope): string | null {
  const time = firstOwn<HTMLTimeElement>(scope.root, 'time');
  return time?.dateTime || null;
}

function readMedia(scope: CaptureScope): string[] {
  const values = new Set<string>();
  scope.root.querySelectorAll('[data-testid="tweetPhoto"] img').forEach((node) => {
    if (insideQuotedTweet(node, scope.root)) return;
    const src = (node as HTMLImageElement).src;
    if (src) values.add(src);
  });
  return [...values];
}

function isXInternalHost(hostname: string): boolean {
  return [...X_HOSTS].some((host) => hostname === host || hostname.endsWith(`.${host}`));
}

/** Preserve real DOM labels and URLs; enrichment still receives URL strings. */
function readOutboundLinks(scope: CaptureScope): CapturedLink[] {
  const values = new Map<string, CapturedLink>();
  scope.root.querySelectorAll<HTMLAnchorElement>('a[href]').forEach((node) => {
    if (insideQuotedTweet(node, scope.root)) return;
    try {
      const url = new URL(node.href);
      if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return;
      const host = url.hostname.toLowerCase();
      if (isXInternalHost(host) && host !== 't.co') return;
      const href = url.toString();
      if (!values.has(href)) {
        values.set(href, {
          url: href,
          label: cleanText(node.textContent || node.getAttribute('aria-label') || node.title || ''),
        });
      }
    } catch {
      // Invalid DOM links are ignored; no value is fabricated.
    }
  });
  return [...values.values()];
}

/** Locate the smallest primary-column scope containing a real Article. */
function findArticleScope(control: Element): HTMLElement | null {
  if (!canonicalPageUrl()) return null;
  const quoteCard = control.closest('[role="link"]');
  if (quoteCard && (quoteCard.matches('a[href*="/status/"]') || quoteCard.querySelector('a[href*="/status/"]'))) {
    return null;
  }

  const primary = control.closest<HTMLElement>('[data-testid="primaryColumn"]')
    || document.querySelector<HTMLElement>('[data-testid="primaryColumn"]');
  const main = primary
    || control.closest<HTMLElement>('main, [role="main"]')
    || document.querySelector<HTMLElement>('main, [role="main"]');
  if (!main) return null;

  let fallback: HTMLElement | null = null;
  let node: HTMLElement | null = control.parentElement as HTMLElement | null;
  while (node && node !== document.body) {
    const heading = readArticleHeading(node);
    if (heading) {
      fallback ||= node;
      if (readArticleBody(node, heading).length >= 80) return node;
    }
    if (node === main) break;
    node = node.parentElement;
  }
  return fallback || (readArticleHeading(main) ? main : null);
}

function selectCaptureScope(control: Element): CaptureScope | null {
  const tweet = findTweetContainer(control);
  if (tweet) {
    const normalScope: CaptureScope = { root: tweet, mode: 'tweet' };
    if (readText(normalScope).text) return normalScope;

    // A different own status URL identifies an embedded tweet. A missing URL
    // or one matching the current permalink can be the top Article shell whose
    // visible headline/body lives outside this tweet container.
    const ownUrl = readOwnStatusUrl(tweet);
    const pageUrl = canonicalPageUrl();
    if (ownUrl && ownUrl !== pageUrl) return normalScope;

    const articleRoot = findArticleScope(control);
    return articleRoot ? { root: articleRoot, mode: 'article' } : normalScope;
  }

  const articleRoot = findArticleScope(control);
  return articleRoot ? { root: articleRoot, mode: 'article' } : null;
}

function capturePost(scope: CaptureScope): Capture | null {
  const url = readTweetUrl(scope);
  if (!url) {
    warn('bookmark ADD detected but the post contained no own status URL; selector may have changed. Capture skipped.');
    return null;
  }

  const { text, isArticle, headline } = readText(scope);
  if (!text) {
    warn('bookmark ADD detected but the post had no own text or Article headline/body; selector may have changed. Capture skipped.');
    return null;
  }

  const author = readAuthor(scope, url);
  const labelText = headline || text;
  const label = isArticle ? `${labelText.slice(0, 90)} (article)` : labelText.slice(0, 80);
  const outboundLinks = readOutboundLinks(scope);
  return {
    url,
    source: 'x_bookmark',
    title: author ? `${author}: ${label}` : label,
    text,
    links: outboundLinks.map((link) => link.url),
    outbound_links: outboundLinks,
    author,
    timestamp: readTimestamp(scope),
    media: readMedia(scope),
    bookmarked_at: new Date().toISOString(),
  };
}

function sendCapture(capture: Capture) {
  log('bookmark ADD captured from live DOM:', capture.url);
  chrome.runtime.sendMessage({ type: 'CAPTURE', capture }, (response) => {
    if (chrome.runtime.lastError) {
      warn('background message failed:', chrome.runtime.lastError.message);
    } else if (!response?.ok) {
      warn(`capture failed${response?.status ? ` (HTTP ${response.status})` : ''}:`, response?.error || response?.result?.error);
    } else {
      log(response.result?.deduplicated ? 'capture already existed; no new row created.' : 'capture stored.', response.result);
    }
  });
}

function onDocumentClick(event: MouseEvent) {
  const target = event.target as Element | null;
  const control = target?.closest('[data-testid="bookmark"], [data-testid="removeBookmark"]');
  if (!control) return;

  if (control.getAttribute('data-testid') === 'removeBookmark') {
    log('un-bookmark detected; ignored by MVP removal policy.');
    return;
  }

  const scope = selectCaptureScope(control);
  if (!scope) {
    warn('bookmark ADD found neither an enclosing tweet nor a canonical Article scope; capture skipped.');
    return;
  }
  const capture = capturePost(scope);
  if (capture) sendCapture(capture);
}

if (document.documentElement.dataset[LISTENER_MARKER] !== 'active') {
  document.documentElement.dataset[LISTENER_MARKER] = 'active';
  document.addEventListener('click', onDocumentClick, true);
  log('X native bookmark listener active (one delegated listener).');
}
