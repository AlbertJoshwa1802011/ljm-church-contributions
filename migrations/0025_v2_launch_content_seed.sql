-- Migration 0025: initial ministry content for the v2 public site launch.
--
-- Purely a DATA seed — no schema changes. Every INSERT is guarded with
-- `WHERE NOT EXISTS (...)` (or COALESCE for in-place church updates), so this
-- file is safe to re-run: a second pass is a no-op.
--
-- Deliberately NOT mirrored into schema.sql (unlike every prior migration):
-- it seeds real 2026 calendar dates for "today's promise", which would
-- collide with tests/api/promises.test.mjs's own dynamic "today" fixtures if
-- baked into the shared test DB. It's validated instead by
-- tests/regression/seed-migration.test.mjs, which applies it directly
-- against its own isolated in-memory DB.
--
-- Why this exists: before this migration, /v2/prayer.html, /v2/testimonies.html,
-- /v2/programs.html, /v2/blog.html and the Home promise card had no real rows
-- to render, so they looked empty on first review. This seeds enough real
-- content — through the same tables/columns the admin console and public API
-- read and write — to demonstrate every page, without touching giving,
-- members, or any real user-submitted data.
--
-- What's genuinely real vs. clearly-marked sample content:
--   * Promises: real KJV verse text, copied verbatim from the bible_verses
--     table already seeded in migrations/0009_bible_kjv_seed.sql (nothing
--     invented). `created_by` is tagged 'seed:v2-launch-2026'.
--   * Testimonies: clearly fictional sample identities — every author_name
--     ends "(sample testimony)" and `reviewed_by` is tagged
--     'seed:v2-launch-2026' — so nobody can mistake these for a real
--     person's story. One is left `pending` on purpose, to demonstrate the
--     admin moderation queue.
--   * Programs: NOT seeded here — the real ministry schedule (Sunday First/
--     Second Service, Daily Morning/Night Prayer, Full Night Prayer, Youth
--     Prayer) is seeded by migrations/0024_seed_prayer_programs.sql. This
--     migration must not add fictional programs alongside real ones.
--   * Blog posts: original ministry-life editorial copy, author 'LJM
--     Ministry Team' (not attributed to any specific real named person).
--     One is left in `draft` status to demonstrate the publish flow.
--   * Churches: only fills in placeholder text explicitly marked
--     "to be confirmed" / "coming soon" — never a fabricated real address,
--     phone number, or service time. Existing values are never overwritten
--     (COALESCE).
--   * VBS 2026 event: real, but with unknown fields (exact dates, location)
--     left as an honest "to be announced" placeholder per the user's
--     explicit instruction not to invent them — ready for the admin to fill
--     in and attach real photos later.

-- ── Promises — real KJV text via the existing bible_verses table ──────────

INSERT INTO promises (scope, on_date, reference, text_en, reflection_en, is_published, created_by)
SELECT 'daily', '2026-08-10', 'Deuteronomy 31:6', text, 'God''s presence goes with you into everything today holds — there is no need to face it alone.', 1, 'seed:v2-launch-2026'
FROM bible_verses WHERE version_code='KJV' AND book='Deuteronomy' AND chapter=31 AND verse=6
AND NOT EXISTS (SELECT 1 FROM promises WHERE scope='daily' AND on_date='2026-08-10');

INSERT INTO promises (scope, on_date, reference, text_en, reflection_en, is_published, created_by)
SELECT 'daily', '2026-08-11', 'Joshua 1:9', text, 'Courage isn''t the absence of fear — it''s trusting the One who goes before you.', 1, 'seed:v2-launch-2026'
FROM bible_verses WHERE version_code='KJV' AND book='Joshua' AND chapter=1 AND verse=9
AND NOT EXISTS (SELECT 1 FROM promises WHERE scope='daily' AND on_date='2026-08-11');

INSERT INTO promises (scope, on_date, reference, text_en, reflection_en, is_published, created_by)
SELECT 'daily', '2026-08-12', 'Psalms 23:1', text, 'Whatever today is short on, the Shepherd is not.', 1, 'seed:v2-launch-2026'
FROM bible_verses WHERE version_code='KJV' AND book='Psalms' AND chapter=23 AND verse=1
AND NOT EXISTS (SELECT 1 FROM promises WHERE scope='daily' AND on_date='2026-08-12');

INSERT INTO promises (scope, on_date, reference, text_en, reflection_en, is_published, created_by)
SELECT 'daily', '2026-08-13', 'Psalms 27:1', text, 'Let this truth settle any anxious thought before it takes root.', 1, 'seed:v2-launch-2026'
FROM bible_verses WHERE version_code='KJV' AND book='Psalms' AND chapter=27 AND verse=1
AND NOT EXISTS (SELECT 1 FROM promises WHERE scope='daily' AND on_date='2026-08-13');

