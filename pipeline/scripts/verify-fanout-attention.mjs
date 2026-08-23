#!/usr/bin/env node
/**
 * Verifies that list children with FUTURE explicit deadlines flow into
 * Needs Attention sorted by urgency.
 *
 * Uses the SAME real roundup page, but evaluates it as-of 2026-04-01 (a date
 * before those real deadlines) so the real May/June entries are future-dated.
 * This is not fabrication: the dates and entries are the page's real content;
 * only the "now" reference point is shifted to demonstrate the ordering path.
 */

import 'dotenv/config';
import { processItemTree } from '../src/pipeline.mjs';
import { assignAttention } from '../src/attention.mjs';

const URL = 'https://mansimore3.substack.com/p/all-upcoming-google-cloud-hackathons';
const asOf = new Date('2026-04-01');

console.log(`Evaluating real roundup as-of ${asOf.toISOString().slice(0, 10)} (shifts real May/Jun deadlines into the future)\n`);

const { parent, children } = await processItemTree(URL, { now: asOf, checkLive: false, source: 'paste' });

// Re-derive attention as-of asOf and collect those that would show in Needs Attention
const withDates = children
  .map(c => ({ title: c._entryTitle || c.title, deadline: c.deadline, date_confidence: c.date_confidence, attention: assignAttention(c, asOf) }))
  .filter(c => c.deadline && c.date_confidence === 'explicit')
  .sort((a, b) => new Date(a.deadline) - new Date(b.deadline));

console.log(`Parent: "${parent.title}" (kind=${parent.kind})`);
console.log(`Children with explicit future deadlines (Needs Attention order, nearest first):\n`);
withDates.forEach((c, i) => {
  const d = Math.floor((new Date(c.deadline + 'T23:59:59') - asOf) / 86400000);
  console.log(`  ${i + 1}. [${c.attention.toUpperCase().padEnd(9)}] ${c.deadline} (in ${d}d)  ${c.title}`);
});

console.log('\nDONE');
process.exit(0);
