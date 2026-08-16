-- Migration 0020: blog_posts — admin-authored articles/updates (and, scoped via
-- ministry_area='youth', the Youth Ministry hub). PRD §7.9-§7.10, schema doc §2.6.
-- Purely additive and idempotent. Safe to run on the live database.

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
  ministry_area TEXT,               -- e.g. 'youth' — lets Youth Ministry reuse blog
  status        TEXT DEFAULT 'draft',   -- 'draft' | 'published'
  author        TEXT,
  created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
  published_at  DATETIME,
  updated_at    DATETIME
);
CREATE INDEX IF NOT EXISTS idx_blog_status ON blog_posts(status, published_at DESC);
