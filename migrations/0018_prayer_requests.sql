-- Migration 0018: prayer_requests (PRD §7.5). Never public — admin-only inbox.
-- Purely additive and idempotent. Safe to run on the live database.
-- See docs/milestone-v2/05-backend-schema.md.

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
  status         TEXT DEFAULT 'new',       -- 'new' | 'praying' | 'contacted' | 'closed'
  is_private     INTEGER DEFAULT 1,
  submitted_ip   TEXT,
  created_at     DATETIME DEFAULT CURRENT_TIMESTAMP,
  handled_by     TEXT,
  handled_at     DATETIME
);
CREATE INDEX IF NOT EXISTS idx_prayer_status ON prayer_requests(status, created_at DESC);
