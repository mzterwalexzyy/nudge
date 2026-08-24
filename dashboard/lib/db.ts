/** Server-only SQLite access for the dashboard and cleanup endpoint. */

import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { randomBytes, randomUUID, createHash } from 'crypto';
import { currentSession } from '@/lib/auth';

export type Item = {
  id: string;
  url: string;
  title: string | null;
  raw_text: string | null;
  source: string;
  kind: string | null;
  summary: string | null;
  why_saved: string | null;
  highlights: string | null;
  deadline: string | null;
  date_confidence: 'explicit' | 'inferred' | 'none' | null;
  action_required: number;
  attention: 'low' | 'review' | 'important' | 'high';
  status: string;
  embedding: string | null;
  created_at: string;
  last_seen_at: string;
  last_opened_at: string | null;
  duplicate_of: string | null;
  parent_id: string | null;
  clauses: string | null;
  user_id: string;
  bookmarked_at: string | null;
  author: string | null;
  media: string | null;
  linked_url: string | null;
  linked_fetch_status: string | null;
  outbound_links: string | null;
  category_key: string | null;
};

export type UserProfile = {
  id: string;
  email: string | null;
  display_name: string;
  password_hash: string | null;
  account_type: 'user' | 'demo' | 'development';
  expires_at: string | null;
  capture_token_hash: string | null;
  extension_last_seen_at: string | null;
  created_at: string;
};

let _db: any = null;

export function currentAccountId(): string {
  const session = currentSession();
  if (session?.sub) return session.sub;
  if (process.env.NODE_ENV !== 'production') return process.env.SECOND_BRAIN_ACCOUNT_ID || 'local';
  return '__anonymous__';
}

export function db(): any {
  if (_db) return _db;
  const dbPath = process.env.DB_PATH || path.join(process.cwd(), '..', 'pipeline', 'data', 'second-brain.db');
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  _db = new Database(dbPath);
  _db.pragma('journal_mode = WAL');
  _db.pragma('foreign_keys = ON');
  ensureSchema(_db);
  return _db;
}

function ensureSchema(database: any) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS items (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      url TEXT NOT NULL,
      title TEXT,
      raw_text TEXT,
      source TEXT NOT NULL,
      kind TEXT,
      summary TEXT,
      why_saved TEXT,
      highlights TEXT,
      deadline TEXT,
      date_confidence TEXT DEFAULT 'none',
      action_required INTEGER DEFAULT 0,
      attention TEXT DEFAULT 'low',
      status TEXT DEFAULT 'inbox',
      embedding TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      last_seen_at TEXT DEFAULT (datetime('now')),
      last_opened_at TEXT,
      duplicate_of TEXT,
      parent_id TEXT,
      clauses TEXT,
      user_id TEXT NOT NULL DEFAULT 'local',
      bookmarked_at TEXT,
      author TEXT,
      media TEXT,
      linked_url TEXT,
      linked_fetch_status TEXT,
      outbound_links TEXT,
      category_key TEXT
    );
  `);

  database.exec(`
    CREATE TABLE IF NOT EXISTS categories (
      user_id TEXT NOT NULL,
      category_key TEXT NOT NULL,
      name TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      PRIMARY KEY (user_id, category_key)
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_categories_user_name
      ON categories(user_id, name COLLATE NOCASE);
  `);

  database.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE COLLATE NOCASE,
      display_name TEXT NOT NULL,
      password_hash TEXT,
      account_type TEXT NOT NULL DEFAULT 'user' CHECK (account_type IN ('user','demo','development')),
      expires_at TEXT,
      capture_token_hash TEXT UNIQUE,
      extension_last_seen_at TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      token_hash TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      used_at TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    CREATE INDEX IF NOT EXISTS idx_reset_user ON password_reset_tokens(user_id);
  `);

  const existing = new Set(
    database.prepare('PRAGMA table_info(items)').all().map((column: { name: string }) => column.name),
  );
  const additions: Array<[string, string]> = [
    ['highlights', 'TEXT'],
    ['date_confidence', "TEXT DEFAULT 'none'"],
    ['parent_id', 'TEXT'],
    ['user_id', "TEXT NOT NULL DEFAULT 'local'"],
    ['bookmarked_at', 'TEXT'],
    ['author', 'TEXT'],
    ['media', 'TEXT'],
    ['linked_url', 'TEXT'],
    ['linked_fetch_status', 'TEXT'],
    ['outbound_links', 'TEXT'],
    ['category_key', 'TEXT'],
  ];
  for (const [name, definition] of additions) {
    if (!existing.has(name)) database.exec(`ALTER TABLE items ADD COLUMN ${name} ${definition}`);
  }
  database.exec(`
    CREATE INDEX IF NOT EXISTS idx_items_user ON items(user_id);
    CREATE INDEX IF NOT EXISTS idx_items_parent ON items(parent_id);
    CREATE INDEX IF NOT EXISTS idx_items_capture_key ON items(user_id, source, url);
  `);
}

