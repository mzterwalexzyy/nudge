/**
 * Pipeline orchestrator.
 *
 * processItem(url)     - the single-item chain (Phase 1), UNCHANGED behavior
 *                        for non-list saves:
 *   ingest -> classify -> extractDates -> assignAttention -> embed
 *          -> findDuplicates -> checkLiveness
 *
 * processItemTree(url) - Amendment 2. Runs detectMultiplicity first:
 *   - 'single' -> delegates to processItem (identical path, no change)
 *   - 'list'   -> builds a 'collection' PARENT + one CHILD per entry, each
 *                 child run through the SAME classify/extractDates/attention chain.
 *
 * The SAME chain runs for pasted URLs, bookmarked tweets, and linked pages.
 * Nothing is special-cased per source.
 */

import { ingest, extractFromHtml } from './ingest.mjs';
import { classify } from './classify.mjs';
import { extractDates } from './extract-dates.mjs';
import { assignAttention, daysUntil } from './attention.mjs';
import { embed } from './embed.mjs';
import { findDuplicates } from './embed.mjs';
import { checkLiveness } from './liveness.mjs';
import { detectMultiplicity, MAX_ENTRIES } from './multiplicity.mjs';

function blankItem(url, source) {
  return {
    url,
    source,
    title: '',
    raw_text: '',
    kind: null,
    summary: '',
    why_saved: '',
    highlights: [],
    deadline: null,
    date_confidence: 'none',
    action_required: false,
    attention: 'low',
    status: 'inbox',
    embedding: null,
    duplicate_of: null,
    parent_id: null,
    clauses: null,
    _notes: [],
  };
}

/**
 * Run classify + extractDates + assignAttention on already-extracted text.
 * Shared by the single path and each list child so behavior is identical.
 */
async function enrich(item, now) {
  const notes = item._notes;

  const cls = await classify(item.raw_text, { title: item.title });
  item.kind = cls.kind;
  item.summary = cls.summary;
  item.why_saved = cls.why_saved;
  item.highlights = cls.highlights || [];
  if (cls._error) notes.push(`classify: ${cls._error}`);
  if (cls._repaired) notes.push('classify: JSON repaired');

  const dates = await extractDates(item.raw_text, item.kind, { now });
  item.deadline = dates.deadline;
  item.date_confidence = dates.date_confidence || 'none';
  item.action_required = dates.action_required;
  if (dates._reason) item._date_reason = dates._reason;
  if (dates._error) notes.push(`extractDates: ${dates._error}`);

  item.attention = assignAttention(item, now);
  item._days_until = daysUntil(item.deadline, now);

  if (item.deadline && item._days_until != null && item._days_until < 0) {
    item.status = 'expired';
    notes.push('deadline already passed -> expired');
  }

  return item;
}

/**
 * The single-item chain. Unchanged from Phase 1 (now also fills highlights
 * and date_confidence). Non-list saves go through here.
 */
export async function processItem(url, opts = {}) {
  const now = opts.now instanceof Date ? opts.now : new Date();
  const source = opts.source || 'paste';
  const existing = opts.existing || [];
  const checkLive = opts.checkLive !== false;

  const item = blankItem(url, source);
  const notes = item._notes;

  // 1. Ingest (or use pre-supplied text, e.g. tweet DOM payload)
  let ingestResult;
  if (opts.preText && opts.preText.raw_text) {
    ingestResult = {
      url,
      title: opts.preText.title || '',
      raw_text: opts.preText.raw_text,
      links: opts.preText.links || [],
      ok: true,
    };
  } else {
    ingestResult = await ingest(url);
  }

  item.title = ingestResult.title || '';
  item.raw_text = ingestResult.raw_text || '';
  item._links = ingestResult.links || [];

  if (!ingestResult.ok) {
    notes.push(`ingest failed: ${ingestResult.error || 'unknown'}`);
    if (checkLive) {
      const live = await checkLiveness(url);
      if (live.dead) { item.status = 'dead'; notes.push('link is dead (404/410)'); }
    }
    return item;
  }

  // 2-4. classify + extractDates + attention
  await enrich(item, now);

  // 5. Embed
  try {
    item.embedding = await embed(item.raw_text || item.title);
  } catch (err) {
    notes.push(`embed failed: ${err.message}`);
  }

  // 6. Dedup
  if (item.embedding && existing.length) {
    const dup = findDuplicates(item, existing);
    if (dup.duplicate_of) {
      item.duplicate_of = dup.duplicate_of;
      item.status = 'duplicate';
      notes.push(`duplicate of ${dup.duplicate_of} (score ${dup.score.toFixed(3)})`);
    }
  }

  // 7. Liveness
  if (checkLive) {
    const live = await checkLiveness(url);
    if (live.dead) {
      item.status = 'dead';
      notes.push('link is dead (404/410)');
    }
  }

  return item;
}

