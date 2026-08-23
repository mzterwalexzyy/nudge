# NUDGE Layer

An AI intelligence layer for things you save and things you are about to agree to.

## Architecture

- `pipeline` — shared ingest, classify, dates, attention, embeddings, profile-scoped dedup, agreement analysis, and collection fan-out
- `dashboard` — Next.js account/demo entry, attention-ranked feed, user categories, and confirmed cleanup UI
- `extension` — Manifest V3 native X bookmark listener and agreement-page detector

## Judge quick start

**Hosted demo:** [https://second-brain-uio9.onrender.com](https://second-brain-uio9.onrender.com)

The hosted app runs on Render Free, so the first request may need time to wake. Then:

1. Select **Try Demo**. NUDGE creates a fresh, isolated 24-hour judge profile and opens `/overview`; no signup is required.
2. Review the attention totals and ranked items on **Overview**, then open **Inbox**, **Organized**, **Agreements**, and **Sanitize**. Demo changes are scoped to this profile, and cleanup never runs without explicit confirmation.
3. Use **Save** for a direct URL capture, or follow the extension walkthrough below to test native X bookmarks and agreement detection.

### Test the Chrome extension

The extension is intentionally pinned to the hosted NUDGE origin. Judges enter only a profile token; there is no server URL to configure.

1. Install dependencies and build the unpacked extension from the repository root:

   ```powershell
   npm install
   npm run build --workspace=@second-brain/extension
   ```

2. Open `chrome://extensions`, enable **Developer mode**, and choose **Load unpacked**. Select `extension/dist`. Disable or remove older NUDGE installations so only one build is active.
3. In the hosted demo, open **Profile → Browser extension**, select **Generate connection token**, and copy the token. NUDGE displays the plaintext once and stores only its SHA-256 digest on the server.
4. Open the NUDGE extension popup, paste the token, and select **Connect**.
5. If X was already open when the extension was built or reloaded, fully refresh or reopen the X tab. Otherwise Chrome leaves the previous content-script context invalidated.
6. Open an unbookmarked post on `x.com` and select X's native **Bookmark** control. NUDGE acts only on the ADD action; removing a bookmark is intentionally ignored.
7. Optional verification: open the X page console and look for `[NUDGE] capture stored.` Return to NUDGE and confirm the new item in **Inbox** or the relevant dashboard collection.
8. To test agreement analysis, visit a public terms, privacy, or agreement page. Open the quiet NUDGE badge to review the 3–5 clauses the analysis considers most important.

A successful X response may report `fallback:NO readable text extracted` for an outbound link. This is not a failed bookmark: NUDGE keeps the live tweet text when the linked page is blocked, empty, or unreadable.

### Judge troubleshooting

| Symptom | Resolution |
|---|---|
| Render is slow on first load | Wait for the free service to wake, then refresh once. |
| Extension reports HTTP 404 | Rebuild `extension/dist`, reload the unpacked extension, and refresh the X tab. Confirm the extension was loaded from this repository and that only one NUDGE installation is enabled. |
| Console says `Extension context invalidated` | The extension was reloaded while the page remained open. Fully refresh or reopen the X tab. |
| Extension reports HTTP 401 | The profile token is stale, expired, rotated, or was erased by a Render restart. Start a fresh demo if needed, generate a new token from **Profile**, and reconnect the popup. |
| Bookmark click produces no new item | NUDGE captures only the native ADD action. If the post is already bookmarked, remove it and select Bookmark again. |
| X displays source-map, SSL, CSP, or `aria-hidden` warnings | These are X/browser messages and are unrelated to NUDGE capture. Use the `[NUDGE]` console lines as the extension signal. |

Render Free stores SQLite at `/tmp/nudge.sqlite`. A redeploy or instance replacement can erase demo profiles, registered accounts, generated tokens, and mutations. **Try Demo** recreates an isolated profile, after which a new extension token must be generated.

## How Kiro was used

NUDGE was developed with Kiro's spec-driven workflow. The active [`.kiro/specs/nudge-production.md`](.kiro/specs/nudge-production.md) specification defines production behavior and security invariants for demo isolation, profile-scoped access, authentication, extension credentials, truthful UI state, responsive UX, and deployment boundaries. Kiro was used to trace these requirements across the Next.js dashboard, SQLite intelligence pipeline, and Manifest V3 extension; implement focused remediations; and turn critical requirements into repeatable dashboard and extension verification checks before shipping.

## Local setup

1. Run `npm install` from this directory.
2. Copy `.env.example` to `.env` and fill the required values.
3. Start the dashboard with `npm run dev --workspace=@second-brain/dashboard`.
4. Build the extension with `npm run build --workspace=@second-brain/extension`, then load `extension/dist` as an unpacked Chrome extension.
5. Create or sign in to an account, open **Profile**, generate a connection token, and enter that token in the extension popup. The shared `SECOND_BRAIN_CAPTURE_TOKEN` remains a local legacy fallback only.

## Environment

| Variable | Required | Purpose |
|---|---:|---|
| `AI_PROVIDER` | No | Defaults to `groq`; set `gemini` to swap adapters without code changes. |
| `GROQ_API_KEY` | For Groq | Completion key. Groq has no embedding endpoint, so the app uses its deterministic local embedding fallback. |
| `GEMINI_API_KEY` | For Gemini | Completion and embedding key when `AI_PROVIDER=gemini`. |
| `SESSION_SECRET` | Production | Secret of at least 32 characters used to sign 15-minute HttpOnly sessions. |
| `APP_URL` | Outside Render | Public HTTPS origin used by the same-origin mutation boundary. Render supplies `RENDER_EXTERNAL_URL` automatically. |
| `DB_PATH` | Production | SQLite path. Render Free uses ephemeral `/tmp/nudge.sqlite`; development defaults to `pipeline/data/second-brain.db`. |
| `DEMO_SOURCE_ACCOUNT_ID` | Recommended | Reviewed seed account copied into each isolated, temporary Demo profile. |
| `SECOND_BRAIN_CAPTURE_TOKEN` | Local fallback only | Legacy shared bearer token for local extension development. Hosted users generate per-profile tokens. |
| `SECOND_BRAIN_ACCOUNT_ID` | Local fallback only | Account scope for local pipeline and legacy-token captures; defaults to `local`. |

Never commit `.env`, API keys, session secrets, capture tokens, or database files.

## Render Free demo deployment

`render.yaml` deploys a free web service, injects a generated session secret, and stores SQLite at `/tmp/nudge.sqlite`. Render supplies the public HTTPS origin through `RENDER_EXTERNAL_URL`, so the assigned service URL works without a hardcoded hostname. On every fresh instance, NUDGE seeds an empty database before starting Next.

This Free configuration is intended for judging and demo video use only. The filesystem is ephemeral: registered accounts, generated extension credentials, saved links, renamed categories, and demo mutations can disappear whenever Render replaces or redeploys the instance. A fresh **Try the demo** request will recreate an isolated profile from the reviewed seed. Move `DB_PATH` to a persistent disk or external database before onboarding real users.

The landing page provides two explicit paths: **Try the demo** creates a fresh 24-hour isolated profile from the reviewed seed, while **Get started** creates a bcrypt-protected account. Profile reads, dashboard mutations, categories, cleanup, direct Save, and semantic deduplication are scoped to the signed-in profile.

## Verification

```powershell
npm run verify:ai
npm run verify:db
npm run pipeline -- pipeline/urls.txt --no-live --no-fanout
node pipeline/scripts/run-agreement.mjs "https://policies.google.com/terms"
npm run build --workspace=@second-brain/dashboard
npm run build --workspace=@second-brain/extension
```

The live-model scripts print real output. Review every URL block: the pipeline CLI historically continued after individual URL failures, so process exit alone is not sufficient evidence.

## Capture behavior and limits

- A single document-level listener watches X's native `data-testid="bookmark"` control and acts only on ADD. `removeBookmark` is intentionally ignored.
- Tweet URL, author, text, timestamp, media, and outbound links come from the live DOM. Missing required selectors fail loudly; no capture data is fabricated.
- The server fetches a public outbound page when present and records whether it resolved or fell back to tweet text. Private/local URLs, nonstandard ports, large responses, and unsafe redirects are rejected.
- Agreement pages are fetched server-side first, analyzed into 3–5 ranked clauses, and rendered in the in-page panel.
- Retroactive X bookmark import is premium and intentionally not built. Future paths are best-effort DOM scrolling (fragile beta) or the paid official X bookmarks API.
- No cleanup runs automatically. The UI proposes each bucket and requires explicit confirmation before mutation; permanent delete is clearly identified.
