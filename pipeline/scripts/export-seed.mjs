import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const sourcePath = path.resolve(
  process.argv[2] || path.join(rootDir, 'pipeline', 'data', 'second-brain.db')
);
const outputPath = path.resolve(
  process.argv[3] || path.join(rootDir, 'pipeline', 'data', 'seed-snapshot.json')
);

if (!fs.existsSync(sourcePath)) {
  throw new Error(`Seed source database does not exist: ${sourcePath}`);
}

const database = new Database(sourcePath, { readonly: true, fileMustExist: true });
try {
  database.pragma('query_only = ON');
  const quickCheck = database.pragma('quick_check', { simple: true });
  if (quickCheck !== 'ok') {
    throw new Error(`Source database failed PRAGMA quick_check: ${quickCheck}`);
  }

  const columns = database.prepare('PRAGMA table_info(items)').all().map((column) => column.name);
  if (columns.length === 0) {
    throw new Error('Source database does not contain the items schema.');
  }

  const rows = database.prepare('SELECT * FROM items ORDER BY created_at ASC, id ASC').all();
  if (rows.length === 0) {
    throw new Error('Refusing to export an empty seed snapshot.');
  }

  const snapshot = {
    format: 'second-brain-seed-v1',
    provenance: 'Stored output from the verified Phase 4 API database; no classification is generated during boot.',
    exported_at: new Date().toISOString(),
    source_row_count: rows.length,
    columns,
    rows,
  };

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8');
  console.log(`[seed-export] wrote ${rows.length} stored items to ${outputPath}`);
} finally {
  database.close();
}
