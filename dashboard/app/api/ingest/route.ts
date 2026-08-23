import { timingSafeEqual } from 'node:crypto';
import path from 'node:path';
import dotenv from 'dotenv';
import * as sharedPipeline from '@second-brain/pipeline';
import { NextRequest, NextResponse } from 'next/server';
import { markExtensionSeen, resolveCaptureCredential } from '@/lib/users';

// Next loads dashboard-local env files. The shared project keeps its $0 local
// configuration one level up, so load that file without ever returning values.
dotenv.config({ path: path.join(process.cwd(), '..', '.env') });

const ALLOWED_SOURCES = new Set([
  'x_bookmark',
  'save_button',
  'paste',
  'agreement',
  'bookmark_backfill',
]);

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

type OutboundLink = {
  url: string;
  label: string;
};

function authorized(req: NextRequest): { ok: true; userId: string } | { ok: false; response: NextResponse } {
  const header = req.headers.get('authorization') || '';
  const supplied = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  const expected = process.env.SECOND_BRAIN_CAPTURE_TOKEN || '';
  const expectedBytes = Buffer.from(expected);
  const suppliedBytes = Buffer.from(supplied);
  const matchesLegacy =
    expectedBytes.length === suppliedBytes.length &&
    expectedBytes.length > 0 &&
    timingSafeEqual(expectedBytes, suppliedBytes);

  if (matchesLegacy) return { ok: true, userId: process.env.SECOND_BRAIN_ACCOUNT_ID || 'local' };

  const profile = resolveCaptureCredential(supplied);
  if (profile && (!profile.expires_at || profile.expires_at > new Date().toISOString())) {
    markExtensionSeen(profile.id);
    return { ok: true, userId: profile.id };
  }

  return {
    ok: false,
    response: NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: CORS }),
  };
}

function cleanString(value: unknown, maxLength: number): string {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

function cleanStringArray(value: unknown, maxEntries: number, maxLength: number): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((entry): entry is string => typeof entry === 'string')
    .map((entry) => entry.trim().slice(0, maxLength))
    .filter(Boolean)
    .slice(0, maxEntries);
}

function cleanOutboundLinks(value: unknown): OutboundLink[] {
  if (!Array.isArray(value)) return [];
  const links = new Map<string, OutboundLink>();
  for (const entry of value) {
    if (!entry || typeof entry !== 'object') continue;
    const rawUrl = cleanString((entry as Record<string, unknown>).url, 2048);
    const label = cleanString((entry as Record<string, unknown>).label, 300);
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
      // Malformed or unsafe client metadata is discarded at the boundary.
    }
    if (links.size >= 20) break;
  }
  return [...links.values()];
}

function captureSummary(item: any) {
  return {
    id: item.id,
    kind: item.kind,
    title: item.title,
    deadline: item.deadline,
    date_confidence: item.date_confidence,
    attention: item.attention,
  };
}

function applyMetadata(item: any, metadata: Record<string, unknown>) {
  Object.assign(item, metadata);
  return item;
}

/**
 * Authenticated ingestion boundary used by the extension.
 *
 * X captures prefer readable content from the first public outbound link. If
 * that fetch is blocked, short, or unsafe, the live tweet DOM text is used and
 * the fallback reason is persisted. Agreement pages are fetched server-side
 * first and use supplied DOM text only as an explicit fallback.
 */
