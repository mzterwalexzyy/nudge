# Phase 2 Verification — classifyAgreement (real output)

Provider: Groq (`openai/gpt-oss-20b`). Not hardcoded — regenerated live via `run-agreement.mjs`.

## Test 1: Google Terms of Service
URL: https://policies.google.com/terms
Extracted text: 12,000 chars. Found 5 clauses (ranked):

1. **[HIGH] Content Licensing** — Google gets a worldwide, royalty-free license to host, reproduce, share and modify any content you upload, including for advertising and service improvements. This means Google can use your photos, videos or posts in many ways even after you delete them from your account.
2. **[HIGH] Personal Data Handling** — Google collects data about how you use its services, and may share it with advertisers or third parties. This affects what information is publicly accessible and how it can be targeted in ads.
3. **[HIGH] Mandatory Arbitration** — Any disputes between you and Google must be resolved through binding arbitration, not in court, and you give up the right to sue in a public forum or join a class action. This limits how you can seek legal recourse.
4. **[IMPORTANT] Unilateral Term Changes** — Google can change its terms at any time, and you must agree to the new terms when you continue using the service.
5. **[REVIEW] Account Termination & Data Deletion** — Google may terminate your account for violations, and once terminated, it may delete your data, but you may not retrieve it.

## Test 2: Wikipedia Terms of Use (control — proves levels differentiate)
URL: https://en.wikipedia.org/wiki/Wikipedia:Terms_of_use
Found 5 clauses (ranked):

1. **[HIGH] Content Licensing** — content released under CC BY-SA 4.0; others can reuse it under the same terms.
2. **[IMPORTANT] Privacy Policy** — how personal information is collected, used, shared.
3. **[IMPORTANT] Unilateral Term Changes** — terms may update without notifying users.
4. **[REVIEW] Liability Disclaimer** — site disclaims liability for errors/damages.
5. **[LOW] Terms of Use Acceptance** — accessing the site means agreeing to basic usage rules.

## Assessment
- 3-5 clauses: yes (5 each).
- Correctly ranked by level (high first): yes.
- Plain explanations with why-it-matters: yes.
- Measured, non-alarmist tone: yes (no "evil"/"shady").
- Not over-flagging: Wikipedia shows a HIGH/IMPORTANT/IMPORTANT/REVIEW/LOW spread, so the model discriminates rather than defaulting everything to high.
