#!/usr/bin/env node
/**
 * run-pipeline <urls.txt> [--store] [--no-live] [--no-fanout]
 *
 * Runs the multiplicity-aware pipeline on each URL and prints each row.
 * A list page produces one 'collection' parent + child rows.
 *
 * --store     persist rows to SQLite (parent first, then children with parent_id)
 * --no-live   skip liveness checks
 * --no-fanout force the single-item path (skip list detection)
 *
 * Lines starting with # are comments.
 */

import 'dotenv/config';
import fs from 'fs';
import { processItem, processItemTree } from '../src/pipeline.mjs';
import { initSchema, migrateSchema, migrateColumns, insertItem, getItemsWithEmbeddings, getProviderName } from '../src/index.mjs';

const args = process.argv.slice(2);
const file = args.find(a => !a.startsWith('--'));
const doStore = args.includes('--store');
const noLive = args.includes('--no-live');
const noFanout = args.includes('--no-fanout');

if (!file) {
  console.error('Usage: run-pipeline <urls.txt> [--store] [--no-live] [--no-fanout]');
  process.exit(1);
}
if (!fs.existsSync(file)) {
  console.error(`File not found: ${file}`);
  process.exit(1);
}

const urls = fs.readFileSync(file, 'utf8')
  .split(/\r?\n/).map(l => l.trim()).filter(l => l && !l.startsWith('#'));

console.log(`\n=== run-pipeline ===`);
console.log(`Provider: ${getProviderName()}`);
console.log(`URLs: ${urls.length} | store: ${doStore} | liveness: ${!noLive} | fanout: ${!noFanout}\n`);

if (doStore) {
  initSchema();
  migrateSchema();
  migrateColumns();
}

const now = new Date();
let existing = doStore ? getItemsWithEmbeddings() : [];

function fmt(item, label) {
  const line = (l, v) => `    ${l.padEnd(16)}: ${v}`;
  const days = item._days_until;
  const countdown = item.deadline
    ? (days != null ? (days < 0 ? `${Math.abs(days)}d ago (passed)` : `in ${days}d`) : '')
    : '—';
  const hl = (item.highlights && item.highlights.length)
    ? '\n' + item.highlights.map(h => `                      • ${h}`).join('\n')
    : ' (none)';
  return [
    `${label} ${item.url}`,
    line('title', item.title || '(none)'),
    line('source', item.source),
    line('kind', item.kind || '(unclassified)'),
    line('summary', item.summary || '(none)'),
    line('highlights', hl),
    line('deadline', `${item.deadline || 'null'}   ${countdown}`),
    line('date_conf', item.date_confidence || 'none'),
    line('action_req', item.action_required),
    line('attention', item.attention.toUpperCase()),
    line('status', item.status),
    item.parent_id ? line('parent_id', item.parent_id) : null,
    line('embedding', item.embedding ? `[${item.embedding.length} dims]` : 'none'),
    item._date_reason ? line('date_reason', item._date_reason) : null,
    item._notes && item._notes.length ? line('notes', item._notes.join(' | ')) : null,
  ].filter(Boolean).join('\n');
}

for (let i = 0; i < urls.length; i++) {
  const url = urls[i];
  process.stdout.write(`\nProcessing ${i + 1}/${urls.length}: ${url}\n`);
  try {
    if (noFanout) {
      const item = await processItem(url, { now, existing, checkLive: !noLive, source: 'paste' });
      console.log(fmt(item, `[${i + 1}]`));
      if (doStore) {
        const saved = insertItem(item);
        if (item.embedding) existing.push({ id: saved.id, url: saved.url, embedding: item.embedding });
        console.log(`    -> stored id ${saved.id}`);
      }
      continue;
    }

    const { parent, children } = await processItemTree(url, { now, existing, checkLive: !noLive, source: 'paste' });
    console.log(fmt(parent, `[${i + 1}] PARENT`));

    let parentId = null;
    if (doStore) {
      const saved = insertItem(parent);
      parentId = saved.id;
      if (parent.embedding) existing.push({ id: saved.id, url: saved.url, embedding: parent.embedding });
      console.log(`    -> stored parent id ${parentId}`);
    }

    children.forEach((child, ci) => {
      if (parentId) child.parent_id = parentId;
      console.log('\n' + fmt(child, `    [${i + 1}.${ci + 1}] CHILD`));
      if (doStore) {
        const saved = insertItem(child);
        if (child.embedding) existing.push({ id: saved.id, url: saved.url, embedding: child.embedding });
        console.log(`        -> stored child id ${saved.id}`);
      }
    });
  } catch (err) {
    console.error(`    ERROR: ${err.message}`);
  }
}

console.log('\n=== done ===\n');
process.exit(0);
