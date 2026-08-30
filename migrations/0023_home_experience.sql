-- Migration 0023: home experience rework (docs/milestone-v2/13-home-experience-rework.md).
-- Purely additive and idempotent: two new tables, five new nullable columns.
-- Nothing is dropped, renamed or retyped (CONTRIBUTING.md §4).

-- Admin-managed header carousel slides. Each slide carries an optional dark
-- variant; when image_dark_url is NULL the light image is used in both themes.
CREATE TABLE IF NOT EXISTS hero_slides (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  title_en            TEXT,
  title_ta            TEXT,
  caption_en          TEXT,
  caption_ta          TEXT,
  alt_en              TEXT,
  alt_ta              TEXT,
  image_light_url     TEXT NOT NULL,
  image_light_storage TEXT DEFAULT 'r2',   -- 'r2' | 'base64' | 'external'
  image_dark_url      TEXT,
  image_dark_storage  TEXT,
  link_url            TEXT,
  church_id           INTEGER,
  status              TEXT DEFAULT 'active',   -- 'active' | 'archived'
  sort_order          INTEGER DEFAULT 0,
  starts_on           TEXT,                    -- 'YYYY-MM-DD', inclusive; NULL = always
  ends_on             TEXT,                    -- 'YYYY-MM-DD', inclusive; NULL = never expires
  created_at          DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at          DATETIME
);
CREATE INDEX IF NOT EXISTS idx_hero_slides_status ON hero_slides(status, sort_order);

-- Admin-managed YouTube videos with optional custom thumbnails, played inline
-- on the site rather than sending the visitor to YouTube.
CREATE TABLE IF NOT EXISTS videos (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  title_en          TEXT NOT NULL,
  title_ta          TEXT,
  description_en    TEXT,
  description_ta    TEXT,
  youtube_url       TEXT NOT NULL,
  video_id          TEXT,                      -- normalised YouTube id, derived server-side
  thumbnail_url     TEXT,                      -- custom upload; NULL = YouTube's own thumbnail
  thumbnail_storage TEXT,
  church_id         INTEGER,
  is_live           INTEGER DEFAULT 0,         -- 1 = show as the live-service card
  status            TEXT DEFAULT 'published',  -- 'published' | 'draft'
  sort_order        INTEGER DEFAULT 0,
  published_at      TEXT,
  created_at        DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at        DATETIME
);
CREATE INDEX IF NOT EXISTS idx_videos_status ON videos(status, sort_order);

-- Online join links (Google Meet / Zoom) for programs, and church photo +
-- standing meet link for the expandable What's Happening cards.
ALTER TABLE programs ADD COLUMN online_url TEXT;
ALTER TABLE programs ADD COLUMN is_online INTEGER DEFAULT 0;
ALTER TABLE churches ADD COLUMN photo_url TEXT;
ALTER TABLE churches ADD COLUMN photo_storage TEXT;
ALTER TABLE churches ADD COLUMN online_url TEXT;
