/**
 * SQLite storage for the shared NUDGE pipeline.
 *
 * The table mirrors the production Postgres shape closely. Migrations are
 * additive where SQLite permits it and rebuild the table only when a CHECK
 * constraint must change. Existing rows are copied explicitly; migrations
 * never reset the database.
 */

import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_DB_PATH = path.join(__dirname, '..', 'data', 'second-brain.db');

let db = null;

const ITEM_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS items (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    url TEXT NOT NULL,
    title TEXT,
    raw_text TEXT,
    source TEXT NOT NULL CHECK (source IN ('x_bookmark', 'save_button', 'paste', 'agreement', 'bookmark_backfill')),
    kind TEXT CHECK (kind IN ('opportunity', 'article', 'tool', 'repo', 'video', 'agreement', 'idea', 'entertainment', 'collection', NULL)),
    summary TEXT,
    why_saved TEXT,
    highlights TEXT,
    deadline TEXT,
    date_confidence TEXT DEFAULT 'none' CHECK (date_confidence IN ('explicit', 'inferred', 'none')),
    action_required INTEGER DEFAULT 0,
    attention TEXT DEFAULT 'low' CHECK (attention IN ('low', 'review', 'important', 'high')),
    status TEXT DEFAULT 'inbox' CHECK (status IN ('inbox', 'organized', 'expired', 'stale', 'duplicate', 'dead')),
    embedding TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    last_seen_at TEXT DEFAULT (datetime('now')),
    last_opened_at TEXT,
    duplicate_of TEXT REFERENCES items(id),
    parent_id TEXT REFERENCES items(id),
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
`;

const CATEGORY_TABLE_SQL = `
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
`;

function ensureIndexes(database) {
  const columns = new Set(database.prepare('PRAGMA table_info(items)').all().map((column) => column.name));
  const indexes = [
    ['idx_items_status', ['status']],
    ['idx_items_attention', ['attention']],
    ['idx_items_kind', ['kind']],
    ['idx_items_deadline', ['deadline']],
    ['idx_items_url', ['url']],
    ['idx_items_parent', ['parent_id']],
    ['idx_items_user', ['user_id']],
    ['idx_items_capture_key', ['user_id', 'source', 'url']],
  ];
  for (const [name, fields] of indexes) {
    if (fields.every((field) => columns.has(field))) {
      database.exec(`CREATE INDEX IF NOT EXISTS ${name} ON items(${fields.join(', ')});`);
    }
  }
}

export function getDb(dbPath) {
  if (db) return db;
  const resolvedPath = dbPath || process.env.DB_PATH || DEFAULT_DB_PATH;
  fs.mkdirSync(path.dirname(resolvedPath), { recursive: true });
  db = new Database(resolvedPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  return db;
}

export function initSchema(dbInstance) {
  const database = dbInstance || getDb();
  database.exec(ITEM_TABLE_SQL);
  database.exec(CATEGORY_TABLE_SQL);
  ensureIndexes(database);
  return database;
}

function rebuildItemsTable(database, { remapLegacySource = false } = {}) {
  const foreignKeysWereEnabled = Number(database.pragma('foreign_keys', { simple: true })) === 1;
  if (foreignKeysWereEnabled) database.pragma('foreign_keys = OFF');

  try {
    database.transaction(() => {
      const existingCols = database.prepare('PRAGMA table_info(items)').all().map((c) => c.name);
      database.exec('ALTER TABLE items RENAME TO items_old;');
      database.exec(ITEM_TABLE_SQL);

      const newCols = database.prepare('PRAGMA table_info(items)').all().map((c) => c.name);
      const shared = existingCols.filter((column) => newCols.includes(column));
      const selectList = shared.map((column) => {
        if (remapLegacySource && column === 'source') {
          return "CASE WHEN source = 'bookmark' THEN 'x_bookmark' ELSE source END";
        }
        return column;
      });

      if (shared.length > 0) {
        database.exec(
          `INSERT INTO items (${shared.join(', ')}) SELECT ${selectList.join(', ')} FROM items_old;`
        );
      }
      database.exec('DROP TABLE items_old;');
    })();

    // Index names belonged to the renamed table during the transaction. Create
    // them only after that table has been dropped so none are silently skipped.
    ensureIndexes(database);
  } finally {
    if (foreignKeysWereEnabled) database.pragma('foreign_keys = ON');
  }
}

/** Add all post-foundation columns without dropping existing rows. */
export function migrateColumns(dbInstance) {
  const database = dbInstance || getDb();
  const applied = [];
  const columns = () => database.prepare('PRAGMA table_info(items)').all().map((c) => c.name);
  let current = columns();

  const additions = [
    ['highlights', 'TEXT'],
    ['date_confidence', "TEXT DEFAULT 'none'"],
    ['parent_id', 'TEXT REFERENCES items(id)'],
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
    if (!current.includes(name)) {
      database.exec(`ALTER TABLE items ADD COLUMN ${name} ${definition};`);
      applied.push(name);
      current = columns();
    }
  }

  const tableInfo = database
    .prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='items'")
    .get();
  const kindNeedsCollection =
    tableInfo?.sql?.includes("'entertainment'") && !tableInfo.sql.includes("'collection'");

  if (kindNeedsCollection) {
    rebuildItemsTable(database);
    applied.push('kind:collection (table rebuilt)');
  } else {
    ensureIndexes(database);
  }

  database.exec(CATEGORY_TABLE_SQL);
  return { applied, migrated: applied.length > 0 };
}

/** Migrate legacy source='bookmark' rows to source='x_bookmark' safely. */
export function migrateSchema(dbInstance) {
  const database = dbInstance || getDb();
  const tableInfo = database
    .prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='items'")
    .get();

  if (!tableInfo) return { migrated: false, reason: 'no items table yet' };
  const usesOldEnum = tableInfo.sql.includes("'bookmark'") && !tableInfo.sql.includes("'x_bookmark'");
  if (!usesOldEnum) return { migrated: false, reason: 'already on new enum' };

  rebuildItemsTable(database, { remapLegacySource: true });
  return { migrated: true, reason: 'remapped bookmark -> x_bookmark' };
}

export function insertItem(item) {
  const database = getDb();
  const stmt = database.prepare(`
    INSERT INTO items (
      url, title, raw_text, source, kind, summary, why_saved, highlights,
      deadline, date_confidence, action_required, attention, status, embedding,
      duplicate_of, parent_id, clauses, user_id, bookmarked_at, author, media,
      linked_url, linked_fetch_status, outbound_links, category_key
    ) VALUES (
      @url, @title, @raw_text, @source, @kind, @summary, @why_saved, @highlights,
      @deadline, @date_confidence, @action_required, @attention, @status, @embedding,
      @duplicate_of, @parent_id, @clauses, @user_id, @bookmarked_at, @author, @media,
      @linked_url, @linked_fetch_status, @outbound_links, @category_key
    )
  `);

  const row = {
    url: item.url,
    title: item.title || null,
    raw_text: item.raw_text || null,
    source: item.source || 'x_bookmark',
    kind: item.kind || null,
    summary: item.summary || null,
    why_saved: item.why_saved || null,
    highlights: item.highlights ? JSON.stringify(item.highlights) : null,
    deadline: item.deadline || null,
    date_confidence: item.date_confidence || 'none',
    action_required: item.action_required ? 1 : 0,
    attention: item.attention || 'low',
    status: item.status || 'inbox',
    embedding: item.embedding ? JSON.stringify(item.embedding) : null,
    duplicate_of: item.duplicate_of || null,
    parent_id: item.parent_id || null,
    clauses: item.clauses ? JSON.stringify(item.clauses) : null,
    user_id: item.user_id || 'local',
    bookmarked_at: item.bookmarked_at || null,
    author: item.author || null,
    media: item.media ? JSON.stringify(item.media) : null,
    linked_url: item.linked_url || null,
    linked_fetch_status: item.linked_fetch_status || null,
    outbound_links: item.outbound_links
      ? (typeof item.outbound_links === 'string' ? item.outbound_links : JSON.stringify(item.outbound_links))
      : null,
    category_key: item.category_key || null,
  };

  const result = stmt.run(row);
  return database.prepare('SELECT * FROM items WHERE rowid = ?').get(result.lastInsertRowid);
}

export function getItemByUrl(url) {
  return getDb().prepare('SELECT * FROM items WHERE url = ? ORDER BY created_at DESC LIMIT 1').get(url);
}

export function getItemByCaptureKey(url, source, userId = 'local') {
  return getDb()
    .prepare('SELECT * FROM items WHERE url = ? AND source = ? AND user_id = ? ORDER BY created_at DESC LIMIT 1')
    .get(url, source, userId);
}

export function getItemById(id) {
  return getDb().prepare('SELECT * FROM items WHERE id = ?').get(id);
}

export function getAllItems() {
  return getDb().prepare('SELECT * FROM items ORDER BY created_at DESC').all();
}

export function getItemsByStatus(status) {
  return getDb().prepare('SELECT * FROM items WHERE status = ? ORDER BY created_at DESC').all(status);
}

export function getItemsByAttention(attention) {
  return getDb().prepare('SELECT * FROM items WHERE attention = ? ORDER BY deadline ASC').all(attention);
}

export function updateItem(id, updates) {
  const database = getDb();
  const fields = Object.keys(updates).map((key) => `${key} = @${key}`).join(', ');
  const params = { ...updates, id };
  if (params.embedding && Array.isArray(params.embedding)) params.embedding = JSON.stringify(params.embedding);
  if (params.clauses && typeof params.clauses !== 'string') params.clauses = JSON.stringify(params.clauses);
  if (params.highlights && typeof params.highlights !== 'string') params.highlights = JSON.stringify(params.highlights);
  if (params.media && typeof params.media !== 'string') params.media = JSON.stringify(params.media);
  if (params.outbound_links && typeof params.outbound_links !== 'string') params.outbound_links = JSON.stringify(params.outbound_links);
  if ('action_required' in params) params.action_required = params.action_required ? 1 : 0;
  database.prepare(`UPDATE items SET ${fields} WHERE id = @id`).run(params);
  return getItemById(id);
}

export function getChildren(parentId) {
  return getDb().prepare('SELECT * FROM items WHERE parent_id = ? ORDER BY (deadline IS NULL), deadline ASC').all(parentId);
}

export function getItemsWithEmbeddings(userId = process.env.SECOND_BRAIN_ACCOUNT_ID || 'local') {
  return getDb()
    .prepare('SELECT id, url, title, embedding FROM items WHERE user_id = ? AND embedding IS NOT NULL')
    .all(userId);
}

export function deleteItem(id) {
  return getDb().prepare('DELETE FROM items WHERE id = ?').run(id);
}

export function closeDb() {
  if (db) {
    db.close();
    db = null;
  }
}