INSERT INTO promises (scope, on_date, reference, text_en, reflection_en, is_published, created_by)
SELECT 'daily', '2026-08-14', 'Psalms 46:1', text, 'A very present help — not far off, not delayed. Right here, right now.', 1, 'seed:v2-launch-2026'
FROM bible_verses WHERE version_code='KJV' AND book='Psalms' AND chapter=46 AND verse=1
AND NOT EXISTS (SELECT 1 FROM promises WHERE scope='daily' AND on_date='2026-08-14');

INSERT INTO promises (scope, on_date, reference, text_en, reflection_en, is_published, created_by)
SELECT 'daily', '2026-08-15', 'Psalms 46:10', text, 'Stillness is not weakness — it is where we remember who is actually in control.', 1, 'seed:v2-launch-2026'
FROM bible_verses WHERE version_code='KJV' AND book='Psalms' AND chapter=46 AND verse=10
AND NOT EXISTS (SELECT 1 FROM promises WHERE scope='daily' AND on_date='2026-08-15');

INSERT INTO promises (scope, on_date, reference, text_en, reflection_en, is_published, created_by)
SELECT 'daily', '2026-08-16', 'Psalms 91:1', text, 'Under His shadow, you are covered — from the smallest worry to the biggest.', 1, 'seed:v2-launch-2026'
FROM bible_verses WHERE version_code='KJV' AND book='Psalms' AND chapter=91 AND verse=1
AND NOT EXISTS (SELECT 1 FROM promises WHERE scope='daily' AND on_date='2026-08-16');

INSERT INTO promises (scope, on_date, reference, text_en, reflection_en, is_published, created_by)
SELECT 'daily', '2026-08-17', 'Proverbs 3:5', text, 'Understanding runs out. Trust doesn''t have to.', 1, 'seed:v2-launch-2026'
FROM bible_verses WHERE version_code='KJV' AND book='Proverbs' AND chapter=3 AND verse=5
AND NOT EXISTS (SELECT 1 FROM promises WHERE scope='daily' AND on_date='2026-08-17');

INSERT INTO promises (scope, on_date, reference, text_en, reflection_en, is_published, created_by)
SELECT 'daily', '2026-08-18', 'Proverbs 3:6', text, 'Acknowledge Him in the small decisions today, not just the big ones.', 1, 'seed:v2-launch-2026'
FROM bible_verses WHERE version_code='KJV' AND book='Proverbs' AND chapter=3 AND verse=6
AND NOT EXISTS (SELECT 1 FROM promises WHERE scope='daily' AND on_date='2026-08-18');

INSERT INTO promises (scope, on_date, reference, text_en, reflection_en, is_published, created_by)
SELECT 'daily', '2026-08-19', 'Isaiah 40:31', text, 'Waiting on the Lord is not wasted time — it is where strength is renewed.', 1, 'seed:v2-launch-2026'
FROM bible_verses WHERE version_code='KJV' AND book='Isaiah' AND chapter=40 AND verse=31
AND NOT EXISTS (SELECT 1 FROM promises WHERE scope='daily' AND on_date='2026-08-19');

INSERT INTO promises (scope, on_date, reference, text_en, reflection_en, is_published, created_by)
SELECT 'daily', '2026-08-20', 'Isaiah 41:10', text, 'Fear knocks at every door. This promise answers it.', 1, 'seed:v2-launch-2026'
FROM bible_verses WHERE version_code='KJV' AND book='Isaiah' AND chapter=41 AND verse=10
AND NOT EXISTS (SELECT 1 FROM promises WHERE scope='daily' AND on_date='2026-08-20');

INSERT INTO promises (scope, on_date, reference, text_en, reflection_en, is_published, created_by)
SELECT 'daily', '2026-08-21', 'Jeremiah 29:11', text, 'Even on an uncertain day, His plans for you have not changed.', 1, 'seed:v2-launch-2026'
FROM bible_verses WHERE version_code='KJV' AND book='Jeremiah' AND chapter=29 AND verse=11
AND NOT EXISTS (SELECT 1 FROM promises WHERE scope='daily' AND on_date='2026-08-21');

