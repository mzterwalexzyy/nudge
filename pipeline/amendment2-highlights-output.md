# Amendment 2 — Change 1: Highlights (real output)

Provider: Groq `openai/gpt-oss-20b`. Live output via `run-pipeline.mjs --no-fanout --no-live`. Not hardcoded.

## Article: overreacted.io — A Complete Guide to useEffect
kind: article | deadline: null | date_confidence: none
Highlights (5, page-specific):
- Replicating componentDidMount with useEffect requires useEffect(fn, []) but it captures the initial props/state; to access the latest values, use refs or restructure code.
- An empty dependency array [] means the effect runs once; if you actually use values, they must be listed or managed with useReducer/useCallback to avoid stale data.
- Functions used inside an effect must be stable — hoist them outside the component or wrap them in useCallback — to prevent unnecessary re-runs and infinite loops.
- Infinite refetch loops occur when an effect runs on every render without a proper dependency array.
- Effects always see the props and state from the render in which they were defined; to access updated values, add missing dependencies or store values in mutable refs.

## Hackathon: agentsforhumans.devpost.com/rules
kind: opportunity | deadline: 2026-09-11 (inferred, see note) | action_required: true
Highlights (4, page-specific):
- Submission Period runs from August 10, 2026 (9am PT) to September 14, 2026 (5pm PT); winners announced around October 14, 2026.
- AWS offers up to $50 promotional credits to registered entrants; must request by September 11, 2026 and credits expire October 31, 2026.
- Eligibility allows individuals, teams, and organizations but excludes participants from certain countries and Sponsor/Admin affiliates.
- Entrants must create a Devpost account, register, and install the Strands Agents SDK; judged on functionality, platform compatibility, technical implementation.

## Honest note on date selection
Across runs the hackathon deadline resolves to either 2026-09-14 (submission close, `explicit`) or 2026-09-11 (AWS credit request cutoff, `inferred`). Both are real dates on the page; the model sometimes latches onto the credit cutoff rather than the submission close. The `date_confidence` field correctly downgrades to `inferred` when it is not the primary deadline. No date is fabricated. This is a real reliability caveat on dense pages, recorded in the ledger.

## Verdict
Highlights are specific to each page, no generic filler, no padding (article=5, hackathon=4). Empty-highlights bug (repair pass dropping the array + 512-token truncation) was fixed by including highlights in the repair prompt and raising maxTokens to 900.
