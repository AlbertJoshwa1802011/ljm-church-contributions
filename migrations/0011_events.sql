-- Migration 0011: Church events + event photo galleries.
-- Purely additive and idempotent. Safe to run on the live database.

-- 1. Events — church events (services, outreach, camps, celebrations, ...)
--    with optional cover photo and rich description. R2 is preferred storage
--    for photos (see functions/api/events.js); base64 data URLs are a fallback
--    when the EVENT_PHOTOS R2 binding isn't configured yet.
CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  category TEXT,
  event_date TEXT,
  location TEXT,
  description TEXT,
  cover_photo TEXT,
  status TEXT DEFAULT 'draft',       -- 'draft' | 'published'
  featured INTEGER DEFAULT 0,        -- 1 = pin to top of public listing
  extra TEXT,                        -- JSON blob for future/optional fields
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_events_status ON events(status);
CREATE INDEX IF NOT EXISTS idx_events_date   ON events(event_date);

-- 2. Event photo gallery (multiple photos per event).
CREATE TABLE IF NOT EXISTS event_photos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id INTEGER NOT NULL,
  photo_url TEXT NOT NULL,
  storage TEXT DEFAULT 'r2',         -- 'r2' | 'base64' | 'external'
  caption TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_event_photos_event ON event_photos(event_id);

-- 3. Grant the new manage_events scope to super_admin (idempotent fixed value).
UPDATE roles
SET permissions = '["edit_purchases","edit_wishlist","manage_roles","view_members","manage_funds","delete_funds","view_audit","manage_expenses","manage_subscriptions","manage_members","manage_content","manage_events"]'
WHERE role_name = 'super_admin';
