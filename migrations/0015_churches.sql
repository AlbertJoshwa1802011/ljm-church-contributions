-- Migration 0015: churches — the two-church model (PRD §6, TRD §3, backend-schema §2.1).
-- Purely additive and idempotent. Safe to run on the live database.
-- See docs/milestone-v2/05-backend-schema.md.

CREATE TABLE IF NOT EXISTS churches (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  slug              TEXT UNIQUE NOT NULL,
  name_en           TEXT NOT NULL,
  name_ta           TEXT,
  is_mother_church  INTEGER DEFAULT 0,
  address_en        TEXT,
  address_ta        TEXT,
  city              TEXT,
  country           TEXT DEFAULT 'India',
  phone             TEXT,
  email             TEXT,
  map_url           TEXT,
  service_times_en  TEXT,
  service_times_ta  TEXT,
  status            TEXT DEFAULT 'active',
  sort_order        INTEGER DEFAULT 0,
  created_at        DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at        DATETIME
);

INSERT OR IGNORE INTO churches (slug, name_en, is_mother_church, sort_order)
  VALUES ('church-of-light', 'Church of Light', 1, 0);
INSERT OR IGNORE INTO churches (slug, name_en, is_mother_church, sort_order)
  VALUES ('city-worship-center', 'City Worship Center', 0, 1);
