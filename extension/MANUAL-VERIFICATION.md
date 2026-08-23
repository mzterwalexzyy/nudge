# Logged-in X manual verification (required before claiming live capture DONE)

These checks require a real Chrome profile logged into X. Automated DOM/API evidence does **not** replace them.

## Setup

1. In the project `.env`, set `AI_PROVIDER=groq`, a working `GROQ_API_KEY`, and a long random `SECOND_BRAIN_CAPTURE_TOKEN`. Do not expose the token in screenshots.
2. Run `npm run build --workspace=@second-brain/dashboard` and `npm run build --workspace=@second-brain/extension`.
3. Start the dashboard with `npm run dev --workspace=@second-brain/dashboard`.
4. Open `chrome://extensions`, enable Developer mode, choose **Load unpacked**, and select `extension/dist`.
5. Open the extension popup, leave the dashboard URL at `http://localhost:3005`, enter the same capture token, and click **Connect**.
6. Open the extension service-worker inspector from `chrome://extensions` and keep its Network and Console panels open. Never include the Authorization value in evidence.

## A — native bookmark, real near-deadline hackathon

1. Open a real X post linking to a hackathon whose page clearly states a current deadline.
2. Click X's own control with `data-testid="bookmark"`; click no NUDGE save control (none is injected).
3. In the service-worker Network panel, verify one `POST /api/ingest` returns 200.
4. Open `/needs-attention` and verify the real title, model summary, explicit countdown, and attention color. The deadline must be supported by tweet or linked-page text.
5. Capture screenshots of the X post/bookmark state and dashboard row. Record the request time and resulting item id.

## B — plain non-deadline post

1. Bookmark a real ordinary post with no event/application/submission date.
2. Verify one ingest request and one dashboard row with a plausible kind/summary.
3. Verify `deadline` is null and the UI does not invent a countdown.

## C — linked article fetch

1. Bookmark a real post containing one external article link.
2. Verify the ingest response has `content_source: "resolved"` and a `linked_url`.
3. Without editing the DB, inspect evidence from the project directory:

```powershell
node --input-type=module -e "import Database from 'better-sqlite3'; const db=new Database('./pipeline/data/second-brain.db',{readonly:true}); const row=db.prepare(\"SELECT title,summary,substr(raw_text,1,500) raw_text_sample,linked_url,linked_fetch_status FROM items WHERE source='x_bookmark' ORDER BY created_at DESC LIMIT 1\").get(); console.log(JSON.stringify(row,null,2)); db.close();"
```

4. Confirm `raw_text_sample` includes `LINKED PAGE` and facts from the destination, not only tweet text.

## D — un-bookmark does nothing

1. Note the current row count for the post URL (read-only query or dashboard state).
2. Click X's own `data-testid="removeBookmark"` control.
3. Confirm the service-worker Network panel shows no new `/api/ingest` request and row count does not change.
4. Re-bookmarking may send a request, but the exact-URL guard must return `deduplicated: true` and the row id must remain the same.

## E — prove live DOM payload

1. Select the successful `/api/ingest` request in the service-worker Network panel.
2. In **Payload**, verify the real `url`, `source: "x_bookmark"`, `title`, `text`, `links`, `author`, `timestamp`, `media`, and `bookmarked_at` values match the visible X post.
3. Redact the Authorization header/token. Capture the payload screenshot and response screenshot.
4. In the X page console, verify there are no selector warnings. A warning about missing `article[data-testid="tweet"]`, status URL, or `tweetText` means the selector contract failed and the check is not a pass.

## Agreement page

1. Visit a real Terms/Privacy page outside X.
2. Confirm the quiet NUDGE badge appears; click it.
3. Verify the in-page panel renders 3–5 ranked, measured clauses and `/agreements` stores the same analysis.

Until A–E and the agreement check are actually performed and recorded, the honesty ledger must say **PARTIAL — requires manual logged-in-X run**, not DONE.
