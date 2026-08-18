-- Deterministic seed data for the Playwright e2e suite (tests/e2e/*.spec.mjs).
-- Applied to a local D1 instance before wrangler pages dev starts — see
-- playwright.config.js's webServer command and TESTING.md's "Browser / e2e
-- suite" section. Safe to re-apply: churches are INSERT OR IGNORE (already
-- seeded by schema.sql); everything else is a straight INSERT into an
-- ephemeral local-only SQLite file, never production.

INSERT INTO testimonies (title_en, body_en, author_name, place, kind, status, created_at, published_at, reviewed_by)
VALUES ('E2E Seeded Testimony', 'This testimony is seeded for the Playwright suite and must always be visible on the public Testimonies page default view.', 'E2E Seed', 'Coimbatore', 'testimony', 'published', datetime('now', '-1 day'), datetime('now', '-1 day'), 'e2e-seed');

INSERT INTO blog_posts (slug, title_en, body_en, excerpt_en, category, ministry_area, status, author, created_at, published_at)
VALUES ('e2e-published-post', 'E2E Published Post', 'Published body content for the Playwright suite.', 'Published excerpt.', 'general', 'general', 'published', 'E2E Seed', datetime('now', '-1 day'), datetime('now', '-1 day'));
INSERT INTO blog_posts (slug, title_en, body_en, excerpt_en, category, ministry_area, status, author, created_at)
VALUES ('e2e-draft-post', 'E2E DRAFT Post Must Never Leak', 'Draft body content that must never be visible publicly.', 'Draft excerpt.', 'general', 'general', 'draft', 'E2E Seed', datetime('now', '-1 day'));

-- A weekly program and a monthly-ordinal ("2nd Friday of every month") one,
-- covering both branches of the Programs recurrence-label logic.
INSERT INTO programs (title_en, description_en, ministry_area, day_of_week, start_time, end_time, recurrence, status, sort_order)
VALUES ('E2E Sunday Service', 'Weekly Sunday service.', 'general', 0, '09:00', '11:00', 'weekly', 'active', 1);
INSERT INTO programs (title_en, description_en, ministry_area, day_of_week, start_time, end_time, recurrence, week_of_month, status, sort_order)
VALUES ('E2E Full Night Prayer', 'All-night prayer meeting.', 'prayer', 5, '22:00', '05:00', 'monthly', 2, 'active', 2);

INSERT OR REPLACE INTO config (key, value) VALUES ('sunday_live_url', 'https://www.youtube.com/watch?v=e2e-seed-demo');
