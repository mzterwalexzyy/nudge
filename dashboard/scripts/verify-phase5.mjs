#!/usr/bin/env node
/**
 * Repeatable local production contract verification.
 *
 * Uses labeled fixtures in a disposable DB. It verifies authenticated routes,
 * isolated demos, attention visibility, category flexibility, and confirmed
 * cleanup boundaries. Live AI and logged-in-X checks remain separate.
 */

import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';

const dashboardDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const root = path.join(dashboardDir, '..');
const dbPath = path.join(root, 'pipeline', 'data', 'phase5-contract.db');
const account = 'phase5-contract';
const port = 3015;
const base = `http://127.0.0.1:${port}`;
const sessionSecret = 'phase5-contract-session-secret-32-characters-minimum';

for (const suffix of ['', '-wal', '-shm']) fs.rmSync(dbPath + suffix, { force: true });
process.env.DB_PATH = dbPath;
const store = await import('../../pipeline/src/db.mjs');
store.initSchema();
store.migrateSchema();
store.migrateColumns();
store.closeDb();

const fixture = new Database(dbPath);
const insert = fixture.prepare(`
  INSERT INTO items (id,url,title,raw_text,source,kind,summary,deadline,date_confidence,
    action_required,attention,status,created_at,last_seen_at,duplicate_of,user_id)
  VALUES (@id,@url,@title,@raw_text,'paste','article',@summary,@deadline,@date_confidence,
    @action_required,@attention,@status,@created_at,@created_at,@duplicate_of,@user_id)
`);
const baseRow = {
  raw_text: 'Production cleanup contract fixture; not AI verification evidence.',
  summary: 'Test-only production fixture.',
  date_confidence: 'none',
  action_required: 0,
  attention: 'low',
  duplicate_of: null,
  user_id: account,
};
const inFourDays = new Date(Date.now() + (4 * 86400000)).toISOString().slice(0, 10);
insert.run({ ...baseRow, id: 'phase5-expired', url: 'https://example.com/expired', title: '[TEST] Expired item', deadline: '2025-01-01', date_confidence: 'explicit', status: 'expired', created_at: '2025-01-01 00:00:00' });
insert.run({ ...baseRow, id: 'phase5-original', url: 'https://example.com/original', title: '[TEST] Original item', deadline: null, status: 'organized', created_at: '2026-08-20 00:00:00' });
insert.run({ ...baseRow, id: 'phase5-duplicate', url: 'https://example.com/duplicate', title: '[TEST] Duplicate item', deadline: null, status: 'duplicate', duplicate_of: 'phase5-original', created_at: '2026-08-20 00:00:00' });
insert.run({ ...baseRow, id: 'phase5-stale', url: 'https://example.com/stale', title: '[TEST] Stale item', deadline: null, status: 'inbox', created_at: '2025-01-01 00:00:00' });
insert.run({ ...baseRow, id: 'phase5-review', url: 'https://example.com/review', title: '[TEST] Needs review item', deadline: null, attention: 'review', status: 'inbox', created_at: '2026-08-22 00:00:00' });
insert.run({ ...baseRow, id: 'phase5-approaching', url: 'https://example.com/approaching', title: '[TEST] Approaching deadline', deadline: inFourDays, date_confidence: 'explicit', status: 'inbox', created_at: '2026-08-22 00:00:00' });
fixture.close();

