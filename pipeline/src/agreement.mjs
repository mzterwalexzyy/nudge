/**
 * classifyAgreement(raw_text) - Phase 2 (Mode B).
 *
 * Reads a Terms/Privacy/Subscription page and returns the 3-5 clauses that
 * actually matter to a normal person, ranked by level.
 *
 * Each clause: { label, level, plain_explanation }
 *   level in { low, review, important, high }
 *
 * Tone is enforced by the prompt: measured, factual, explains WHY a clause
 * matters. Never alarmist, never "this company is evil". Capped at 5.
 *
 * Reuses the same AI adapter as the rest of the pipeline (no special model).
 */

import { aiComplete } from './ai-adapter.mjs';

const LEVELS = ['low', 'review', 'important', 'high'];

const PROMPT = (text) => `You are helping a normal, non-lawyer person understand a legal agreement (Terms of Service, Privacy Policy, or Subscription terms) BEFORE they agree to it.

Identify the 3 to 5 clauses that most affect a regular user. Focus on things people actually care about:
- automatic renewal / hard-to-cancel subscriptions
- how personal data is collected, sold, or shared
- content licensing (does the service claim rights to what you upload?)
- mandatory arbitration / waiving the right to sue or join a class action
- unilateral changes to terms
- account termination and data deletion
- liability limits that shift risk onto the user

Tone rules (strict):
- Measured and factual. Explain WHY each clause matters to the user in plain language.
- Never alarmist. Never say a company is "evil", "shady", or "out to get you".
- Do not moralize. State what the clause does and its practical effect.

Assign each clause a level:
- high: significant, hard-to-reverse impact (e.g. binding arbitration, broad content license, sells personal data)
- important: worth knowing before agreeing (auto-renewal, unilateral term changes)
- review: standard but good to be aware of
- low: routine, minor

Return STRICT JSON, no prose, no code fences. At most 5 clauses, ordered highest level first:
{
  "clauses": [
    { "label": "<short name of the clause>", "level": "high|important|review|low", "plain_explanation": "<1-2 sentences: what it means and why it matters to you>" }
  ]
}

AGREEMENT TEXT:
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

const LEVEL_RANK = { high: 3, important: 2, review: 1, low: 0 };

/**
 * @param {string} raw_text
 * @returns {Promise<{clauses: Array<{label,level,plain_explanation}>, _error?: string}>}
 */
export async function classifyAgreement(raw_text) {
  const text = (raw_text || '').slice(0, 12000);
  if (!text || text.trim().length < 100) {
    return { clauses: [], _error: 'Not enough text to analyze' };
  }

  let raw;
  try {
    raw = await aiComplete(PROMPT(text), { jsonMode: true, maxTokens: 1200 });
  } catch (err) {
    return { clauses: [], _error: `Model call failed: ${err.message}` };
  }

  let parsed = safeParse(raw);

  // Repair pass
  if (!parsed || !Array.isArray(parsed.clauses)) {
    try {
      const repairRaw = await aiComplete(
        `Fix this into strict JSON with a "clauses" array of {label, level, plain_explanation}. Return ONLY JSON:\n\n${raw}`,
        { jsonMode: true, maxTokens: 1200 }
      );
      parsed = safeParse(repairRaw);
    } catch { /* fall through */ }
  }

  if (!parsed || !Array.isArray(parsed.clauses)) {
    return { clauses: [], _error: 'Could not parse clauses', _raw: raw };
  }

  // Normalize, validate levels, cap at 5, sort by severity
  let clauses = parsed.clauses
    .filter(c => c && c.label && c.plain_explanation)
    .map(c => ({
      label: String(c.label).trim(),
      level: LEVELS.includes((c.level || '').toLowerCase()) ? c.level.toLowerCase() : 'review',
      plain_explanation: String(c.plain_explanation).trim(),
    }));

  clauses.sort((a, b) => (LEVEL_RANK[b.level] ?? 0) - (LEVEL_RANK[a.level] ?? 0));
  clauses = clauses.slice(0, 5);

  return { clauses };
}

export { LEVELS };
