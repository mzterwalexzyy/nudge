/**
 * extractDates(text, kind) - Extract a deadline and whether action is required.
 *
 * Understands relative phrases ("closes in 8 days", "applications due next Friday")
 * by anchoring against a provided "now" date. Returns a normalized ISO date
 * (YYYY-MM-DD) or null.
 *
 * Returns: { deadline: string|null, action_required: boolean, _reason?: string }
 */

import { aiComplete } from './ai-adapter.mjs';

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const PROMPT = (text, kind, todayISO) => `Today's date is ${todayISO}.

You are extracting deadline information from saved web content.

Content kind: ${kind || 'unknown'}

Rules:
- A "deadline" is a specific future date by which a person must act (application closes, registration ends, submission due, early-bird ends, event start if attendance requires signup).
- Understand relative phrases and resolve them against today's date (${todayISO}). Examples: "closes in 8 days", "due next Friday", "ends this month".
- If the content mentions a date that already passed relative to today, still return it (the system decides expiry).
- If there is NO real deadline, return null. Do NOT invent a date. Articles, tools, repos, and videos usually have no deadline.
- action_required is true only if the user must DO something by the deadline (apply, register, submit, cancel). Reading an article is not action_required.

Return STRICT JSON, no prose, no code fences:
{
  "deadline": "YYYY-MM-DD or null",
  "date_confidence": "explicit | inferred | none",
  "action_required": true or false,
  "reason": "<short justification: quote the phrase you used, or say 'no deadline found'>"
}

date_confidence rules:
- "explicit": the page states an exact date or a clear relative phrase you resolved (e.g. "September 14, 2026" or "closes in 8 days").
- "inferred": you estimated a date from vague wording (e.g. "later this fall"). Use sparingly.
- "none": no deadline found. deadline MUST be null in this case.
Never guess a specific date and call it explicit. A missing date is better than a wrong one.

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
 * @param {string} text
 * @param {string|null} kind
 * @param {object} opts - { now?: Date }
 * @returns {Promise<{deadline: string|null, action_required: boolean, _reason?: string, _error?: string}>}
 */
export async function extractDates(text, kind, opts = {}) {
  const now = opts.now instanceof Date ? opts.now : new Date();
  const todayISO = now.toISOString().slice(0, 10);
  const body = (text || '').slice(0, 8000);

  if (!body || body.trim().length < 20) {
    return { deadline: null, action_required: false, _reason: 'insufficient text' };
  }

  let raw;
  try {
    raw = await aiComplete(PROMPT(body, kind, todayISO), { jsonMode: true, maxTokens: 500 });
  } catch (err) {
    return { deadline: null, action_required: false, _error: `Model call failed: ${err.message}` };
  }

  let parsed = safeParse(raw);

  // Repair pass: if the model returned malformed/truncated JSON, ask it to fix it.
  if (!parsed || !('deadline' in parsed)) {
    try {
      const repairRaw = await aiComplete(
        `Fix this into strict JSON with keys deadline (YYYY-MM-DD or null), action_required (boolean), reason (string). Return ONLY JSON:\n\n${raw}`,
        { jsonMode: true, maxTokens: 500 }
      );
      parsed = safeParse(repairRaw);
    } catch { /* fall through */ }
  }

  if (!parsed) {
    return { deadline: null, action_required: false, _error: 'Could not parse JSON', _raw: raw };
  }

  // Normalize deadline
  let deadline = parsed.deadline;
  if (deadline === 'null' || deadline === '' || deadline == null) {
    deadline = null;
  } else if (typeof deadline === 'string') {
    deadline = deadline.trim();
    // Accept YYYY-MM-DD; if it's a fuller ISO, slice the date portion
    if (!ISO_DATE_RE.test(deadline)) {
      const maybe = deadline.slice(0, 10);
      deadline = ISO_DATE_RE.test(maybe) ? maybe : null;
    }
  } else {
    deadline = null;
  }

  // Normalize date_confidence and enforce the invariant: no date => 'none'.
  let dateConfidence = (parsed.date_confidence || '').toLowerCase().trim();
  if (!['explicit', 'inferred', 'none'].includes(dateConfidence)) {
    dateConfidence = deadline ? 'inferred' : 'none';
  }
  if (!deadline) dateConfidence = 'none';

  return {
    deadline,
    date_confidence: dateConfidence,
    action_required: Boolean(parsed.action_required),
    _reason: parsed.reason || undefined,
  };
}