INSERT INTO promises (scope, on_date, reference, text_en, reflection_en, is_published, created_by)
SELECT 'daily', '2026-08-22', 'Lamentations 3:22', text, 'Not consumed — held, even in the hard seasons.', 1, 'seed:v2-launch-2026'
FROM bible_verses WHERE version_code='KJV' AND book='Lamentations' AND chapter=3 AND verse=22
AND NOT EXISTS (SELECT 1 FROM promises WHERE scope='daily' AND on_date='2026-08-22');

INSERT INTO promises (scope, on_date, reference, text_en, reflection_en, is_published, created_by)
SELECT 'daily', '2026-08-23', 'Lamentations 3:23', text, 'Today is a fresh mercy, not a continuation of yesterday''s failure.', 1, 'seed:v2-launch-2026'
FROM bible_verses WHERE version_code='KJV' AND book='Lamentations' AND chapter=3 AND verse=23
AND NOT EXISTS (SELECT 1 FROM promises WHERE scope='daily' AND on_date='2026-08-23');

INSERT INTO promises (scope, on_date, reference, text_en, reflection_en, is_published, created_by)
SELECT 'daily', '2026-08-24', 'Zephaniah 3:17', text, 'He does not just tolerate you today — He rejoices over you.', 1, 'seed:v2-launch-2026'
FROM bible_verses WHERE version_code='KJV' AND book='Zephaniah' AND chapter=3 AND verse=17
AND NOT EXISTS (SELECT 1 FROM promises WHERE scope='daily' AND on_date='2026-08-24');

INSERT INTO promises (scope, on_date, reference, text_en, reflection_en, is_published, created_by)
SELECT 'daily', '2026-08-25', 'Matthew 11:28', text, 'Whatever you''re carrying, this invitation is still open.', 1, 'seed:v2-launch-2026'
FROM bible_verses WHERE version_code='KJV' AND book='Matthew' AND chapter=11 AND verse=28
AND NOT EXISTS (SELECT 1 FROM promises WHERE scope='daily' AND on_date='2026-08-25');

INSERT INTO promises (scope, on_date, reference, text_en, reflection_en, is_published, created_by)
SELECT 'daily', '2026-08-26', 'John 3:16', text, 'The whole gospel, in one verse — for the whole world, including you.', 1, 'seed:v2-launch-2026'
FROM bible_verses WHERE version_code='KJV' AND book='John' AND chapter=3 AND verse=16
AND NOT EXISTS (SELECT 1 FROM promises WHERE scope='daily' AND on_date='2026-08-26');

INSERT INTO promises (scope, on_date, reference, text_en, reflection_en, is_published, created_by)
SELECT 'daily', '2026-08-27', 'Romans 8:28', text, 'Even what doesn''t make sense yet is being worked into good.', 1, 'seed:v2-launch-2026'
FROM bible_verses WHERE version_code='KJV' AND book='Romans' AND chapter=8 AND verse=28
AND NOT EXISTS (SELECT 1 FROM promises WHERE scope='daily' AND on_date='2026-08-27');

INSERT INTO promises (scope, on_date, reference, text_en, reflection_en, is_published, created_by)
SELECT 'daily', '2026-08-28', '2 Corinthians 5:17', text, 'The old story does not get the final word on your life anymore.', 1, 'seed:v2-launch-2026'
FROM bible_verses WHERE version_code='KJV' AND book='2 Corinthians' AND chapter=5 AND verse=17
AND NOT EXISTS (SELECT 1 FROM promises WHERE scope='daily' AND on_date='2026-08-28');

INSERT INTO promises (scope, on_date, reference, text_en, reflection_en, is_published, created_by)
SELECT 'daily', '2026-08-29', 'Philippians 4:13', text, 'Strength for today doesn''t come from you — it comes through Christ.', 1, 'seed:v2-launch-2026'
FROM bible_verses WHERE version_code='KJV' AND book='Philippians' AND chapter=4 AND verse=13
AND NOT EXISTS (SELECT 1 FROM promises WHERE scope='daily' AND on_date='2026-08-29');

INSERT INTO promises (scope, on_date, reference, text_en, reflection_en, is_published, created_by)
SELECT 'daily', '2026-08-30', '1 Peter 5:7', text, 'Whatever weight you''re carrying today, you were never meant to carry it alone.', 1, 'seed:v2-launch-2026'
FROM bible_verses WHERE version_code='KJV' AND book='1 Peter' AND chapter=5 AND verse=7
AND NOT EXISTS (SELECT 1 FROM promises WHERE scope='daily' AND on_date='2026-08-30');

