-- Milestone v2, Phase 2: testimonies & miracles.
-- Additive only: brand-new table.
-- See docs/milestone-v2/05-backend-schema.md §2.3.

CREATE TABLE IF NOT EXISTS testimonies (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  title_en     TEXT NOT NULL,
  title_ta     TEXT,
  body_en      TEXT NOT NULL,
  body_ta      TEXT,
  author_name  TEXT,
  member_id    INTEGER,
  place        TEXT,
  kind         TEXT DEFAULT 'testimony',
  media_url    TEXT,
  church_id    INTEGER,
  status       TEXT DEFAULT 'pending',
  submitted_ip TEXT,
  created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
  published_at DATETIME,
  reviewed_by  TEXT
);
CREATE INDEX IF NOT EXISTS idx_testi_status ON testimonies(status, created_at DESC);
