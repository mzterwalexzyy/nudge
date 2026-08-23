import { createHash, randomBytes, randomUUID } from 'crypto';
import { currentSession } from '@/lib/auth';
import { currentAccountId, db } from '@/lib/db';
import type { UserProfile } from '@/lib/db';

function tokenHash(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function getUserById(id: string): UserProfile | undefined {
  return db().prepare('SELECT * FROM users WHERE id = ?').get(id) as UserProfile | undefined;
}

export function getUserByEmail(email: string): UserProfile | undefined {
  return db().prepare('SELECT * FROM users WHERE email = ? COLLATE NOCASE').get(email) as UserProfile | undefined;
}

export function currentUser(): UserProfile | undefined {
  const claims = currentSession();
  if (claims) return getUserById(claims.sub);
  if (process.env.NODE_ENV === 'production') return undefined;
  const id = currentAccountId();
  const stored = getUserById(id);
  if (stored) return stored;
  return {
    id,
    email: null,
    display_name: process.env.NUDGE_DEV_NAME || 'Xklusif',
    password_hash: null,
    account_type: 'development',
    expires_at: null,
    capture_token_hash: null,
    extension_last_seen_at: null,
    created_at: new Date().toISOString(),
  };
}

export function createRegisteredUser(input: { email: string; displayName: string; passwordHash: string }): UserProfile {
  const id = `user-${randomUUID()}`;
  db().prepare(`INSERT INTO users (id, email, display_name, password_hash, account_type)
    VALUES (?, ?, ?, ?, 'user')`).run(id, input.email, input.displayName, input.passwordHash);
  return getUserById(id)!;
}

export function deleteExpiredDemoProfiles(now = new Date()) {
  const database = db();
  const expired = database.prepare(`SELECT id FROM users
    WHERE account_type = 'demo' AND expires_at IS NOT NULL AND expires_at <= ?`)
    .all(now.toISOString()) as Array<{ id: string }>;
  database.transaction(() => {
    for (const { id } of expired) {
      database.prepare('DELETE FROM categories WHERE user_id = ?').run(id);
      database.prepare('DELETE FROM items WHERE user_id = ?').run(id);
      database.prepare('DELETE FROM users WHERE id = ?').run(id);
    }
  })();
  return expired.length;
}

export function createDemoProfile(): UserProfile {
  const database = db();
  deleteExpiredDemoProfiles();
  const id = `demo-${randomUUID()}`;
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  database.transaction(() => {
    database.prepare(`INSERT INTO users (id, display_name, account_type, expires_at)
      VALUES (?, 'Demo Judge', 'demo', ?)`).run(id, expiresAt);

    const configuredSource = process.env.DEMO_SOURCE_ACCOUNT_ID || '';
    const source = configuredSource || (database.prepare(`SELECT i.user_id
      FROM items i
      LEFT JOIN users u ON u.id = i.user_id
      WHERE u.id IS NULL OR u.account_type = 'development'
      GROUP BY i.user_id
      ORDER BY COUNT(*) DESC
      LIMIT 1`).get() as { user_id: string } | undefined)?.user_id;
    if (!source) return;

    const rows = database.prepare('SELECT * FROM items WHERE user_id = ? ORDER BY created_at DESC')
      .all(source) as Array<Record<string, unknown>>;
    const idMap = new Map(rows.map((row) => [String(row.id), randomUUID().replace(/-/g, '')]));
    const columns = (database.prepare('PRAGMA table_info(items)').all() as Array<{ name: string }>).map((column) => column.name);
    const insert = database.prepare(`INSERT INTO items (${columns.map((column) => `"${column}"`).join(', ')})
      VALUES (${columns.map((column) => `@${column}`).join(', ')})`);
    for (const row of rows) {
      const clone = { ...row, id: idMap.get(String(row.id)), user_id: id } as Record<string, unknown>;
      // Insert every fresh ID before restoring self-references. SQLite checks
      // parent_id and duplicate_of immediately, regardless of transaction scope.
      clone.parent_id = null;
      clone.duplicate_of = null;
      insert.run(clone);
    }

    const updateRelationships = database.prepare(`UPDATE items
      SET parent_id = @parent_id, duplicate_of = @duplicate_of
      WHERE id = @id AND user_id = @user_id`);
    for (const row of rows) {
      updateRelationships.run({
        id: idMap.get(String(row.id)),
        user_id: id,
        parent_id: row.parent_id ? idMap.get(String(row.parent_id)) || null : null,
        duplicate_of: row.duplicate_of ? idMap.get(String(row.duplicate_of)) || null : null,
      });
    }

    const categories = database.prepare('SELECT category_key, name FROM categories WHERE user_id = ?').all(source) as Array<{ category_key: string; name: string }>;
    const insertCategory = database.prepare('INSERT INTO categories (user_id, category_key, name) VALUES (?, ?, ?)');
    for (const category of categories) insertCategory.run(id, category.category_key, category.name);
  })();

  return getUserById(id)!;
}

export function createCaptureCredential(userId: string): string {
  const token = randomBytes(32).toString('hex');
  db().prepare('UPDATE users SET capture_token_hash = ?, extension_last_seen_at = NULL WHERE id = ?')
    .run(tokenHash(token), userId);
  return token;
}

export function resolveCaptureCredential(token: string): UserProfile | undefined {
  if (!token) return undefined;
  return db().prepare('SELECT * FROM users WHERE capture_token_hash = ?').get(tokenHash(token)) as UserProfile | undefined;
}

export function markExtensionSeen(userId: string) {
  db().prepare("UPDATE users SET extension_last_seen_at = datetime('now') WHERE id = ?").run(userId);
}

export function createPasswordResetToken(userId: string): string {
  const token = randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
  db().prepare('INSERT INTO password_reset_tokens (token_hash, user_id, expires_at) VALUES (?, ?, ?)')
    .run(tokenHash(token), userId, expiresAt);
  return token;
}

export function consumePasswordResetToken(token: string): { userId: string } | undefined {
  const database = db();
  return database.transaction(() => {
    const row = database.prepare(`SELECT user_id FROM password_reset_tokens
      WHERE token_hash = ? AND used_at IS NULL AND expires_at > ?`)
      .get(tokenHash(token), new Date().toISOString()) as { user_id: string } | undefined;
    if (!row) return undefined;
    database.prepare("UPDATE password_reset_tokens SET used_at = datetime('now') WHERE token_hash = ?")
      .run(tokenHash(token));
    return { userId: row.user_id };
  })();
}
