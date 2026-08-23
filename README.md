# NUDGE Layer

An AI intelligence layer for things you save and things you are about to agree to.

## Architecture

- `pipeline` — shared ingest, classify, dates, attention, embeddings, profile-scoped dedup, agreement analysis, and collection fan-out
- `dashboard` — Next.js account/demo entry, attention-ranked feed, user categories, and confirmed cleanup UI
- `extension` — Manifest V3 native X bookmark listener and agreement-page detector

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
