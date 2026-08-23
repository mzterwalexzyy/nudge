/**
 * classify(raw_text) - Classify a page into {kind, summary, why_saved}.
 *
 * ONE model call, JSON mode. Includes a repair path for models/situations
 * where strict JSON is not honored (extra prose, code fences, trailing text).
 *
 * kind is one of:
 *   opportunity | article | tool | repo | video | agreement | idea | entertainment
 */

import { aiComplete } from './ai-adapter.mjs';

const VALID_KINDS = [
  'opportunity', 'article', 'tool', 'repo',
  'video', 'agreement', 'idea', 'entertainment',
];

const CLASSIFY_PROMPT = (title, text) => `You are a classifier for a personal "second brain" that stores things a person saves online.

Classify the content below into exactly one kind and write a short summary.

Allowed kinds (choose the single best fit):
- opportunity: hackathons, grants, job posts, contests, applications, anything with a deadline to act on
- article: blog posts, news, essays, documentation, tutorials
- tool: a product, service, app, or SaaS landing page
- repo: a source-code repository (GitHub/GitLab/etc.)
- video: a video page (YouTube, Vimeo, conference talk)
- agreement: terms of service, privacy policy, EULA, subscription terms
- idea: a note, thread, or snippet that is a raw idea or thought
- entertainment: memes, games, casual content with no action needed

Return STRICT JSON with exactly these keys and no others:
{
  "kind": "<one of the allowed kinds>",
  "summary": "<1-2 sentence factual summary of what this is>",
  "why_saved": "<1 sentence: why a person would plausibly save this / what value it holds>",
  "highlights": ["<3 to 5 specific, real takeaways drawn from THIS page>"]
}

Highlights rules:
- For an article: the actual key points made in the piece.
- For a hackathon/opportunity: concrete facts like prize, tech stack, deadline, eligibility.
- Be specific to this page. Do NOT write generic filler like "informative content" or "useful resource".
- Do NOT pad. If there are fewer than 3 genuinely distinct points, return fewer. Never invent points that are not supported by the text.

Do not include markdown, code fences, or any text outside the JSON object.

TITLE: ${title || '(none)'}

CONTENT:
${text}`;

/**
 * Extract the first balanced JSON object from a string.
 * Handles code fences and leading/trailing prose.
 */
function extractJsonObject(s) {
  if (!s) return null;
  let str = s.trim();

  // Strip code fences if present
  str = str.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');

  // Find first { and matching closing brace
  const start = str.indexOf('{');
  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < str.length; i++) {
    const ch = str[i];
    if (escape) { escape = false; continue; }
    if (ch === '\\') { escape = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) {
        return str.slice(start, i + 1);
      }
    }
  }
  return null;
}

function safeParse(raw) {
  // Try direct parse first
  try {
    return JSON.parse(raw);
  } catch {
    // Try extracting a balanced object
    const extracted = extractJsonObject(raw);
    if (extracted) {
      try {
        return JSON.parse(extracted);
      } catch {
        return null;
      }
    }
    return null;
  }
}

/**
 * Classify page text into { kind, summary, why_saved }.
 * @param {string} raw_text
 * @param {object} opts - { title?: string }
 * @returns {Promise<{kind, summary, why_saved, _repaired?: boolean, _error?: string}>}
 */
export async function classify(raw_text, opts = {}) {
  const title = opts.title || '';
  const text = (raw_text || '').slice(0, 8000);

  if (!text || text.trim().length < 20) {
    return {
      kind: null,
      summary: '',
      why_saved: '',
      _error: 'Not enough text to classify',
    };
  }

  const prompt = CLASSIFY_PROMPT(title, text);

  let raw;
  try {
    raw = await aiComplete(prompt, { jsonMode: true, maxTokens: 900 });
  } catch (err) {
    return { kind: null, summary: '', why_saved: '', _error: `Model call failed: ${err.message}` };
  }

  let parsed = safeParse(raw);
  let repaired = false;

  // Repair attempt: ask the model to fix its own output into strict JSON
  if (!parsed || !parsed.kind) {
    repaired = true;
    try {
      const repairPrompt = `The following was supposed to be strict JSON with keys kind, summary, why_saved, highlights (array of 3-5 strings) but may be malformed. Return ONLY corrected strict JSON preserving ALL keys including highlights:\n\n${raw}`;
      const repairRaw = await aiComplete(repairPrompt, { jsonMode: true, maxTokens: 512 });
      parsed = safeParse(repairRaw);
    } catch {
      // fall through
    }
  }

  if (!parsed) {
    return { kind: null, summary: '', why_saved: '', _error: 'Could not parse JSON', _raw: raw };
  }

  // Validate and normalize kind
  let kind = (parsed.kind || '').toLowerCase().trim();
  if (!VALID_KINDS.includes(kind)) {
    // Coerce close matches, else null
    kind = VALID_KINDS.includes(kind) ? kind : (kind || null);
    if (!VALID_KINDS.includes(kind)) kind = 'article'; // safe default rather than crash
  }

  // Normalize highlights: array of non-empty strings, cap at 5, no padding.
  let highlights = [];
  if (Array.isArray(parsed.highlights)) {
    highlights = parsed.highlights
      .filter(h => typeof h === 'string' && h.trim().length > 0)
      .map(h => h.trim())
      .slice(0, 5);
  }

  return {
    kind,
    summary: (parsed.summary || '').trim(),
    why_saved: (parsed.why_saved || '').trim(),
    highlights,
    _repaired: repaired || undefined,
  };
}

export { VALID_KINDS };
