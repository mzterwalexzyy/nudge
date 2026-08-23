/**
 * assignAttention(item, now) - Derive an attention level from deadline
 * proximity and action_required. Pure function, no model call.
 *
 * Levels: low | review | important | high
 *
 * Rules (deadline-driven):
 *   - deadline within <= 2 days (and not passed)  -> high
 *   - deadline within <= 7 days                   -> important
 *   - deadline within <= 30 days                  -> review
 *   - deadline further out                        -> review (still worth surfacing)
 *   - deadline already passed                     -> low (expiry handled elsewhere)
 * If no deadline:
 *   - action_required true                        -> review
 *   - otherwise                                   -> low
 */

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * @param {{deadline?: string|null, action_required?: boolean}} item
 * @param {Date} [now]
 * @returns {'low'|'review'|'important'|'high'}
 */
export function assignAttention(item, now = new Date()) {
  const { deadline, action_required, date_confidence } = item || {};
  // Per Amendment 2: only an EXPLICIT date may drive 'high' attention.
  // A missing confidence defaults to 'explicit' for backward-compat with
  // Phase 1 items that predate the field (their dates were quoted from source).
  const confidence = date_confidence || 'explicit';

  if (deadline) {
    const dl = new Date(deadline + 'T23:59:59');
    if (!isNaN(dl.getTime())) {
      const diffDays = Math.floor((dl.getTime() - now.getTime()) / DAY_MS);

      if (diffDays < 0) {
        return 'low'; // passed; expiry status handled by pipeline/sanitize
      }
      if (diffDays <= 2) return confidence === 'explicit' ? 'high' : 'important';
      if (diffDays <= 7) return 'important';
      if (diffDays <= 30) return 'review';
      return 'review';
    }
  }

  if (action_required) return 'review';
  return 'low';
}

/**
 * Helper: days remaining until deadline (negative if passed), or null.
 */
export function daysUntil(deadline, now = new Date()) {
  if (!deadline) return null;
  const dl = new Date(deadline + 'T23:59:59');
  if (isNaN(dl.getTime())) return null;
  return Math.floor((dl.getTime() - now.getTime()) / DAY_MS);
}
