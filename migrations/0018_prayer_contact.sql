-- Migration 0018: prayer_requests + contact_messages — the "Pray" and "Contact"
-- flows (PRD §7.5-§7.6). Purely additive and idempotent. Safe to run on the live
-- database. See docs/milestone-v2/05-backend-schema.md §2.4-§2.5 for the full design.

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
  status         TEXT DEFAULT 'new',      -- 'new' | 'praying' | 'contacted' | 'closed'
  is_private     INTEGER DEFAULT 1,
  submitted_ip   TEXT,
  created_at     DATETIME DEFAULT CURRENT_TIMESTAMP,
  handled_by     TEXT,
  handled_at     DATETIME
);
CREATE INDEX IF NOT EXISTS idx_prayer_status ON prayer_requests(status, created_at DESC);

CREATE TABLE IF NOT EXISTS contact_messages (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT,
  email         TEXT NOT NULL,
  subject       TEXT,
  message       TEXT NOT NULL,
  church_id     INTEGER,
  language      TEXT DEFAULT 'en',
  status        TEXT DEFAULT 'new',       -- 'new' | 'acknowledged' | 'replied' | 'closed'
  ack_sent      INTEGER DEFAULT 0,
  team_notified INTEGER DEFAULT 0,
  submitted_ip  TEXT,
  created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
  handled_by    TEXT,
  handled_at    DATETIME
);
CREATE INDEX IF NOT EXISTS idx_contact_status ON contact_messages(status, created_at DESC);
