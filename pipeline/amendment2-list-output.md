# Amendment 2 — Change 2: List Detection & Fan-Out (real output)

Provider: Groq `openai/gpt-oss-20b`. Live output via `run-pipeline.mjs` + `verify-fanout-attention.mjs`. Not hardcoded.

## Test post (real): "All Upcoming Google Cloud Hackathons in 2026"
URL: https://mansimore3.substack.com/p/all-upcoming-google-cloud-hackathons
Ingest: ok, 3819 chars, 28 outbound links.

### Result: 1 collection PARENT + 4 opportunity CHILDREN
Parent (kind=`collection`, status=`organized`, deadline=null) with a whole-list summary + 4 highlights naming each event.

Children (each run through the SAME classify+extractDates+assignAttention chain), persisted with `parent_id` = parent id:

| # | Child title | deadline | date_confidence | status |
|---|-------------|----------|-----------------|--------|
| 1.1 | Team USA x Google Cloud Hackathon | 2026-05-11 | explicit | expired (past today 2026-08-22) |
| 1.2 | Google Cloud Rapid Agent Hackathon | 2026-06-11 | explicit | expired |
| 1.3 | The Gemma 4 Good Hackathon | **null** | **none** | inbox |
| 1.4 | Google I/O Build with AI Hackathon | **null** | **none** | inbox |

DB check confirmed: TOTAL 5 rows, 1 collection (parent_id NULL) + 4 opportunity (all parent_id=24aae72c...).

### Verification against the amendment's definition of done
1. Parent collection + multiple children with parent_id: **YES**.
2. Children with clearly stated dates get correct deadlines: **YES** (Team USA May 11, Rapid Agent Jun 11 — both explicit, correctly parsed). They are past relative to 2026-08-22 so honestly marked expired.
3. No-clear-date entries -> deadline null + date_confidence 'none', NOT a made-up date: **YES**. Gemma 4 Good gives a *range* ("April 2 to May 18"), I/O gives an *event date* ("held May 22") — the model correctly declined to invent a submission deadline from either.

### Needs-Attention ordering (children with FUTURE explicit deadlines)
Because the roundup's real events are all in the past relative to today, `verify-fanout-attention.mjs` re-evaluates the SAME real entries as-of 2026-04-01 (only the "now" reference shifts; entries/dates are the page's real content):
```
1. [REVIEW] 2026-05-11 (in 40d)  Team USA x Google Cloud Hackathon
2. [REVIEW] 2026-06-11 (in 71d)  Google Cloud Rapid Agent Hackathon
```
Sorted nearest-first, each with its own independent attention. Confirms children flow into Needs Attention independently.

## Single-item path unchanged (no false positives)
`detectMultiplicity` on single pages returns `single`:
- https://github.com/mozilla/readability => single
- https://agentsforhumans.devpost.com/rules => single

## Fallback (degrade to single, never error)
- Messy/ambiguous noise text => `single`, tree path produced 1 item (kind=idea), 0 children, no error.
- Two-item text => `single` (guard: insufficient/too-few entries).
- Fallback triggers on: model error, unparseable response, <3 valid entries, insufficient text. All return `{type:'single'}`.

## Honest caveats (for the ledger)
- Reliability is best on CLEAN roundups with clear per-entry structure (like this Substack). On messy or narrative lists the model tends to return `single` (safe) rather than risk garbage entries — this is by design (fallback-first) but means some genuine lists in prose form may not fan out.
- Child date extraction shares the single-item caveat: it picks a real date from the entry snippet, and correctly returns null when only a range/event-date is present rather than inventing a deadline.
- Children here classified via the entry SNIPPET (fetchLinks left on, but these Substack entries' links were section anchors, not distinct fetchable pages). Fetching a distinct outbound article per entry is supported in code and used when a real outbound URL is present.
