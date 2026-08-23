#!/usr/bin/env node
/**
 * run-agreement <url> [--store]
 *
 * Fetches a Terms/Privacy/Subscription page, runs classifyAgreement (Phase 2),
 * and prints the 3-5 ranked clauses. Optionally stores as an 'agreement' item.
 */

import 'dotenv/config';
import { ingest } from '../src/ingest.mjs';
import { classifyAgreement } from '../src/agreement.mjs';
import { embed } from '../src/embed.mjs';
import { initSchema, migrateSchema, insertItem, getProviderName } from '../src/index.mjs';

const args = process.argv.slice(2);
const url = args.find(a => !a.startsWith('--'));
const doStore = args.includes('--store');

if (!url) {
  console.error('Usage: run-agreement <url> [--store]');
  process.exit(1);
}

console.log(`\n=== run-agreement ===`);
console.log(`Provider: ${getProviderName()}`);
console.log(`URL: ${url}\n`);

const ing = await ingest(url);
if (!ing.ok) {
  console.error(`Ingest failed: ${ing.error}`);
  process.exit(1);
}
console.log(`Title: ${ing.title}`);
console.log(`Text length: ${ing.raw_text.length} chars\n`);

const result = await classifyAgreement(ing.raw_text);

if (result._error) {
  console.error(`classifyAgreement error: ${result._error}`);
  process.exit(1);
}

const LEVEL_TAG = { high: '[HIGH]     ', important: '[IMPORTANT]', review: '[REVIEW]   ', low: '[LOW]      ' };

console.log(`Found ${result.clauses.length} clauses (ranked):\n`);
result.clauses.forEach((c, i) => {
  console.log(`${i + 1}. ${LEVEL_TAG[c.level] || c.level}  ${c.label}`);
  console.log(`   ${c.plain_explanation}\n`);
});

if (doStore) {
  initSchema();
  migrateSchema();
  const emb = await embed(ing.raw_text);
  const saved = insertItem({
    url,
    title: ing.title,
    raw_text: ing.raw_text,
    source: 'agreement',
    kind: 'agreement',
    summary: `Agreement analysis: ${result.clauses.length} clauses flagged.`,
    why_saved: 'Reviewed before agreeing.',
    attention: result.clauses.some(c => c.level === 'high') ? 'important' : 'review',
    status: 'inbox',
    embedding: emb,
    clauses: result.clauses,
  });
  console.log(`-> stored agreement id ${saved.id}`);
}

console.log('\n=== done ===\n');
process.exit(0);