export function allItems(): Item[] {
  return db().prepare('SELECT * FROM items WHERE user_id = ? ORDER BY created_at DESC').all(currentAccountId()) as Item[];
}

const ACTIVE_ATTENTION_FILTER = `
  status NOT IN ('expired','dead','duplicate')
  AND (kind IS NULL OR kind != 'collection')
`;

function attentionDateWindow(now: Date) {
  const start = new Date(now);
  start.setUTCHours(0, 0, 0, 0);
  const cutoff = new Date(start);
  cutoff.setUTCDate(cutoff.getUTCDate() + 5);
  return {
    today: start.toISOString().slice(0, 10),
    cutoff: cutoff.toISOString().slice(0, 10),
  };
}

export type ItemPage = {
  items: Item[];
  totalItems: number;
  page: number;
  totalPages: number;
  pageSize: number;
};

function pageWindow(totalItems: number, requestedPage: number, requestedPageSize: number) {
  const pageSize = Number.isInteger(requestedPageSize) && requestedPageSize > 0
    ? Math.min(requestedPageSize, 100)
    : 10;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const page = Number.isInteger(requestedPage) && requestedPage > 0
    ? Math.min(requestedPage, totalPages)
    : 1;
  return { page, totalPages, pageSize, offset: (page - 1) * pageSize };
}

export function needsAttention(now: Date = new Date()): Item[] {
  const { today, cutoff } = attentionDateWindow(now);
  return db()
    .prepare(`SELECT * FROM items
      WHERE user_id = ?
        AND ${ACTIVE_ATTENTION_FILTER}
        AND (
          deadline < ?
          OR deadline BETWEEN ? AND ?
          OR attention IN ('review','important','high')
          OR action_required = 1
        )
      ORDER BY
        CASE
          WHEN deadline < ? THEN 0
          WHEN deadline BETWEEN ? AND ? THEN 1
          WHEN action_required = 1 OR attention IN ('review','important','high') THEN 2
          ELSE 3
        END,
        (deadline IS NULL), deadline ASC, created_at DESC, id DESC`)
    .all(currentAccountId(), today, today, cutoff, today, today, cutoff) as Item[];
}

export function needsAttentionPage(requestedPage = 1, requestedPageSize = 3, now: Date = new Date()): ItemPage {
  const database = db();
  const account = currentAccountId();
  const { today, cutoff } = attentionDateWindow(now);
  const totalItems = (database.prepare(`SELECT COUNT(*) AS n FROM items
    WHERE user_id = ?
      AND ${ACTIVE_ATTENTION_FILTER}
      AND (
        deadline < ?
        OR deadline BETWEEN ? AND ?
        OR attention IN ('review','important','high')
        OR action_required = 1
      )`).get(account, today, today, cutoff) as { n: number }).n;
  const pagination = pageWindow(totalItems, requestedPage, requestedPageSize);
  const items = database.prepare(`SELECT * FROM items
    WHERE user_id = ?
      AND ${ACTIVE_ATTENTION_FILTER}
      AND (
        deadline < ?
        OR deadline BETWEEN ? AND ?
        OR attention IN ('review','important','high')
        OR action_required = 1
      )
    ORDER BY
      CASE
        WHEN deadline < ? THEN 0
        WHEN deadline BETWEEN ? AND ? THEN 1
        WHEN action_required = 1 OR attention IN ('review','important','high') THEN 2
        ELSE 3
      END,
      (deadline IS NULL), deadline ASC, created_at DESC, id DESC
    LIMIT ? OFFSET ?`)
    .all(account, today, today, cutoff, today, today, cutoff, pagination.pageSize, pagination.offset) as Item[];
  return { items, totalItems, page: pagination.page, totalPages: pagination.totalPages, pageSize: pagination.pageSize };
}