const nextBin = path.join(root, 'node_modules', 'next', 'dist', 'bin', 'next');
const server = spawn(process.execPath, [nextBin, 'start', '-p', String(port)], {
  cwd: dashboardDir,
  env: {
    ...process.env,
    DB_PATH: dbPath,
    SESSION_SECRET: sessionSecret,
    APP_URL: base,
    SECOND_BRAIN_ACCOUNT_ID: account,
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let serverOutput = '';
server.stdout.on('data', (chunk) => { serverOutput += chunk.toString(); });
server.stderr.on('data', (chunk) => { serverOutput += chunk.toString(); });

async function waitForServer() {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (server.exitCode != null) throw new Error(`Next server exited early:\n${serverOutput}`);
    try {
      const response = await fetch(base);
      if (response.ok) return;
    } catch { /* retry */ }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Timed out waiting for Next server:\n${serverOutput}`);
}

function cookieFrom(response) {
  const value = response.headers.get('set-cookie') || '';
  assert.ok(value, 'authentication response must set a session cookie');
  return value.split(';', 1)[0];
}

async function postJson(route, body, cookie = '', origin = base) {
  return fetch(`${base}${route}`, {
    method: 'POST',
    redirect: 'manual',
    headers: {
      'content-type': 'application/json',
      origin,
      ...(cookie ? { cookie } : {}),
    },
    body: JSON.stringify(body),
  });
}

async function postCleanup(body, cookie, origin = base) {
  return postJson('/api/cleanup', body, cookie, origin);
}

try {
  await waitForServer();

  const landingHtml = await (await fetch(base)).text();
  assert.match(landingHtml, /Try the demo/);
  assert.match(landingHtml, /Get started/);

  const demoAResponse = await fetch(`http://localhost:${port}/api/auth/demo`, { method: 'POST', redirect: 'manual', headers: { origin: base } });
  const demoBResponse = await fetch(`${base}/api/auth/demo`, { method: 'POST', redirect: 'manual', headers: { origin: base } });
  assert.equal(demoAResponse.status, 303);
  assert.equal(demoBResponse.status, 303);
  assert.equal(demoAResponse.headers.get('location'), `${base}/overview`);
  assert.equal(demoBResponse.headers.get('location'), `${base}/overview`);
  const demoACookie = cookieFrom(demoAResponse);
  const demoBCookie = cookieFrom(demoBResponse);
  const legacyOverview = await fetch(`${base}/needs-attention`, {
    redirect: 'manual',
    headers: { cookie: demoACookie },
  });
  assert.equal(legacyOverview.status, 308);
  assert.equal(legacyOverview.headers.get('location'), '/overview');

  let check = new Database(dbPath);
  const demos = check.prepare("SELECT id FROM users WHERE account_type = 'demo' ORDER BY created_at, id").all();
  assert.equal(demos.length, 2, 'each Demo request must create a profile');
  const demoCounts = demos.map(({ id }) => check.prepare('SELECT COUNT(*) AS n FROM items WHERE user_id = ?').get(id).n);
  assert.deepEqual(demoCounts, [6, 6], 'each demo must receive the complete reviewed fixture');
  const sharedDemoIds = check.prepare(`SELECT COUNT(*) AS n FROM items a JOIN items b ON a.id = b.id
    WHERE a.user_id = ? AND b.user_id = ?`).get(demos[0].id, demos[1].id).n;
  assert.equal(sharedDemoIds, 0, 'demo item IDs must not overlap');
  const crossProfileRelations = check.prepare(`SELECT COUNT(*) AS n FROM items i
    LEFT JOIN items p ON p.id = i.parent_id
    LEFT JOIN items d ON d.id = i.duplicate_of
    WHERE i.user_id IN (?, ?) AND ((i.parent_id IS NOT NULL AND p.user_id != i.user_id)
      OR (i.duplicate_of IS NOT NULL AND d.user_id != i.user_id))`).get(demos[0].id, demos[1].id).n;
  assert.equal(crossProfileRelations, 0, 'demo relationships must stay inside their profile');
  check.close();

  assert.equal((await fetch(`${base}/overview`, { headers: { cookie: demoACookie } })).status, 200);
  assert.equal((await fetch(`${base}/overview`, { headers: { cookie: demoBCookie } })).status, 200);

  const email = 'phase5@example.com';
  const password = 'production-contract-password';
  const registration = await postJson('/api/auth/register', {
    displayName: 'Phase Five',
    email,
    password,
  });
  const registrationText = await registration.text();
  assert.equal(registration.status, 201, registrationText);
  const registrationResult = JSON.parse(registrationText);
  assert.equal(registrationResult.redirect, '/overview');
  const setCookie = registration.headers.get('set-cookie') || '';
  assert.match(setCookie, /HttpOnly/i);
  assert.match(setCookie, /SameSite=Lax/i);
  assert.match(setCookie, /Max-Age=900/i);
  const userCookie = cookieFrom(registration);

  const login = await postJson('/api/auth/login', { email, password });
  assert.equal(login.status, 200, await login.clone().text());
  assert.equal((await login.json()).redirect, '/overview');

  check = new Database(dbPath);
  const user = check.prepare('SELECT id, password_hash FROM users WHERE email = ?').get(email);
  assert.ok(user?.password_hash?.startsWith('$2'), 'registered password must be a bcrypt hash');
  check.prepare('UPDATE items SET user_id = ? WHERE user_id = ?').run(user.id, account);
  check.close();

  const routes = ['/', '/overview', '/inbox', '/organized', '/sanitize', '/agreements', '/profile'];
  const routeStatuses = {};
  for (const route of routes) {
    const response = await fetch(base + route, { headers: { cookie: userCookie } });
    routeStatuses[route] = response.status;
    assert.equal(response.status, 200, `${route} must render`);
  }

  const attentionHtml = await (await fetch(`${base}/overview`, { headers: { cookie: userCookie } })).text();
  assert.match(attentionHtml, /\[TEST\] Needs review item/);
  assert.match(attentionHtml, /\[TEST\] Approaching deadline/);

  const sanitizeHtml = await (await fetch(`${base}/sanitize`, { headers: { cookie: userCookie } })).text();
  assert.match(sanitizeHtml, /Import \(Premium\)/);
  assert.match(sanitizeHtml, /disabled/);
  assert.match(sanitizeHtml, /Run Smart Cleanup/);

  const unauthenticatedCleanup = await postCleanup({ ids: ['phase5-duplicate'], bucket: 'duplicates', confirmed: true }, '');
  assert.equal(unauthenticatedCleanup.status, 401, 'cleanup requires a session');
  const crossOriginCleanup = await postCleanup({ ids: ['phase5-duplicate'], bucket: 'duplicates', confirmed: true }, userCookie, 'https://attacker.example');
  assert.equal(crossOriginCleanup.status, 403, 'cleanup rejects cross-origin requests');
  const schemeMismatchCleanup = await postCleanup(
    { ids: ['phase5-duplicate'], bucket: 'duplicates', confirmed: true },
    userCookie,
    `https://127.0.0.1:${port}`,
  );
  assert.equal(schemeMismatchCleanup.status, 403, 'cleanup compares the complete origin, including scheme');

  const logout = await fetch(`${base}/api/auth/logout`, {
    method: 'POST',
    redirect: 'manual',
    headers: { origin: base, cookie: userCookie },
  });
  assert.equal(logout.status, 303);
  assert.equal(logout.headers.get('location'), `${base}/`);

  const renamed = await postJson('/api/categories', { action: 'rename', categoryKey: 'article', name: 'Research Library' }, userCookie);
  assert.equal(renamed.status, 200, await renamed.text());
  const moved = await postJson('/api/categories', { action: 'move', itemId: 'phase5-original', newCategoryName: 'Reading List' }, userCookie);
  assert.equal(moved.status, 200, `category move returned ${moved.status}`);
  const moveResult = await moved.json();
  check = new Database(dbPath, { readonly: true });
  const movedItem = check.prepare('SELECT kind, category_key FROM items WHERE id = ? AND user_id = ?').get('phase5-original', user.id);
  check.close();
  assert.equal(movedItem.kind, 'article', 'moving an item must preserve its AI kind');
  assert.equal(movedItem.category_key, moveResult.category_key, 'moving stores only the user category override');

  const unconfirmed = await postCleanup({ ids: ['phase5-duplicate'], bucket: 'duplicates' }, userCookie);
  assert.equal(unconfirmed.status, 409, 'cleanup without confirmed=true must be blocked');
  check = new Database(dbPath, { readonly: true });
  assert.ok(check.prepare('SELECT id FROM items WHERE id = ?').get('phase5-duplicate'), 'blocked cleanup must not mutate');
  check.close();

  const wrongBucket = await postCleanup({ ids: ['phase5-duplicate'], bucket: 'dead', confirmed: true }, userCookie);
  assert.equal(wrongBucket.status, 409, 'ids outside the reviewed bucket must be blocked');

  const duplicateResponse = await postCleanup({ ids: ['phase5-duplicate'], bucket: 'duplicates', confirmed: true }, userCookie);
  assert.equal(duplicateResponse.status, 200);
  const duplicateResult = await duplicateResponse.json();
  assert.equal(duplicateResult.updated, 1);
  assert.equal(duplicateResult.action, 'delete');

  const staleResponse = await postCleanup({ ids: ['phase5-stale'], bucket: 'stale', confirmed: true }, userCookie);
  assert.equal(staleResponse.status, 200);
  const staleResult = await staleResponse.json();
  assert.equal(staleResult.updated, 1);
  assert.equal(staleResult.action, 'stale');

  check = new Database(dbPath, { readonly: true });
  const finalRows = check.prepare('SELECT id,status FROM items WHERE user_id = ? ORDER BY id').all(user.id);
  check.close();
  assert.ok(!finalRows.some((row) => row.id === 'phase5-duplicate'));
  assert.equal(finalRows.find((row) => row.id === 'phase5-stale')?.status, 'stale');

  console.log(JSON.stringify({
    routeStatuses,
    demos: { profiles: demos.length, itemCounts: demoCounts, sharedItemIds: sharedDemoIds },
    attention: { reviewVisible: true, fiveDayWindowVisible: true },
    categories: { renamed: 'Research Library', movedKindPreserved: movedItem.kind },
    mutationBoundary: { unauthenticated: unauthenticatedCleanup.status, crossOrigin: crossOriginCleanup.status },
    premiumBackfill: 'visible and disabled',
    cleanup: {
      unconfirmedStatus: unconfirmed.status,
      wrongBucketStatus: wrongBucket.status,
      duplicate: duplicateResult,
      stale: staleResult,
      finalRows,
    },
  }, null, 2));
  console.log('PASS: authenticated production, isolated demo, attention, category, and cleanup contracts hold.');
} finally {
  server.kill();
  await new Promise((resolve) => {
    if (server.exitCode != null) resolve();
    else server.once('exit', resolve);
    setTimeout(resolve, 3000);
  });
}
