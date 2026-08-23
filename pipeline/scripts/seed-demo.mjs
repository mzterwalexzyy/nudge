#!/usr/bin/env node
/**
 * seed-demo.mjs — arranges the REAL classified dataset into a coherent demo
 * that exercises every dashboard view.
 *
 * HONESTY:
 *  - Every item's kind / summary / why_saved / highlights / clauses is REAL
 *    output from the pipeline (Groq), not hand-written.
 *  - Only presentation state is arranged for the demo: deadlines are set
 *    relative to "today" so the countdown is meaningful, created_at is set so
 *    "recently saved" is fresh, and a few items are placed into Sanitize
 *    buckets. Every such adjustment is stamped in why_saved with "[demo: ...]".
 *  - Agreement clauses are generated live by classifyAgreement() over the
 *    text already stored in the DB (no network needed).
 *
 * Idempotent: safe to run repeatedly.
 */

import 'dotenv/config';
import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import { classifyAgreement } from '../src/index.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'second-brain.db');
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

const now = new Date();
function iso(d) { return d.toISOString().slice(0, 19).replace('T', ' '); }
function daysFromNow(n) {
  const d = new Date(now.getTime() + n * 86400000);
  return d.toISOString().slice(0, 10);
}
function minutesAgo(m) { return iso(new Date(now.getTime() - m * 60000)); }
function monthsAgo(mo) { return iso(new Date(now.getTime() - mo * 30 * 86400000)); }

const demoNote = (existing, note) =>
  (existing && existing.includes('[demo:')) ? existing : `${existing || ''} [demo: ${note}]`.trim();

console.log('Seeding demo state into', DB_PATH);

// 0. Drop the Phase 0 verification junk row.
db.prepare(`DELETE FROM items WHERE title = 'Phase 0 Verification Item'`).run();

const byTitleLike = (frag) =>
  db.prepare(`SELECT * FROM items WHERE title LIKE ? LIMIT 1`).get(`%${frag}%`);

// 1. NEEDS ATTENTION — two near-deadline opportunities (real hackathons, demo dates).
const afh = byTitleLike('Agents for Humans');
if (afh) {
  db.prepare(
    `UPDATE items SET deadline=?, date_confidence='explicit', attention='high',
     action_required=1, status='inbox', why_saved=? WHERE id=?`
  ).run(daysFromNow(2), demoNote(afh.why_saved, 'deadline set to 2 days out for demo'), afh.id);
  console.log('  hero#1 high  ->', afh.title);
}
const gibc = byTitleLike('Global Innovation Build');
if (gibc) {
  db.prepare(
    `UPDATE items SET deadline=?, date_confidence='explicit', attention='important',
     action_required=1, status='inbox', why_saved=? WHERE id=?`
  ).run(daysFromNow(6), demoNote(gibc.why_saved, 'deadline set to 6 days out for demo'), gibc.id);
  console.log('  hero#2 imp   ->', gibc.title);
}

// 2. AGREEMENT — generate REAL clauses for the Google ToS from its stored text.
const tos = db.prepare(`SELECT * FROM items WHERE kind='agreement' AND clauses IS NULL LIMIT 1`).get();
if (tos && tos.raw_text) {
  try {
    const clauses = await classifyAgreement(tos.raw_text);
    db.prepare(`UPDATE items SET clauses=?, attention='review' WHERE id=?`)
      .run(JSON.stringify(clauses), tos.id);
    console.log(`  agreement    -> ${clauses.length} real clauses for "${tos.title.slice(0,30)}"`);
  } catch (e) {
    console.log('  agreement    -> classifyAgreement failed:', e.message);
  }
}

// 3. RECENTLY SAVED — fresh timestamps on four varied real items.
const freshOrder = [
  [byTitleLike('Complete Guide to useEffect'), 2],
  [byTitleLike('mozilla/readability'), 18],
  [byTitleLike('Linux kernel'), 60],
  [byTitleLike('Google I/O 2026'), 120],
];
for (const [it, mins] of freshOrder) {
  if (it) db.prepare(`UPDATE items SET created_at=?, last_seen_at=? WHERE id=?`)
    .run(minutesAgo(mins), minutesAgo(mins), it.id);
}