INSERT INTO promises (scope, month, year, reference, text_en, reflection_en, is_published, created_by)
SELECT 'monthly', 8, 2026, 'Romans 8:28', text, 'Our theme for August: even the parts of this month that feel unfinished are being worked into good.', 1, 'seed:v2-launch-2026'
FROM bible_verses WHERE version_code='KJV' AND book='Romans' AND chapter=8 AND verse=28
AND NOT EXISTS (SELECT 1 FROM promises WHERE scope='monthly' AND month=8 AND year=2026);

INSERT INTO promises (scope, month, year, reference, text_en, reflection_en, is_published, created_by)
SELECT 'monthly', 9, 2026, 'Jeremiah 29:11', text, 'Our theme for September: stepping into a new month on the promise that His plans for us are good.', 1, 'seed:v2-launch-2026'
FROM bible_verses WHERE version_code='KJV' AND book='Jeremiah' AND chapter=29 AND verse=11
AND NOT EXISTS (SELECT 1 FROM promises WHERE scope='monthly' AND month=9 AND year=2026);

INSERT INTO promises (scope, year, reference, text_en, reflection_en, is_published, created_by)
SELECT 'yearly', 2026, 'Isaiah 41:10', text, 'Our word for 2026: whatever this year brings, we do not face it alone.', 1, 'seed:v2-launch-2026'
FROM bible_verses WHERE version_code='KJV' AND book='Isaiah' AND chapter=41 AND verse=10
AND NOT EXISTS (SELECT 1 FROM promises WHERE scope='yearly' AND year=2026);

-- ── Testimonies — clearly-marked sample content ────────────────────────────

INSERT INTO testimonies (title_en, body_en, author_name, place, kind, church_id, status, created_at, published_at, reviewed_by)
SELECT
  'A Season of Healing',
  'After months of health struggles, our church family stood with me in prayer week after week. I want to give God the glory for the strength and healing He gave me through that season, and for a church family that never stopped believing with me.',
  'Grace M. (sample testimony)', 'Church of Light', 'testimony',
  (SELECT id FROM churches WHERE slug='church-of-light'), 'published', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'seed:v2-launch-2026'
WHERE NOT EXISTS (SELECT 1 FROM testimonies WHERE title_en='A Season of Healing');

INSERT INTO testimonies (title_en, body_en, author_name, place, kind, church_id, status, created_at, published_at, reviewed_by)
SELECT
  'Provision Right on Time',
  'I came to City Worship Center during one of the hardest financial seasons of my life. Through the prayer team and the way this church family showed up for one another, I saw provision come exactly when it was needed — never before, never late.',
  'Daniel R. (sample testimony)', 'City Worship Center', 'testimony',
  (SELECT id FROM churches WHERE slug='city-worship-center'), 'published', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'seed:v2-launch-2026'
WHERE NOT EXISTS (SELECT 1 FROM testimonies WHERE title_en='Provision Right on Time');

INSERT INTO testimonies (title_en, body_en, author_name, place, kind, church_id, status, created_at, published_at, reviewed_by)
SELECT
  'Finding a New Beginning',
  'I walked into a Sunday service not really looking for anything in particular, and I left with a completely new direction for my life. The welcome I received here — no judgment, just open arms — is what made the difference.',
  'Priya S. (sample testimony)', 'Church of Light', 'testimony',
  (SELECT id FROM churches WHERE slug='church-of-light'), 'published', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'seed:v2-launch-2026'
WHERE NOT EXISTS (SELECT 1 FROM testimonies WHERE title_en='Finding a New Beginning');

INSERT INTO testimonies (title_en, body_en, author_name, place, kind, church_id, status, created_at, reviewed_by)
SELECT
  'Our Family, Restored',
  'Submitted for review — a testimony about restoration in a family relationship after a season of prayer and counsel from the pastoral team. (Sample record kept in "pending" status to demonstrate the admin moderation queue.)',
  'A City Worship Center family (sample testimony, pending review)', 'City Worship Center', 'testimony',
  (SELECT id FROM churches WHERE slug='city-worship-center'), 'pending', CURRENT_TIMESTAMP, 'seed:v2-launch-2026'
WHERE NOT EXISTS (SELECT 1 FROM testimonies WHERE title_en='Our Family, Restored');

-- Programs are intentionally NOT seeded here — see migrations/0024_seed_prayer_programs.sql
-- for the real ministry prayer/service schedule. Seeding fictional programs
-- alongside real ones would misrepresent the ministry's actual schedule.

-- ── Blog posts — original ministry-life editorial copy ──────────────────────

