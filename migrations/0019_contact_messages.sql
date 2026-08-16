-- Milestone v2, Phase 3: contact messages.
-- Additive only: brand-new table.
-- See docs/milestone-v2/05-backend-schema.md §2.5.

CREATE TABLE IF NOT EXISTS contact_messages (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT,
  email         TEXT NOT NULL,
  subject       TEXT,
  message       TEXT NOT NULL,
  church_id     INTEGER,
  language      TEXT DEFAULT 'en',
  status        TEXT DEFAULT 'new',
  ack_sent      INTEGER DEFAULT 0,
  team_notified INTEGER DEFAULT 0,
  submitted_ip  TEXT,
  created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
  handled_by    TEXT,
  handled_at    DATETIME
);
CREATE INDEX IF NOT EXISTS idx_contact_status ON contact_messages(status, created_at DESC);
