#!/usr/bin/env node
/**
 * Verification script: inserts and reads back one dummy item row.
 * Phase 0 definition of done.
 */

import 'dotenv/config';
import { initSchema, migrateSchema, insertItem, getItemById, closeDb } from '../src/index.mjs';

console.log('[verify-db] Initializing schema...');

try {
  initSchema();
  const mig = migrateSchema();
  console.log(`[verify-db] Migration: ${mig.migrated ? 'applied' : 'skipped'} (${mig.reason}).`);
  console.log('[verify-db] Schema created successfully.');

  console.log('[verify-db] Inserting dummy item...');
  const inserted = insertItem({
    url: 'https://example.com/test-verification',
    title: 'Phase 0 Verification Item',
    raw_text: 'This is a test item to verify the database layer works correctly.',
    source: 'x_bookmark',
    kind: 'article',
    summary: 'A test item for verification purposes.',
    why_saved: 'Phase 0 verification',
    attention: 'low',
    status: 'inbox',
  });

  console.log(`[verify-db] Inserted item with id: ${inserted.id}`);

  console.log('[verify-db] Reading back...');
  const readBack = getItemById(inserted.id);

  if (readBack && readBack.url === 'https://example.com/test-verification') {
    console.log('[verify-db] ✓ Item read back successfully:');
    console.log(JSON.stringify(readBack, null, 2));
  } else {
    console.error('[verify-db] ✗ Read-back failed or data mismatch.');
    process.exit(1);
  }

  closeDb();
  console.log('[verify-db] ✓ Database layer is working.');
  process.exit(0);
} catch (err) {
  console.error(`[verify-db] ✗ FAILED: ${err.message}`);
  console.error(err.stack);
  process.exit(1);
}
