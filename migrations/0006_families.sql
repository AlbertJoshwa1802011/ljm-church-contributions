-- Migration 0006: Families / believer households.
-- Safe to run on a live database: purely additive. Idempotent except the
-- ALTER TABLE statements below (SQLite has no ADD COLUMN IF NOT EXISTS), so
-- they run last — a re-run fails only there, after the idempotent part applied.
--
-- Design note: this does NOT touch the existing per-member sandha_payments
-- table or its historical rows. A member who hasn't been grouped into a
-- family yet keeps being tracked individually; once grouped, Subscriptions for
-- that household is tracked in the new sandha_family_payments table
-- instead (see migrations/0007_sandha_family.sql). Nothing is deleted or
-- reinterpreted retroactively.

CREATE TABLE IF NOT EXISTS families (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    family_name TEXT NOT NULL,
    head_member_id INTEGER,             -- who Subscriptions is billed to; also the default contact
    address TEXT,
    primary_phone TEXT,
    primary_email TEXT,
    notes TEXT,
    status TEXT DEFAULT 'active',       -- 'active' | 'archived'
    created_by TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_by TEXT,
    updated_at DATETIME
);
CREATE INDEX IF NOT EXISTS idx_families_status ON families(status);

ALTER TABLE members ADD COLUMN family_id INTEGER;
ALTER TABLE members ADD COLUMN relation TEXT;        -- 'Head' | 'Spouse' | 'Child' | 'Parent' | 'Other'
ALTER TABLE members ADD COLUMN date_of_birth TEXT;   -- 'YYYY-MM-DD', optional
CREATE INDEX IF NOT EXISTS idx_members_family ON members(family_id);
