-- Milestone v2, Phase 5: blog / articles (also backs Youth Ministry content via
-- ministry_area='youth').
-- Additive only: brand-new table.
-- See docs/milestone-v2/05-backend-schema.md §2.6.

CREATE TABLE IF NOT EXISTS blog_posts (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  slug          TEXT UNIQUE NOT NULL,
  title_en      TEXT NOT NULL,
  title_ta      TEXT,
  body_en       TEXT NOT NULL,
  body_ta       TEXT,
  excerpt_en    TEXT,
  excerpt_ta    TEXT,
  category      TEXT,
  cover_url     TEXT,
  ministry_area TEXT,
  status        TEXT DEFAULT 'draft',
  author        TEXT,
  created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
  published_at  DATETIME,
  updated_at    DATETIME
);
CREATE INDEX IF NOT EXISTS idx_blog_status ON blog_posts(status, published_at DESC);
