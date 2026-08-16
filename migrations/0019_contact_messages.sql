-- Migration 0019: contact_messages (PRD §7.6).
-- Purely additive and idempotent. Safe to run on the live database.
-- See docs/milestone-v2/05-backend-schema.md.

CREATE TABLE IF NOT EXISTS contact_messages (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT,
  email         TEXT NOT NULL,
  subject       TEXT,
  message       TEXT NOT NULL,
  church_id     INTEGER,
  language      TEXT DEFAULT 'en',
  status        TEXT DEFAULT 'new',        -- 'new' | 'acknowledged' | 'replied' | 'closed'
  ack_sent      INTEGER DEFAULT 0,
  team_notified INTEGER DEFAULT 0,
  submitted_ip  TEXT,
  created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
  handled_by    TEXT,
  handled_at    DATETIME
);
CREATE INDEX IF NOT EXISTS idx_contact_status ON contact_messages(status, created_at DESC);
