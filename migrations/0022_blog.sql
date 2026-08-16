-- Migration 0022: blog_posts (PRD §7.9). Purely additive and idempotent.
-- See docs/milestone-v2/05-backend-schema.md.

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
  ministry_area TEXT,                -- e.g. 'youth'
  status        TEXT DEFAULT 'draft', -- 'draft' | 'published'
  author        TEXT,
  created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
  published_at  DATETIME,
  updated_at    DATETIME
);
CREATE INDEX IF NOT EXISTS idx_blog_status ON blog_posts(status, published_at DESC);
