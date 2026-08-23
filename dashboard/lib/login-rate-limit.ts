type Attempt = { count: number; resetAt: number };
const attempts = new Map<string, Attempt>();
const WINDOW_MS = 60_000;
const MAX_FAILURES = 5;

export function loginBlocked(key: string, now = Date.now()): boolean {
  const record = attempts.get(key);
  if (!record || record.resetAt <= now) {
    attempts.delete(key);
    return false;
  }
  return record.count >= MAX_FAILURES;
}

export function recordLoginFailure(key: string, now = Date.now()) {
  const record = attempts.get(key);
  if (!record || record.resetAt <= now) attempts.set(key, { count: 1, resetAt: now + WINDOW_MS });
  else record.count += 1;
}

export function clearLoginFailures(key: string) {
  attempts.delete(key);
}
