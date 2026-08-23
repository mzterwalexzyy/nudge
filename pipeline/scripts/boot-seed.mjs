import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { closeDb, getDb, initSchema, migrateColumns, migrateSchema } from '../src/db.mjs';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const dbPath = path.resolve(
  process.env.DB_PATH || path.join(rootDir, 'pipeline', 'data', 'render.db')
);
const snapshotPath = path.resolve(
  process.env.SEED_SNAPSHOT_PATH || path.join(rootDir, 'pipeline', 'data', 'seed-snapshot.json')
);

process.env.DB_PATH = dbPath;

let database;
try {
  database = getDb(dbPath);
  initSchema(database);
  migrateSchema(database);
  migrateColumns(database);

  const existingCount = database.prepare('SELECT COUNT(*) AS count FROM items').get().count;
  if (existingCount > 0) {
    console.log(`[boot-seed] database already contains ${existingCount} items; seed replay skipped`);
    process.exitCode = 0;
  } else {
    if (!fs.existsSync(snapshotPath)) {
      throw new Error(`Seed snapshot does not exist: ${snapshotPath}`);
    }

    const snapshot = JSON.parse(fs.readFileSync(snapshotPath, 'utf8'));
    if (snapshot.format !== 'second-brain-seed-v1') {
      throw new Error(`Unsupported seed snapshot format: ${snapshot.format || 'missing'}`);
    }
    if (!Array.isArray(snapshot.columns) || !Array.isArray(snapshot.rows) || snapshot.rows.length === 0) {
      throw new Error('Seed snapshot must include non-empty columns and rows arrays.');
    }
    if (snapshot.source_row_count !== snapshot.rows.length) {
      throw new Error('Seed snapshot row-count metadata does not match its rows.');
    }

    const schemaColumns = new Set(
      database.prepare('PRAGMA table_info(items)').all().map((column) => column.name)
    );
    const requiredColumns = ['id', 'url', 'source', 'kind', 'date_confidence', 'attention', 'status'];
    for (const column of snapshot.columns) {
      if (!schemaColumns.has(column)) throw new Error(`Snapshot column is not in the current schema: ${column}`);
    }
    for (const column of requiredColumns) {
      if (!snapshot.columns.includes(column)) throw new Error(`Snapshot is missing required column: ${column}`);
    }

    const quotedColumns = snapshot.columns.map((column) => `"${column}"`).join(', ');
    const placeholders = snapshot.columns.map((column) => `@${column}`).join(', ');
    const insert = database.prepare(`INSERT INTO items (${quotedColumns}) VALUES (${placeholders})`);

    database.pragma('foreign_keys = OFF');
    try {
      database.transaction((rows) => {
        for (const row of rows) {
          const values = Object.fromEntries(
            snapshot.columns.map((column) => [column, row[column] ?? null])
          );
          insert.run(values);
        }
      })(snapshot.rows);
    } finally {
      database.pragma('foreign_keys = ON');
    }

    const foreignKeyErrors = database.pragma('foreign_key_check');
    if (foreignKeyErrors.length > 0) {
      throw new Error(`Seed snapshot violates ${foreignKeyErrors.length} foreign-key constraint(s).`);
    }

    const seededCount = database.prepare('SELECT COUNT(*) AS count FROM items').get().count;
    if (seededCount !== snapshot.rows.length) {
      throw new Error(`Seed verification failed: expected ${snapshot.rows.length}, found ${seededCount}.`);
    }

    console.log(`[boot-seed] loaded ${seededCount} stored items into ${dbPath}`);
  }
} finally {
  closeDb();
}
