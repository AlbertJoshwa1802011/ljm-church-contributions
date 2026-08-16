-- Migration 0019: programs (service times & recurring programs) + church/beneficiary
-- scoping on the existing events table — PRD §7.7-§7.8, schema doc §2.7-§2.8.
-- Safe to run on a live database: purely additive. Idempotent except the ALTER TABLE
-- statements below (SQLite has no ADD COLUMN IF NOT EXISTS), so they run last — a
-- re-run fails only there, after the idempotent part applied.

CREATE TABLE IF NOT EXISTS programs (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  title_en       TEXT NOT NULL,
  title_ta       TEXT,
  description_en TEXT,
  description_ta TEXT,
  church_id      INTEGER,
  ministry_area  TEXT,
  day_of_week    INTEGER,             -- 0=Sun..6=Sat, null = one-off/other
  start_time     TEXT,                -- 'HH:MM'
  end_time       TEXT,
  recurrence     TEXT DEFAULT 'weekly',  -- 'weekly' | 'monthly' | 'once'
  location       TEXT,
  status         TEXT DEFAULT 'active',
  sort_order     INTEGER DEFAULT 0,
  created_at     DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at     DATETIME
);
CREATE INDEX IF NOT EXISTS idx_programs_church ON programs(church_id, day_of_week);

-- NOT idempotent — keep these LAST. On re-run the migration fails here harmlessly.
ALTER TABLE events ADD COLUMN church_id INTEGER;
ALTER TABLE events ADD COLUMN beneficiaries_count INTEGER;
ALTER TABLE events ADD COLUMN good_deed_summary_en TEXT;
ALTER TABLE events ADD COLUMN good_deed_summary_ta TEXT;
