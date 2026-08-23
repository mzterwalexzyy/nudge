#!/usr/bin/env node
/** Executes the built content scripts in JSDOM and fails on contract regressions. */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const bookmarkScript = fs.readFileSync(path.join(root, 'dist', 'x-bookmark-listener.js'), 'utf8');
const agreementScript = fs.readFileSync(path.join(root, 'dist', 'agreement-detector.js'), 'utf8');

function verifyNativeBookmarkListener() {
  const dom = new JSDOM(`<!doctype html><html><body>
    <article data-testid="tweet">
      <div data-testid="User-Name"><a href="/alice">Alice</a></div>
      <a href="/alice/status/123456789"><time datetime="2026-08-23T10:00:00.000Z">now</time></a>
      <div data-testid="tweetText">Build useful agents at the linked hackathon.</div>
      <a href="https://example.com/hackathon">Hackathon rules</a>
      <div data-testid="tweetPhoto"><img src="https://images.example.com/poster.png" /></div>
      <button id="add" data-testid="bookmark"><span>Bookmark</span></button>
      <button id="remove" data-testid="removeBookmark"><span>Remove</span></button>
    </article>
  </body></html>`, {
    url: 'https://x.com/home',
    runScripts: 'outside-only',
  });

  const messages = [];
  let delegatedClickListeners = 0;
  const originalAdd = dom.window.document.addEventListener.bind(dom.window.document);
  dom.window.document.addEventListener = function patched(type, listener, options) {
    if (type === 'click') delegatedClickListeners += 1;
    return originalAdd(type, listener, options);
  };
  dom.window.chrome = {
    runtime: {
      lastError: null,
      sendMessage(message, callback) {
        messages.push(message);
        callback?.({ ok: true, result: { ok: true, deduplicated: false } });
      },
    },
  };

  dom.window.eval(bookmarkScript);
  dom.window.eval(bookmarkScript); // reinjection must not attach a second listener
  assert.equal(delegatedClickListeners, 1, 'exactly one delegated click listener must be attached');

  dom.window.document.getElementById('add').dispatchEvent(
    new dom.window.MouseEvent('click', { bubbles: true, cancelable: true }),
  );
  assert.equal(messages.length, 1, 'bookmark ADD must send exactly one capture');
  const capture = messages[0].capture;
  assert.equal(messages[0].type, 'CAPTURE');
  assert.equal(capture.url, 'https://x.com/alice/status/123456789');
  assert.equal(capture.source, 'x_bookmark');
  assert.equal(capture.author, '@alice');
  assert.equal(capture.text, 'Build useful agents at the linked hackathon.');
  assert.equal(capture.timestamp, '2026-08-23T10:00:00.000Z');
  assert.deepEqual([...capture.links], ['https://example.com/hackathon']);
  assert.deepEqual([...capture.media], ['https://images.example.com/poster.png']);
  assert.match(capture.bookmarked_at, /^\d{4}-\d{2}-\d{2}T/);

  dom.window.document.getElementById('remove').dispatchEvent(
    new dom.window.MouseEvent('click', { bubbles: true, cancelable: true }),
  );
  assert.equal(messages.length, 1, 'removeBookmark must not send any capture');

  return { delegatedClickListeners, addMessages: messages.length, capture };
}

function verifyAgreementPanel() {
  const dom = new JSDOM(`<!doctype html><html><head><title>Terms of Service</title></head>
    <body><main><h1>Terms of Service</h1><p>These terms govern use of the service.</p></main></body></html>`, {
    url: 'https://example.com/terms',
    runScripts: 'outside-only',
  });

  const clauses = [
    { label: 'Content license', level: 'high', plain_explanation: 'Uploads grant a broad service license.' },
    { label: 'Term changes', level: 'important', plain_explanation: 'The provider may update terms after notice.' },
    { label: 'Cancellation', level: 'review', plain_explanation: 'Cancellation applies at the next billing period.' },
  ];
  dom.window.chrome = {
    runtime: {
      lastError: null,
      sendMessage(message, callback) {
        assert.equal(message.type, 'ANALYZE_AGREEMENT');
        callback({ ok: true, result: { clauses } });
      },
    },
  };

  dom.window.eval(agreementScript);
  const badge = dom.window.document.getElementById('sb-badge');
  assert.ok(badge, 'agreement heuristic must inject its quiet badge');
  badge.click();
  const panel = dom.window.document.getElementById('sb-panel');
  assert.ok(panel, 'clicking the badge must render a clause panel');
  assert.match(panel.textContent, /3 things worth knowing/);
  for (const clause of clauses) assert.match(panel.textContent, new RegExp(clause.label));
  return { badgeDetected: true, renderedClauses: clauses.length };
}

function verifyHostedConnection() {
  const hostedOrigin = 'https://second-brain-ui09.onrender.com';
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'dist', 'manifest.json'), 'utf8'));
  const popupHtml = fs.readFileSync(path.join(root, 'dist', 'popup.html'), 'utf8');
  const popupScript = fs.readFileSync(path.join(root, 'dist', 'popup.js'), 'utf8');
  const backgroundScript = fs.readFileSync(path.join(root, 'dist', 'background.js'), 'utf8');

  assert.ok(manifest.host_permissions.includes(`${hostedOrigin}/*`), 'manifest must permit the hosted NUDGE API');
  assert.ok(!manifest.host_permissions.includes('http://localhost:3005/*'), 'production extension must not request localhost access');
  assert.match(popupHtml, /id="token"/);
  assert.doesNotMatch(popupHtml, /id="api"|Local dashboard/i, 'judges should only need to enter a token');
  for (const bundle of [popupScript, backgroundScript]) {
    assert.ok(bundle.includes(hostedOrigin), 'connection bundles must use the hosted NUDGE origin');
    assert.ok(!bundle.includes('http://localhost:3005'), 'connection bundles must not default to localhost');
  }

  return { hostedOrigin, tokenOnlyPopup: true };
}

const evidence = {
  hostedConnection: verifyHostedConnection(),
  nativeBookmark: verifyNativeBookmarkListener(),
  agreement: verifyAgreementPanel(),
};
console.log(JSON.stringify(evidence, null, 2));
console.log('PASS: built extension listener, agreement-panel, and hosted-connection contracts hold.');
