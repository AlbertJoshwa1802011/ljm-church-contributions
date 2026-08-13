-- Migration 0015: Fund Foundation metadata — additive columns on `funds` so
-- each fund can carry the metadata the future professional Fund experience
-- needs (hero image, a longer "why this fund exists" message, ranking
-- visibility groundwork, and a per-fund Razorpay public-key placeholder).
--
-- Scope: metadata only. Nothing here changes payment routing — webhook.js,
-- razorpay-checkout.js and the live Tech/Christmas Fund payment paths are
-- untouched, and razorpay_key_id is not read by any payment code yet.
--
-- Safe to run on a live database: purely additive, all new columns are
-- nullable or DEFAULT-ed. Idempotent except the ALTER TABLE statements
-- (SQLite has no ADD COLUMN IF NOT EXISTS), so a re-run fails harmlessly
-- here after any earlier idempotent part (none, in this case) applies.

-- Hero image: URL/reference + which storage backend holds it, mirroring the
-- events.js R2-with-base64-fallback pattern (funds reuse the EVENT_PHOTOS R2
-- bucket under a `funds/` key prefix and the existing /api/events/photo
-- server — no new bucket/binding needed).
ALTER TABLE funds ADD COLUMN hero_image_url TEXT;
ALTER TABLE funds ADD COLUMN hero_image_storage TEXT;

-- Longer "why this fund exists" narrative. Deliberately separate from the
-- existing short `description` (used today as the one-line public widget
-- subtitle) rather than repurposing it, because `description` edits are
-- restricted to non-system funds by existing PUT logic — reusing it would
-- have meant loosening that existing restriction, which is a behavior
-- change outside this task's scope. `message` is brand-new metadata, so it
-- is editable on every fund, including Tech/Christmas.
ALTER TABLE funds ADD COLUMN message TEXT;

-- Ranking configuration groundwork only (no public ranking UI change in
-- this task). Mirrors the existing funds.visibility convention
-- ('public' | 'members') for ranking_visibility so admins reuse a concept
-- they already know instead of learning a new one.
ALTER TABLE funds ADD COLUMN ranking_enabled INTEGER NOT NULL DEFAULT 0;
ALTER TABLE funds ADD COLUMN ranking_visibility TEXT NOT NULL DEFAULT 'public';

-- Razorpay groundwork only: the PUBLIC key id a fund would use once
-- per-fund payment routing exists (Fund -> Razorpay configuration ->
-- Contribution/payment). NULL means "use today's single hardcoded
-- RAZORPAY_TEST_KEY_ID in razorpay-checkout.js" — i.e. unchanged behavior.
-- This is the publishable key id, never the key secret; no secret material
-- is stored here or anywhere in the funds table.
ALTER TABLE funds ADD COLUMN razorpay_key_id TEXT;
