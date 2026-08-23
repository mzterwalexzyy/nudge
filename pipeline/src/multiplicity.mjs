/**
 * detectMultiplicity(raw_text, links) - Amendment 2, Change 2.
 *
 * Decides whether a saved page is ONE item or a LIST/roundup of many distinct
 * items (e.g. "Top 15 hackathons this month"). Runs AFTER ingest, BEFORE the
 * normal classify path.
 *
 * Returns:
 *   { type: 'single' }
 *   { type: 'list', entries: [ { title, link|null, raw_snippet }, ... ] }
 *
 * Hard rules:
 *   - If unsure or extraction looks like garbage, return { type: 'single' }
 *     so the caller falls back to a normal single 'article' item. Never throw.
 *   - Cap entries at MAX_ENTRIES; caller notes truncation.
 */

import { aiComplete } from './ai-adapter.mjs';

export const MAX_ENTRIES = 20;

const PROMPT = (text, links) => `You are analyzing saved web content to decide its structure.

Decide: is this ONE single item (one article, one tool, one hackathon, one video),
or is it a LIST/ROUNDUP of MANY distinct items (e.g. "Top 15 hackathons", "10 tools
for X", a newsletter linking several opportunities)?

If it is a list of many distinct trackable things, extract each entry.

Return STRICT JSON, no prose, no code fences:
{
  "type": "single" | "list",
  "entries": [
    { "title": "<name of this entry>", "link": "<url if one is present in the text, else null>", "raw_snippet": "<the sentence(s) about this entry, including any date>" }
  ]
}

Rules:
- "single" if it is fundamentally about one thing. Return an empty entries array.
- "list" ONLY if there are 3 or more clearly distinct items each worth tracking separately.
- Each entry's raw_snippet must be copied/paraphrased from the actual text, including any date mentioned. Do NOT invent entries or dates.
- If you are unsure, choose "single".

Known links found on the page (may help match entries): ${links && links.length ? links.slice(0, 30).join(', ') : '(none)'}

CONTENT:
${text}`;

function extractJsonObject(s) {
  if (!s) return null;
  let str = s.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
  const start = str.indexOf('{');
  if (start === -1) return null;
  let depth = 0, inString = false, escape = false;
  for (let i = start; i < str.length; i++) {
    const ch = str[i];
    if (escape) { escape = false; continue; }
    if (ch === '\\') { escape = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === '{') depth++;
    else if (ch === '}') { depth--; if (depth === 0) return str.slice(start, i + 1); }
  }
  return null;
}

function safeParse(raw) {
  try { return JSON.parse(raw); }
  catch {
    const ex = extractJsonObject(raw);
    if (ex) { try { return JSON.parse(ex); } catch { return null; } }
    return null;
  }
}

/**
 * @param {string} raw_text
 * @param {string[]} links - outbound links found on the page
 * @returns {Promise<{type:'single'} | {type:'list', entries:Array, _truncated?:boolean, _fallback?:string}>}
 */
export async function detectMultiplicity(raw_text, links = []) {
  const text = (raw_text || '').slice(0, 10000);
  if (!text || text.trim().length < 100) {
    return { type: 'single', _fallback: 'insufficient text' };
  }

  let raw;
  try {
    raw = await aiComplete(PROMPT(text, links), { jsonMode: true, maxTokens: 2000 });
  } catch (err) {
    // Model failure -> safe fallback to single
    return { type: 'single', _fallback: `model error: ${err.message}` };
  }

  const parsed = safeParse(raw);
  if (!parsed || (parsed.type !== 'single' && parsed.type !== 'list')) {
    return { type: 'single', _fallback: 'unparseable multiplicity response' };
  }

  if (parsed.type === 'single') {
    return { type: 'single' };
  }

  // Validate list entries
  let entries = Array.isArray(parsed.entries) ? parsed.entries : [];
  entries = entries
    .filter(e => e && typeof e.title === 'string' && e.title.trim().length > 0)
    .map(e => ({
      title: e.title.trim(),
      link: (typeof e.link === 'string' && /^https?:\/\//i.test(e.link)) ? e.link.trim() : null,
      raw_snippet: typeof e.raw_snippet === 'string' ? e.raw_snippet.trim() : '',
    }));

  // Fallback: a "list" with <3 entries is not a real list.
  if (entries.length < 3) {
    return { type: 'single', _fallback: `list had only ${entries.length} valid entries` };
  }

  let truncated = false;
  if (entries.length > MAX_ENTRIES) {
    entries = entries.slice(0, MAX_ENTRIES);
    truncated = true;
  }

  return { type: 'list', entries, _truncated: truncated || undefined };
}