export function getChildren(parentId: string): Item[] {
  return db()
    .prepare(`SELECT * FROM items
      WHERE user_id = ? AND parent_id = ?
        AND status NOT IN ('expired','dead','duplicate')
      ORDER BY (deadline IS NULL), deadline ASC`)
    .all(currentAccountId(), parentId) as Item[];
}

export function getParentTitle(parentId: string | null): string | null {
  if (!parentId) return null;
  const row = db()
    .prepare('SELECT title FROM items WHERE user_id = ? AND id = ?')
    .get(currentAccountId(), parentId) as { title: string } | undefined;
  return row?.title ?? null;
}

export function collections(): Array<Item & { child_count: number }> {
  const account = currentAccountId();
  const rows = db()
    .prepare(`SELECT * FROM items
      WHERE user_id = ? AND kind = 'collection'
        AND status NOT IN ('expired','dead','duplicate')
      ORDER BY created_at DESC`)
    .all(account) as Item[];
  return rows.map((row) => {
    const count = db()
      .prepare(`SELECT COUNT(*) as n FROM items
        WHERE user_id = ? AND parent_id = ?
          AND status NOT IN ('expired','dead','duplicate')`)
      .get(account, row.id) as { n: number };
    return { ...row, child_count: count.n };
  });
}

export function inbox(): Item[] {
  return db()
    .prepare("SELECT * FROM items WHERE user_id = ? AND status = 'inbox' ORDER BY created_at DESC, id DESC")
    .all(currentAccountId()) as Item[];
}

export function inboxPage(requestedPage = 1, requestedPageSize = 10): ItemPage {
  const database = db();
  const account = currentAccountId();
  const totalItems = (database.prepare("SELECT COUNT(*) AS n FROM items WHERE user_id = ? AND status = 'inbox'")
    .get(account) as { n: number }).n;
  const pagination = pageWindow(totalItems, requestedPage, requestedPageSize);
  const items = database.prepare(`SELECT * FROM items
    WHERE user_id = ? AND status = 'inbox'
    ORDER BY created_at DESC, id DESC
    LIMIT ? OFFSET ?`)
    .all(account, pagination.pageSize, pagination.offset) as Item[];
  return { items, totalItems, page: pagination.page, totalPages: pagination.totalPages, pageSize: pagination.pageSize };
}

export type OrganizedCategory = {
  category_key: string;
  category_name: string | null;
  icon_kind: string;
  item_count: number;
  latest_saved_at: string;
};

export type ItemCategory = {
  category_key: string;
  category_name: string | null;
  icon_kind: string;
};

/** One card per effective category. AI kind remains the default until overridden. */
export function organizedCategories(): OrganizedCategory[] {
  return db()
    .prepare(`SELECT
        COALESCE(i.category_key, i.kind) AS category_key,
        c.name AS category_name,
        MAX(COALESCE(i.kind, 'article')) AS icon_kind,
        COUNT(*) AS item_count,
        MAX(i.created_at) AS latest_saved_at
      FROM items i
      LEFT JOIN categories c
        ON c.user_id = i.user_id
       AND c.category_key = COALESCE(i.category_key, i.kind)
      WHERE i.user_id = ?
        AND (i.category_key IS NOT NULL OR i.kind IS NOT NULL)
        AND i.status NOT IN ('expired','dead','duplicate')
      GROUP BY COALESCE(i.category_key, i.kind), c.name
      ORDER BY latest_saved_at DESC, category_key ASC`)
    .all(currentAccountId()) as OrganizedCategory[];
}

export function organizedCategory(categoryKey: string): OrganizedCategory | undefined {
  return organizedCategories().find((category) => category.category_key === categoryKey);
}

/** All valid items assigned to a category, whether assigned by AI or the user. */
export function organizedByCategory(categoryKey: string): Item[] {
  return db()
    .prepare(`SELECT * FROM items
      WHERE user_id = ?
        AND COALESCE(category_key, kind) = ?
        AND status NOT IN ('expired','dead','duplicate')
      ORDER BY created_at DESC`)
    .all(currentAccountId(), categoryKey) as Item[];
}

export function categoryForItem(item: Item): ItemCategory | undefined {
  const categoryKey = item.category_key || item.kind;
  if (!categoryKey) return undefined;
  const override = db()
    .prepare('SELECT name FROM categories WHERE user_id = ? AND category_key = ?')
    .get(currentAccountId(), categoryKey) as { name: string } | undefined;
  return {
    category_key: categoryKey,
    category_name: override?.name || null,
    icon_kind: item.kind || 'article',
  };
}

