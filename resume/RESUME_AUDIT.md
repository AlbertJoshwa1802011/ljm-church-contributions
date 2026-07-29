# Resume Audit — Albert Joshwa A (v10_final.pdf)

Source: 2 pages, LibreOffice-generated, Carlito 9.5pt, 612x792.

## A. ATS-BREAKING DEFECTS (must fix)

**A1. Hyphenated line-breaks split keywords across lines.**
Justified text with hyphenation active. Extraction yields `cross-\nfunctional`,
`Communication\nEngineering`. An ATS doing a literal keyword match on
"cross-functional" fails. This is silent keyword loss.
Fix: left-align (ragged right), hyphenation off.

**A2. URL glued to date — date parser corruption.**
`...light-of-jesus-ministry-contributions.pages.dev/Dec 2024`
`...allwin-traders-pos-main Oct\n2024`
No whitespace between URL and date; second one splits the year onto its own
line. ATS date extraction on Projects will produce garbage or nothing.
Fix: dedicated right-aligned date column with guaranteed gap.

**A3. Non-standard job title is invisible to keyword filters.**
"Member Technical Staff" is a Zoho-internal title. A recruiter boolean search
for `Java Developer` / `Backend Engineer` / `Software Engineer` does not match
it. The title line at the top helps, but the EXPERIENCE entries — which is
where ATS title-matching actually reads — carry only the internal title.
Fix: `Member Technical Staff - Java Backend Engineer` as the role line.
Title unchanged, both keyword sets present.

**A4. Title string polluted with parentheticals.**
`Member Technical Staff (Intern to Full-Time) | Gofrugal Technologies (Zoho)`
ATS title parsers grab the whole run. Move the progression note to a sub-line.

**A5. PDF metadata is unset.** `Author: Un-named`, no Title. Some parsers and
most recruiter DMS index these.

## B. CONTENT DEFECTS (high ROI)

**B1. The Church Contribution Portal is drastically undersold — one bullet.**
The resume describes it as a "Google App Script JSON API backend", which reads
as script-tier. Verified against the actual repo, it is:
  - 23 REST endpoints as Cloudflare Pages Functions (Workers runtime)
  - Cloudflare D1 (SQLite): 20 tables, 505-line schema, 13 additive migrations
  - 304 automated tests, all passing (`node --test`)
  - HMAC-SHA256 Razorpay webhook signature verification (Web Crypto)
  - RBAC: roles table with 12 granular permissions
  - Feature-flag-gated v2 rollout behind a signed-cookie beta allowlist
  - 7 Chart.js analytics views; 148 commits, live in production
This is the ONLY place he can externally prove test discipline, security
engineering and end-to-end ownership — everything at Zoho is behind a wall a
recruiter cannot verify. Expanding this is the single highest-value change.

**B2. Section weighting is backwards.** The hackathon prototype gets 5 long
bullets; the deployed, tested, live payments platform gets 1.

**B3. Summary spends ~20 words on the employer, not the candidate.**
"one of India's largest software companies serving millions of users across
150+ countries" describes Zoho. Compress to a clause.

**B4. Summary apologizes for the background.** "Transitioned from Electronics
and Communication Engineering into software" — the Education section already
says ECE. Framing it as a transition invites doubt. Cut it.

**B5. "ADDITIONAL SKILLS" is a keyword-stuffing block.** ~90% verbatim
duplication of TECHNICAL SKILLS. Modern ATS do not score repetition, and
human reviewers read it as gaming. Delete; fold the 4 unique terms (FinTech,
ERP, SaaS, Workflow Automation) into context.

**B6. Security-negative phrasing.** "cookie-authenticated ... CSRF-signed POST
as a workaround for broken local OAuth scopes" reads as auth-bypass to a
security-minded reviewer. Reframe as tooling.

**B7. Internal error code `107027`** means nothing externally; burns space.

**B8. 13 skill categories dilutes.** Consolidate to ~9 well-grouped lines.

**B9. Attribution accuracy (flagged, not silently changed).** The church repo
shows 82 of 148 commits authored by "Claude" (AI-assisted). Claiming design,
architecture and shipping is fair — you drove it. Do NOT claim to have
hand-written every test in an interview. Bullets below are worded as
"designed / built / ship", which you can defend.

## C. POLISH

- C1. Mixed date formats: `July 2023`, `Dec 2024`, `Oct 2024`. Standardize `Mon YYYY`.
- C2. Page 2 only ~78% full (text ends y=657/792) — looks unfinished.
- C3. Summary claims "4+ years ... at Zoho Corporation" but the first role is
  GoFrugal (a Zoho group company). Say "Zoho and GoFrugal (Zoho group)".
- C4. Email `albertjoshrock101@gmail.com` reads informal. Your call.
- C5. "Constructed" is an odd verb for software. Verb variety pass.
- C6. No graduation month on the degree.
