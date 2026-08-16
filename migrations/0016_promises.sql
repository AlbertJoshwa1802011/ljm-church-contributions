-- Migration 0016: promises — daily/monthly/yearly promise words (PRD §7.2).
-- Purely additive and idempotent. Safe to run on the live database.
-- See docs/milestone-v2/05-backend-schema.md.

CREATE TABLE IF NOT EXISTS promises (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  scope         TEXT NOT NULL,          -- 'daily' | 'monthly' | 'yearly'
  on_date       TEXT,                   -- 'YYYY-MM-DD' when scope='daily'
  month         INTEGER,                -- 1..12 when scope='monthly'
  year          INTEGER,                -- e.g. 2026 (monthly/yearly)
  reference     TEXT,                   -- 'Isaiah 41:10'
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
