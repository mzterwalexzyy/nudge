/**
 * embed(text) and findDuplicates(item, existing)
 *
 * embed: returns a vector via aiEmbed (the adapter). With Groq as the active
 * provider there is no native embedding endpoint, so the adapter falls back to
 * a deterministic local pseudo-embedding. Dedup still works but is weaker than
 * true semantic embeddings. This limitation is documented in the honesty ledger.
 *
 * findDuplicates: cosine similarity over embeddings; above threshold -> duplicate.
 */

import { aiEmbed } from './ai-adapter.mjs';

const DEFAULT_THRESHOLD = 0.92;

/**
 * Embed text into a vector.
 * @param {string} text
 * @returns {Promise<number[]>}
 */
export async function embed(text) {
  const input = (text || '').slice(0, 4000);
  if (!input.trim()) return null;
  return aiEmbed(input);
}

/**
 * Cosine similarity between two equal-length numeric vectors.
 */
export function cosineSimilarity(a, b) {
  if (!a || !b || a.length !== b.length) return 0;
  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  if (magA === 0 || magB === 0) return 0;
  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}

function parseEmbedding(raw) {
  if (!raw) return null;
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string') {
    try { return JSON.parse(raw); } catch { return null; }
  }
  return null;
}

/**
 * Find the best duplicate match for an item among existing items.
 * @param {{embedding: number[], url?: string}} item - must have .embedding
 * @param {Array<{id: string, url?: string, embedding: number[]|string}>} existing
 * @param {object} opts - { threshold?: number }
 * @returns {{duplicate_of: string|null, score: number, matchedUrl?: string}}
 */
export function findDuplicates(item, existing, opts = {}) {
  const threshold = opts.threshold ?? DEFAULT_THRESHOLD;
  const vec = parseEmbedding(item.embedding);
  if (!vec) return { duplicate_of: null, score: 0 };

  let best = { duplicate_of: null, score: 0, matchedUrl: undefined };

  for (const other of existing) {
    if (!other || other.id === item.id) continue;
    // Exact URL match is always a duplicate regardless of embedding
    if (item.url && other.url && item.url === other.url) {
      return { duplicate_of: other.id, score: 1, matchedUrl: other.url };
    }
    const otherVec = parseEmbedding(other.embedding);
    if (!otherVec) continue;
    const score = cosineSimilarity(vec, otherVec);
    if (score > best.score) {
      best = { duplicate_of: other.id, score, matchedUrl: other.url };
    }
  }

  if (best.score >= threshold) {
    return best;
  }
  return { duplicate_of: null, score: best.score, matchedUrl: best.matchedUrl };
}

export { DEFAULT_THRESHOLD };