/**
 * Amendment 2: multiplicity-aware entry point.
 *
 * Returns { parent, children } where:
 *   - single item:  { parent: <item>, children: [] }
 *   - list:         { parent: <collection item>, children: [<child items>] }
 *
 * The caller persists parent first (to get its id), sets child.parent_id, then
 * persists children.
 *
 * @param {string} url
 * @param {object} opts - same as processItem, plus:
 *   fetchLinks?: boolean   // fetch each entry's outbound link (default true)
 */
export async function processItemTree(url, opts = {}) {
  const now = opts.now instanceof Date ? opts.now : new Date();
  const source = opts.source || 'paste';
  const checkLive = opts.checkLive !== false;
  const fetchLinks = opts.fetchLinks !== false;

  // Ingest once at the top so we can inspect text + links.
  let ingestResult;
  if (opts.preText && opts.preText.raw_text) {
    ingestResult = {
      url, title: opts.preText.title || '', raw_text: opts.preText.raw_text,
      links: opts.preText.links || [], ok: true,
    };
  } else {
    ingestResult = await ingest(url);
  }

  // If ingest failed, fall back to the single path (which records the failure).
  if (!ingestResult.ok) {
    const single = await processItem(url, { ...opts, now });
    return { parent: single, children: [] };
  }

  // Decide single vs list.
  const mult = await detectMultiplicity(ingestResult.raw_text, ingestResult.links || []);

  if (mult.type === 'single') {
    // Unchanged single path. Pass the already-ingested text to avoid re-fetch.
    const single = await processItem(url, {
      ...opts, now,
      preText: { title: ingestResult.title, raw_text: ingestResult.raw_text, links: ingestResult.links },
    });
    if (mult._fallback) single._notes.push(`multiplicity fallback: ${mult._fallback}`);
    return { parent: single, children: [] };
  }

  // --- LIST PATH: build a 'collection' parent + children ---
  const parent = blankItem(url, source);
  parent.title = ingestResult.title || '(untitled list)';
  parent.raw_text = ingestResult.raw_text || '';
  parent.kind = 'collection';
  parent.status = 'organized'; // parent lists live in Organized
  parent._links = ingestResult.links || [];

  // Give the parent a whole-list summary + highlights via the normal classifier.
  const parentCls = await classify(parent.raw_text, { title: parent.title });
  parent.summary = parentCls.summary || `A collection of ${mult.entries.length} items.`;
  parent.why_saved = parentCls.why_saved || 'A roundup worth breaking into individual items.';
  parent.highlights = parentCls.highlights || [];
  parent.kind = 'collection'; // enforce (classifier may have guessed 'article')

  try {
    parent.embedding = await embed(parent.raw_text || parent.title);
  } catch (err) {
    parent._notes.push(`embed failed: ${err.message}`);
  }

  if (mult._truncated) {
    parent._notes.push(`list truncated to ${MAX_ENTRIES} entries (more were present)`);
  }
  parent._notes.push(`list detected: ${mult.entries.length} entries`);

  // Build children.
  const children = [];
  for (const entry of mult.entries) {
    const child = blankItem(entry.link || url, source);
    child._entryTitle = entry.title;

    // Prefer fetching the entry's own link for accuracy; else use the snippet.
    let usedLink = false;
    if (fetchLinks && entry.link) {
      const linkIngest = await ingest(entry.link);
      if (linkIngest.ok && linkIngest.raw_text.length > 100) {
        child.title = linkIngest.title || entry.title;
        child.raw_text = linkIngest.raw_text;
        usedLink = true;
      } else {
        child._notes.push(`linked page unreadable (${linkIngest.error || 'short'}), used snippet`);
      }
    }

    if (!usedLink) {
      child.url = entry.link || url;
      child.title = entry.title;
      // Use the entry snippet as the text to classify/date.
      child.raw_text = `${entry.title}. ${entry.raw_snippet || ''}`.trim();
    }

    await enrich(child, now);

    // Child of a collection: never expire the child just because parent path;
    // keep its own status. Embed for dedup/consistency.
    try {
      child.embedding = await embed(child.raw_text || child.title);
    } catch (err) {
      child._notes.push(`embed failed: ${err.message}`);
    }

    if (usedLink && checkLive) {
      const live = await checkLiveness(child.url);
      if (live.dead) { child.status = 'dead'; child._notes.push('link is dead (404/410)'); }
    }

    children.push(child);
  }

  return { parent, children };
}

export { ingest, extractFromHtml, classify, extractDates, assignAttention, daysUntil, embed, findDuplicates, checkLiveness, detectMultiplicity };