export async function POST(req: NextRequest) {
  const auth = authorized(req);
  if (!auth.ok) return auth.response;

  try {
    const body = await req.json();
    const url = cleanString(body?.url, 2048);
    const source = cleanString(body?.source || 'x_bookmark', 40);
    const title = cleanString(body?.title, 500);
    const text = cleanString(body?.text, 12_000);
    const outboundLinks = cleanOutboundLinks(body?.outbound_links);
    const links = [...new Set([
      ...outboundLinks.map((link) => link.url),
      ...cleanStringArray(body?.links, 20, 2048),
    ])].slice(0, 20);
    const media = cleanStringArray(body?.media, 20, 2048);
    const author = cleanString(body?.author, 200) || null;
    const bookmarkedAt = cleanString(body?.bookmarked_at, 64) || new Date().toISOString();

    if (!url) return NextResponse.json({ error: 'url is required' }, { status: 400, headers: CORS });
    try {
      const parsed = new URL(url);
      if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error();
    } catch {
      return NextResponse.json({ error: 'url must be HTTP(S)' }, { status: 400, headers: CORS });
    }
    if (!ALLOWED_SOURCES.has(source)) {
      return NextResponse.json({ error: 'invalid source' }, { status: 400, headers: CORS });
    }
    if (source === 'bookmark_backfill') {
      return NextResponse.json(
        { error: 'Retroactive X bookmark backfill is a disabled premium feature.' },
        { status: 403, headers: CORS },
      );
    }
    if (source === 'x_bookmark' && !text) {
      return NextResponse.json(
        { error: 'Live tweet DOM text is required; capture was not fabricated.' },
        { status: 400, headers: CORS },
      );
    }

    const pipeline = sharedPipeline;
    const db = sharedPipeline;
    const agreement = sharedPipeline;
    const safeIngest = sharedPipeline;
    db.initSchema();
    db.migrateSchema();
    db.migrateColumns();

    const duplicate = db.getItemByCaptureKey(url, source, auth.userId);
    if (duplicate) {
      return NextResponse.json(
        { ok: true, deduplicated: true, parent: captureSummary(duplicate), children: [] },
        { headers: CORS },
      );
    }

    const existing = db.getItemsWithEmbeddings(auth.userId);
    let preText: { title: string; raw_text: string; links: string[] };
    let linkedUrl: string | null = null;
    let linkedFetchStatus = 'not_applicable';

    if (source === 'x_bookmark') {
      const candidate = safeIngest.selectOutboundLink(links);
      preText = { title: title || author || 'Bookmarked tweet', raw_text: text, links };

      if (candidate) {
        linkedUrl = candidate;
        const linked = await safeIngest.safeIngest(candidate);
        if (linked.ok && linked.raw_text.length >= 100) {
          linkedUrl = linked.final_url || candidate;
          linkedFetchStatus = 'resolved';
          preText = {
            title: title || linked.title || 'Bookmarked link',
            raw_text: [
              `BOOKMARKED TWEET${author ? ` BY ${author}` : ''}: ${text}`,
              `LINKED PAGE (${linkedUrl}): ${linked.raw_text}`,
            ].join('\n\n'),
            links: linked.links || links,
          };
        } else {
          linkedFetchStatus = `fallback:${linked.error || 'unreadable linked page'}`.slice(0, 500);
        }
      } else {
        linkedFetchStatus = 'no_outbound_link';
      }
    } else {
      const fetched = await safeIngest.safeIngest(url);
      if (fetched.ok && fetched.raw_text.length >= 100) {
        linkedFetchStatus = 'page_fetched';
        preText = { title: fetched.title || title, raw_text: fetched.raw_text, links: fetched.links || links };
      } else if (text) {
        linkedFetchStatus = `fallback:${fetched.error || 'unreadable page'}`.slice(0, 500);
        preText = { title, raw_text: text, links };
      } else {
        return NextResponse.json(
          { error: `Page could not be read: ${fetched.error || 'no readable text'}` },
          { status: 422, headers: CORS },
        );
      }
    }

    const metadata = {
      user_id: auth.userId,
      bookmarked_at: bookmarkedAt,
      author,
      media,
      linked_url: linkedUrl,
      linked_fetch_status: linkedFetchStatus,
      outbound_links: outboundLinks,
    };

    if (source === 'agreement') {
      const item = await pipeline.processItem(url, {
        source,
        existing,
        checkLive: false,
        preText,
      });
      const analysis = await agreement.classifyAgreement(item.raw_text);
      if (analysis._error || analysis.clauses.length < 3) {
        return NextResponse.json(
          { error: analysis._error || 'Agreement analysis returned fewer than 3 supported clauses.' },
          { status: 502, headers: CORS },
        );
      }

      item.kind = 'agreement';
      item.clauses = analysis.clauses;
      item.attention = analysis.clauses.some((clause: any) => clause.level === 'high')
        ? 'important'
        : 'review';
      const saved = db.insertItem(applyMetadata(item, metadata));
      return NextResponse.json(
        {
          ok: true,
          deduplicated: false,
          content_source: linkedFetchStatus,
          parent: captureSummary(saved),
          children: [],
          clauses: analysis.clauses,
        },
        { headers: CORS },
      );
    }

    // A single bookmarked tweet is saved as exactly one item. List fan-out
    // (one saved thing -> many tracked entries) is reserved for deliberate
    // paste/save_button roundups, so bookmarking never explodes into several
    // inbox rows from a linked page that happens to list things.
    if (source === 'x_bookmark') {
      const item = await pipeline.processItem(url, {
        source,
        existing,
        checkLive: false,
        preText,
      });
      const saved = db.insertItem(applyMetadata(item, metadata));
      return NextResponse.json(
        {
          ok: true,
          deduplicated: false,
          content_source: linkedFetchStatus,
          linked_url: linkedUrl,
          parent: captureSummary(saved),
          children: [],
        },
        { headers: CORS },
      );
    }

    const { parent, children } = await pipeline.processItemTree(url, {
      source,
      existing,
      checkLive: false,
      preText,
      fetchLinks: true,
    });

    const savedParent = db.insertItem(applyMetadata(parent, metadata));
    const savedChildren = children.map((child: any) => {
      child.parent_id = savedParent.id;
      return db.insertItem(applyMetadata(child, metadata));
    });

    return NextResponse.json(
      {
        ok: true,
        deduplicated: false,
        content_source: linkedFetchStatus,
        linked_url: linkedUrl,
        parent: captureSummary(savedParent),
        children: savedChildren.map(captureSummary),
      },
      { headers: CORS },
    );
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Ingestion failed' },
      { status: 500, headers: CORS },
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}
