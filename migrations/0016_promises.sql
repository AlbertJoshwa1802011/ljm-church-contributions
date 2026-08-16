-- Milestone v2, Phase 1: daily / monthly / yearly promise words.
-- Additive only: brand-new table.
-- See docs/milestone-v2/05-backend-schema.md §2.2.

CREATE TABLE IF NOT EXISTS promises (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  scope         TEXT NOT NULL,
  on_date       TEXT,
  month         INTEGER,
  year          INTEGER,
  reference     TEXT,
  text_en       TEXT NOT NULL,
  text_ta       TEXT,
  reflection_en TEXT,
  reflection_ta TEXT,
  is_published  INTEGER DEFAULT 1,
  created_by    TEXT,
  created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME
);
CREATE INDEX IF NOT EXISTS idx_promises_daily ON promises(scope, on_date);
CREATE INDEX IF NOT EXISTS idx_promises_month ON promises(scope, year, month);
