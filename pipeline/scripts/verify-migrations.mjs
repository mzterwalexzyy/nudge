#!/usr/bin/env node
/** Assertion-based, destructive only to pipeline/data/phase4-verify.db. */

import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const file = path.join(here, '..', 'data', 'phase4-verify.db');
for (const suffix of ['', '-wal', '-shm']) fs.rmSync(file + suffix, { force: true });

const legacy = new Database(file);
legacy.exec(`
  CREATE TABLE items (
    id TEXT PRIMARY KEY,
    url TEXT NOT NULL,
    title TEXT,
    raw_text TEXT,
    source TEXT NOT NULL CHECK (source IN ('bookmark','save_button','paste','agreement')),
    kind TEXT CHECK (kind IN ('opportunity','article','tool','repo','video','agreement','idea','entertainment',NULL)),
    summary TEXT,
    why_saved TEXT,
    deadline TEXT,
    action_required INTEGER DEFAULT 0,
    attention TEXT DEFAULT 'low',
    status TEXT DEFAULT 'inbox',
    embedding TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    last_seen_at TEXT DEFAULT (datetime('now')),
    last_opened_at TEXT,
    duplicate_of TEXT,
    clauses TEXT
  );
  INSERT INTO items (id,url,source,kind,title)
  VALUES ('legacy-1','https://example.com/legacy','bookmark','article','Legacy row');
`);
legacy.close();

process.env.DB_PATH = file;
const store = await import('../src/db.mjs');
store.initSchema();
const sourceMigration = store.migrateSchema();
const columnMigration = store.migrateColumns();
const database = store.getDb();
const row = database.prepare('SELECT id,url,source,user_id FROM items WHERE id = ?').get('legacy-1');
const columns = database.prepare('PRAGMA table_info(items)').all().map((column) => column.name);
const indexes = database
  .prepare("SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='items'")
  .all()
  .map((index) => index.name);

const requiredColumns = [
  'highlights', 'date_confidence', 'parent_id', 'user_id', 'bookmarked_at',
  'author', 'media', 'linked_url', 'linked_fetch_status',
];
const evidence = {
  sourceMigration,
  columnMigration,
  row,
  requiredColumnsPresent: requiredColumns.every((column) => columns.includes(column)),
  captureIndexPresent: indexes.includes('idx_items_capture_key'),
};
console.log(JSON.stringify(evidence, null, 2));

if (
  !row || row.source !== 'x_bookmark' || row.user_id !== 'local' ||
  !evidence.requiredColumnsPresent || !evidence.captureIndexPresent
) {
  console.error('Migration assertion failed.');
  process.exitCode = 1;
} else {
  console.log('PASS: legacy row preserved and amended schema/indexes applied.');
}

store.closeDb();