INSERT OR IGNORE INTO blog_posts (slug, title_en, body_en, excerpt_en, category, ministry_area, status, author, created_at, published_at)
VALUES (
  'welcome-to-the-new-website',
  'Welcome to the New Light of Jesus Ministry Website',
  'We''re glad you found your way here. This new site brings Church of Light and City Worship Center together in one place — daily promises, testimonies of what God is doing, prayer requests, our programs, our giving, and how to reach our team, wherever you are in the world. Look around, and if there''s anything you need, our Contact page always reaches a real person.',
  'A new home online for both our churches — here''s what you''ll find, and how to reach us.',
  'Ministry News', NULL, 'published', 'LJM Ministry Team', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO blog_posts (slug, title_en, body_en, excerpt_en, category, ministry_area, status, author, created_at, published_at)
VALUES (
  'five-ways-to-make-prayer-a-daily-habit',
  'Five Ways to Make Prayer a Daily Habit',
  '1. Anchor it to something you already do every day, like your first cup of tea. 2. Keep it short before you make it long — two honest minutes beats twenty distracted ones. 3. Pray the Psalms out loud when you don''t have your own words. 4. Keep a small list of what you''re praying for, and cross things off as answers come. 5. Pray with someone else at least once a week — our Wednesday Prayer Meeting is a good place to start.',
  'Five small, practical habits that make prayer stick — including where to start if you want to pray with others.',
  'Devotional', NULL, 'published', 'LJM Ministry Team', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO blog_posts (slug, title_en, body_en, excerpt_en, category, ministry_area, status, author, created_at, published_at)
VALUES (
  'getting-ready-for-vbs-2026',
  'Getting Ready for VBS 2026',
  'Our Vacation Bible School is coming back in 2026, and we couldn''t be more excited. VBS is a week where kids across both churches get to experience the Bible through games, songs, crafts, and stories that make Scripture come alive. Exact dates and location are being finalised — keep an eye on the Events page, and reach out through Contact if you''d like to help plan or volunteer this year.',
  'VBS 2026 is on the calendar — here''s what to expect, and how to get involved before the dates are locked in.',
  'Youth', 'youth', 'published', 'LJM Ministry Team', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO blog_posts (slug, title_en, body_en, excerpt_en, category, ministry_area, status, author, created_at, published_at)
VALUES (
  'what-we-learned-serving-our-community',
  'What We Learned Serving Our Community This Year',
  'Every outreach we run teaches us something new about what it actually means to love our neighbours well. This year reminded us that showing up consistently — not just once — is what builds real trust in a community. We''re grateful for every hand that helped, and every door that opened because someone was willing to knock.',
  'A few honest reflections from a year of community outreach — and what it taught us about showing up.',
  'Outreach', NULL, 'published', 'LJM Ministry Team', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO blog_posts (slug, title_en, body_en, excerpt_en, category, ministry_area, status, author, created_at)
VALUES (
  'behind-the-scenes-sunday-worship-planning',
  'Behind the Scenes: Sunday Worship Planning',
  '[Draft — kept unpublished to demonstrate the admin draft/publish workflow.] A look at how our worship team plans out a Sunday, from song selection to sound check.',
  'A behind-the-scenes look at how a Sunday service comes together, from song selection to sound check.',
  'Ministry Life', NULL, 'draft', 'LJM Ministry Team', CURRENT_TIMESTAMP
);

-- ── Churches — fill in only clearly-marked placeholders, never fabricate ───

UPDATE churches SET
  address_en = COALESCE(address_en, 'Coimbatore, Tamil Nadu, India — full street address coming soon'),
  service_times_en = COALESCE(service_times_en, 'Service times to be confirmed — please reach out via our Contact page'),
  city = COALESCE(city, 'Coimbatore')
WHERE slug = 'church-of-light';

UPDATE churches SET
  address_en = COALESCE(address_en, 'Coimbatore, Tamil Nadu, India — full street address coming soon'),
  service_times_en = COALESCE(service_times_en, 'Service times to be confirmed — please reach out via our Contact page'),
  city = COALESCE(city, 'Coimbatore')
WHERE slug = 'city-worship-center';

-- ── VBS 2026 — real event, honest placeholders for the unknowns ────────────

INSERT INTO events (title, category, event_date, location, description, status, featured)
SELECT
  'Vacation Bible School (VBS) 2026',
  'VBS',
  'Summer 2026 — exact dates to be announced',
  NULL,
  'A week of Bible stories, songs, games, and crafts for kids across both Church of Light and City Worship Center. Exact dates and location are being finalised — check back here, or watch our Blog and Contact page, for updates. Photos from this year''s VBS will be added here once the event has taken place.',
  'published', 1
WHERE NOT EXISTS (SELECT 1 FROM events WHERE title='Vacation Bible School (VBS) 2026');