function normalizedCategoryName(value: string): string {
  return value.replace(/\s+/g, ' ').trim().slice(0, 60);
}

export function renameCategory(categoryKey: string, requestedName: string) {
  const name = normalizedCategoryName(requestedName);
  if (!name) throw new Error('Category name is required.');
  const current = organizedCategory(categoryKey);
  if (!current) throw new Error('Category no longer exists.');
  db().prepare(`INSERT INTO categories (user_id, category_key, name)
    VALUES (?, ?, ?)
    ON CONFLICT(user_id, category_key) DO UPDATE SET
      name = excluded.name,
      updated_at = datetime('now')`)
    .run(currentAccountId(), categoryKey, name);
  return { category_key: categoryKey, name };
}

export function moveItemToCategory(
  itemId: string,
  options: { targetCategoryKey?: string; newCategoryName?: string },
) {
  const database = db();
  const account = currentAccountId();
  return database.transaction(() => {
    const item = database
      .prepare('SELECT * FROM items WHERE user_id = ? AND id = ?')
      .get(account, itemId) as Item | undefined;
    if (!item) throw new Error('Item no longer exists.');

    let targetKey = options.targetCategoryKey?.trim() || '';
    const newName = normalizedCategoryName(options.newCategoryName || '');
    if (newName) {
      const existing = database
        .prepare('SELECT category_key FROM categories WHERE user_id = ? AND name = ? COLLATE NOCASE')
        .get(account, newName) as { category_key: string } | undefined;
      if (existing) {
        targetKey = existing.category_key;
      } else {
        targetKey = `custom-${randomUUID().replace(/-/g, '')}`;
        database.prepare('INSERT INTO categories (user_id, category_key, name) VALUES (?, ?, ?)')
          .run(account, targetKey, newName);
      }
    }

    if (!targetKey) throw new Error('Choose a category or enter a new category name.');
    const targetExists = organizedCategory(targetKey)
      || database.prepare('SELECT category_key FROM categories WHERE user_id = ? AND category_key = ?')
        .get(account, targetKey);
    if (!targetExists) throw new Error('Target category no longer exists.');

    const storedOverride = targetKey === item.kind ? null : targetKey;
    database.prepare('UPDATE items SET category_key = ? WHERE user_id = ? AND id = ?')
      .run(storedOverride, account, itemId);
    return { item_id: itemId, category_key: targetKey };
  })();
}

export function organized(): Item[] {
  return db()
    .prepare(`SELECT * FROM items
      WHERE user_id = ?
        AND kind IS NOT NULL
        AND kind != 'collection'
        AND parent_id IS NULL
        AND status NOT IN ('expired','dead','duplicate')
      ORDER BY kind, created_at DESC`)
    .all(currentAccountId()) as Item[];
}

export function byId(id: string): Item | undefined {
  return db().prepare('SELECT * FROM items WHERE user_id = ? AND id = ?').get(currentAccountId(), id) as Item | undefined;
}

export type SanitizeBuckets = {
  expired: Item[];
  unattended: Item[];
  duplicates: Item[];
  dead: Item[];
  stale: Item[];
};

export function sanitizeBuckets(now: Date = new Date()): SanitizeBuckets {
  const database = db();
  const account = currentAccountId();
  const sixMonthsAgo = new Date(now.getTime() - 182 * 86400000).toISOString().slice(0, 19).replace('T', ' ');
  const todayISO = now.toISOString().slice(0, 10);

  const expired = database
    .prepare("SELECT * FROM items WHERE user_id = ? AND (status = 'expired' OR (deadline IS NOT NULL AND deadline < ?))")
    .all(account, todayISO) as Item[];
  const unattended = database
    .prepare(`SELECT * FROM items WHERE user_id = ? AND created_at < ? AND last_opened_at IS NULL
      AND status NOT IN ('expired','dead','duplicate')`)
    .all(account, sixMonthsAgo) as Item[];
  const duplicates = database
    .prepare("SELECT * FROM items WHERE user_id = ? AND (status = 'duplicate' OR duplicate_of IS NOT NULL)")
    .all(account) as Item[];
  const dead = database.prepare("SELECT * FROM items WHERE user_id = ? AND status = 'dead'").all(account) as Item[];
  const stale = database
    .prepare(`SELECT * FROM items WHERE user_id = ? AND attention = 'low' AND created_at < ?
      AND status = 'inbox' AND last_opened_at IS NULL`)
    .all(account, sixMonthsAgo) as Item[];
  return { expired, unattended, duplicates, dead, stale };
}

