-- Milestone v2, Phase 4: service times & recurring programs.
-- Additive only: brand-new table.
-- See docs/milestone-v2/05-backend-schema.md §2.7.

CREATE TABLE IF NOT EXISTS programs (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  title_en       TEXT NOT NULL,
  title_ta       TEXT,
  description_en TEXT,
  description_ta TEXT,
  church_id      INTEGER,
  ministry_area  TEXT,
  day_of_week    INTEGER,
  start_time     TEXT,
  end_time       TEXT,
  recurrence     TEXT DEFAULT 'weekly',
  location       TEXT,
  status         TEXT DEFAULT 'active',
  sort_order     INTEGER DEFAULT 0,
  created_at     DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at     DATETIME
);
CREATE INDEX IF NOT EXISTS idx_programs_church ON programs(church_id, day_of_week);
