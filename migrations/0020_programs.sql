-- Migration 0020: programs — service times & recurring programs (PRD §7.8).
-- Purely additive and idempotent. Safe to run on the live database.
-- See docs/milestone-v2/05-backend-schema.md.

CREATE TABLE IF NOT EXISTS programs (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  title_en       TEXT NOT NULL,
  title_ta       TEXT,
  description_en TEXT,
  description_ta TEXT,
  church_id      INTEGER,
  ministry_area  TEXT,               -- e.g. 'youth'
  day_of_week    INTEGER,            -- 0=Sun..6=Sat, null = one-off/other
  start_time     TEXT,               -- 'HH:MM'
  end_time       TEXT,
  recurrence     TEXT DEFAULT 'weekly', -- 'weekly' | 'monthly' | 'once'
  location       TEXT,
  status         TEXT DEFAULT 'active',
  sort_order     INTEGER DEFAULT 0,
  created_at     DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at     DATETIME
);
CREATE INDEX IF NOT EXISTS idx_programs_church ON programs(church_id, day_of_week);