export function applyCleanup(ids: string[], action: 'expire' | 'stale' | 'delete' | 'organize') {
  const database = db();
  const account = currentAccountId();
  let affected = 0;
  const transaction = database.transaction((idList: string[]) => {
    for (const id of idList) {
      let result;
      if (action === 'delete') {
        result = database.prepare('DELETE FROM items WHERE user_id = ? AND id = ?').run(account, id);
      } else {
        const status = action === 'expire' ? 'expired' : action === 'stale' ? 'stale' : 'organized';
        result = database.prepare('UPDATE items SET status = ? WHERE user_id = ? AND id = ?').run(status, account, id);
      }
      affected += result.changes;
    }
  });
  transaction(ids);
  return { updated: affected, action };
}

export function recentNotifications(limit = 5): Item[] {
  return db()
    .prepare(`SELECT * FROM items
      WHERE user_id = ?
        AND status = 'inbox'
        AND (source IN ('x_bookmark', 'bookmark_backfill') OR kind = 'agreement')
      ORDER BY created_at DESC, id DESC
      LIMIT ?`)
    .all(currentAccountId(), Math.max(0, Math.min(Math.trunc(limit), 20))) as Item[];
}

export function recentlySaved(limit = 4): Item[] {
  return db()
    .prepare("SELECT * FROM items WHERE user_id = ? AND (kind IS NULL OR kind != 'collection') ORDER BY created_at DESC LIMIT ?")
    .all(currentAccountId(), limit) as Item[];
}

export function dashboardStats(now: Date = new Date()) {
  const database = db();
  const account = currentAccountId();
  const { today, cutoff } = attentionDateWindow(now);
  const activeParams = [account];
  const total = (database.prepare(`SELECT COUNT(*) as n FROM items
    WHERE user_id = ? AND ${ACTIVE_ATTENTION_FILTER}`).get(...activeParams) as { n: number }).n;
  const approaching = (database.prepare(`SELECT COUNT(*) as n FROM items
    WHERE user_id = ? AND ${ACTIVE_ATTENTION_FILTER}
      AND deadline BETWEEN ? AND ?`).get(account, today, cutoff) as { n: number }).n;
  const review = (database.prepare(`SELECT COUNT(*) as n FROM items
    WHERE user_id = ? AND ${ACTIVE_ATTENTION_FILTER}
      AND (attention IN ('review','important','high') OR action_required = 1)`)
    .get(account) as { n: number }).n;
  const sevenDaysAgo = new Date(now.getTime() - 7 * 86400000).toISOString().slice(0, 19).replace('T', ' ');
  const recent = (database.prepare(`SELECT COUNT(*) as n FROM items
    WHERE user_id = ? AND ${ACTIVE_ATTENTION_FILTER} AND created_at >= ?`)
    .get(account, sevenDaysAgo) as { n: number }).n;
  return { deadlinesApproaching: approaching, needReview: review, recentlySaved: recent, totalItems: total };
}

export function agreements(): Item[] {
  return db()
    .prepare("SELECT * FROM items WHERE user_id = ? AND kind = 'agreement' ORDER BY created_at DESC, id DESC")
    .all(currentAccountId()) as Item[];
}

export function agreementsPage(requestedPage = 1, requestedPageSize = 10): ItemPage {
  const database = db();
  const account = currentAccountId();
  const totalItems = (database.prepare("SELECT COUNT(*) AS n FROM items WHERE user_id = ? AND kind = 'agreement'")
    .get(account) as { n: number }).n;
  const pagination = pageWindow(totalItems, requestedPage, requestedPageSize);
  const items = database.prepare(`SELECT * FROM items
    WHERE user_id = ? AND kind = 'agreement'
    ORDER BY created_at DESC, id DESC
    LIMIT ? OFFSET ?`)
    .all(account, pagination.pageSize, pagination.offset) as Item[];
  return { items, totalItems, page: pagination.page, totalPages: pagination.totalPages, pageSize: pagination.pageSize };
}

export function kindCounts(): Record<string, number> {
  const rows = db()
    .prepare('SELECT kind, COUNT(*) as n FROM items WHERE user_id = ? GROUP BY kind')
    .all(currentAccountId()) as Array<{ kind: string | null; n: number }>;
  const out: Record<string, number> = {};
  for (const row of rows) out[row.kind || 'unclassified'] = row.n;
  return out;
}