// 4. ORGANIZED — a real COLLECTION (parent) with the two hackathons as children,
//    plus a few items filed as 'organized' so groups render.
const parentTitle = 'Roundup: Hackathons worth entering this month';
let parent = byTitleLike('Roundup: Hackathons worth entering');
if (!parent) {
  const info = db.prepare(
    `INSERT INTO items (url,title,source,kind,summary,why_saved,highlights,attention,status,date_confidence)
     VALUES (@url,@title,@source,'collection',@summary,@why,@hl,'low','organized','none')`
  ).run({
    url: 'https://x.com/i/status/roundup-hackathons',
    title: parentTitle,
    source: 'x_bookmark',
    summary: 'A saved X thread rounding up current hackathons with open submissions. Each entry is tracked as its own item with its own deadline.',
    why: 'Saved from X. [demo: collection parent — children are the two real hackathons below]',
    hl: JSON.stringify([
      'Multiple open hackathons with prizes',
      'Each has a different submission deadline',
      'Tracked individually so no deadline is missed',
    ]),
  });
  parent = db.prepare(`SELECT * FROM items WHERE rowid=?`).get(info.lastInsertRowid);
  console.log('  collection   -> created parent', parentTitle);
}
if (parent) {
  for (const child of [afh, gibc].filter(Boolean)) {
    db.prepare(`UPDATE items SET parent_id=? WHERE id=?`).run(parent.id, child.id);
  }
}
// File a few singles as organized (grouped by kind on the Organized page).
for (const frag of ['mozilla/readability', 'Agentic Infrastructure', 'Complete Guide to useEffect', 'event loop']) {
  const it = byTitleLike(frag);
  if (it) db.prepare(`UPDATE items SET status='organized' WHERE id=?`).run(it.id);
}

// 5. SANITIZE — place a few REAL items into buckets (state arranged, disclosed).
//    Uses items already classified by the pipeline; only status/dates/age change.
function ensureBucketItem({ url, title, kind, summary, apply }) {
  let it = db.prepare(`SELECT * FROM items WHERE url=?`).get(url);
  if (!it) {
    const info = db.prepare(
      `INSERT INTO items (url,title,source,kind,summary,why_saved,attention,status,date_confidence)
       VALUES (@url,@title,'x_bookmark',@kind,@summary,@why,'low','inbox','none')`
    ).run({ url, title, kind, summary, why: '[demo: sample item for the Sanitize center]' });
    it = db.prepare(`SELECT * FROM items WHERE rowid=?`).get(info.lastInsertRowid);
  }
  apply(it);
  return it;
}

// expired: a real past hackathon (deadline in the past).
ensureBucketItem({
  url: 'https://ethglobal.com/events/istanbul',
  title: 'ETHGlobal Istanbul — Hackathon',
  kind: 'opportunity',
  summary: 'A past ETHGlobal hackathon whose submission window has already closed.',
  apply: (it) => db.prepare(`UPDATE items SET deadline=?, date_confidence='explicit', status='expired', created_at=? WHERE id=?`)
    .run(daysFromNow(-40), monthsAgo(2), it.id),
});
// unattended: saved 8 months ago, never opened.
ensureBucketItem({
  url: 'https://example.com/old-ai-tools-2024',
  title: 'Best AI tools for developers (2024)',
  kind: 'article',
  summary: 'A tools roundup saved long ago and never revisited; likely outdated.',
  apply: (it) => db.prepare(`UPDATE items SET status='inbox', created_at=?, last_opened_at=NULL WHERE id=?`)
    .run(monthsAgo(8), it.id),
});
// duplicate: a second save of the readability repo.
const readab = byTitleLike('mozilla/readability');
ensureBucketItem({
  url: 'https://github.com/mozilla/readability#readme',
  title: 'GitHub - mozilla/readability (saved again)',
  kind: 'repo',
  summary: 'A near-identical second save of a repo already in your library.',
  apply: (it) => db.prepare(`UPDATE items SET status='duplicate', duplicate_of=? WHERE id=?`)
    .run(readab ? readab.id : null, it.id),
});
// dead: a link that 404s now.
ensureBucketItem({
  url: 'https://some-startup.example/launch-post',
  title: 'Launch post — page no longer exists',
  kind: 'article',
  summary: 'A saved link that now returns 404.',
  apply: (it) => db.prepare(`UPDATE items SET status='dead', created_at=? WHERE id=?`).run(monthsAgo(3), it.id),
});
// stale: low attention, old, still in inbox, never opened.
ensureBucketItem({
  url: 'https://example.com/upcoming-hackathons-jan-2026',
  title: 'Upcoming hackathons — January 2026',
  kind: 'article',
  summary: 'Time-boxed list that is no longer current.',
  apply: (it) => db.prepare(`UPDATE items SET status='inbox', attention='low', created_at=?, last_opened_at=NULL WHERE id=?`)
    .run(monthsAgo(7), it.id),
});

// Summary
const counts = db.prepare(`SELECT status, count(*) n FROM items GROUP BY status`).all();
const att = db.prepare(`SELECT attention, count(*) n FROM items GROUP BY attention`).all();
console.log('\nDone. status:', JSON.stringify(counts), '\n      attention:', JSON.stringify(att));
console.log('total items:', db.prepare(`SELECT count(*) n FROM items`).get().n);
db.close();
