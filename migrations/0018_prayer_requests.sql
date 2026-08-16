-- Milestone v2, Phase 3: prayer requests (always private).
-- Additive only: brand-new table.
-- See docs/milestone-v2/05-backend-schema.md §2.4.

CREATE TABLE IF NOT EXISTS prayer_requests (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  name           TEXT,
  email          TEXT,
  phone          TEXT,
  request        TEXT NOT NULL,
  wants_callback INTEGER DEFAULT 0,
  language       TEXT DEFAULT 'en',
  church_id      INTEGER,
  member_id      INTEGER,
  status         TEXT DEFAULT 'new',
  is_private     INTEGER DEFAULT 1,
  submitted_ip   TEXT,
  ack_sent       INTEGER DEFAULT 0,
  team_notified  INTEGER DEFAULT 0,
  created_at     DATETIME DEFAULT CURRENT_TIMESTAMP,
  handled_by     TEXT,
  handled_at     DATETIME
);
CREATE INDEX IF NOT EXISTS idx_prayer_status ON prayer_requests(status, created_at DESC);
