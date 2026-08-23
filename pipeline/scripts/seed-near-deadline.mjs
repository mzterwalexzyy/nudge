#!/usr/bin/env node
/**
 * Seeds ONE real near-deadline item to demonstrate the red "Needs Attention"
 * hero in the dashboard.
 *
 * HONESTY: the item is the REAL "Agents for Humans" hackathon page with its
 * REAL deadline (2026-09-14). To make it *near* for the demo, we evaluate it
 * as-of 2026-09-13 (one day before its real close). The date is not invented;
 * only the "now" reference is shifted, and we record that in why_saved.
 *
 * It is stored with status 'inbox' and its computed high attention so it shows
 * red at the top of Needs Attention.
 */

import 'dotenv/config';
import { processItem } from '../src/pipeline.mjs';
import { initSchema, migrateSchema, migrateColumns, insertItem, getItemByUrl, updateItem } from '../src/index.mjs';

const URL = 'https://agentsforhumans.devpost.com/rules';
const asOf = new Date('2026-09-13'); // 1 day before the real Sep 14 deadline

initSchema();
migrateSchema();
migrateColumns();

console.log(`Processing ${URL} as-of ${asOf.toISOString().slice(0, 10)} (1 day before its real deadline)...`);
const item = await processItem(URL, { now: asOf, checkLive: false, source: 'x_bookmark' });

item.why_saved = (item.why_saved || '') + ' [demo: evaluated as-of 2026-09-13, real close 2026-09-14]';

const existing = getItemByUrl(URL);
if (existing) {
  updateItem(existing.id, {
    deadline: item.deadline,
    date_confidence: item.date_confidence,
    attention: item.attention,
    action_required: item.action_required,
    status: 'inbox',
    kind: item.kind,
    summary: item.summary,
    why_saved: item.why_saved,
    highlights: item.highlights,
  });
  console.log(`Updated existing row ${existing.id}`);
} else {
  const saved = insertItem(item);
  console.log(`Inserted ${saved.id}`);
}

console.log(`kind=${item.kind} deadline=${item.deadline} date_confidence=${item.date_confidence} attention=${item.attention.toUpperCase()}`);
process.exit(0);
