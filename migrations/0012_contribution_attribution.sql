-- Migration 0012: Contribution attribution + soft delete for the manual
-- add/edit/delete admin console feature.
-- Safe to run on a live database: purely additive. Idempotent except the
-- ALTER TABLE statements below (SQLite has no ADD COLUMN IF NOT EXISTS), so
-- they run last — a re-run fails only there, after the idempotent part applied.

-- Record which admin manually added/edited/soft-deleted a contribution row
-- (contributions had no attribution at all before this).
-- NOT idempotent — keep these LAST. On re-run this migration fails harmlessly here.
ALTER TABLE contributions ADD COLUMN created_by TEXT;
ALTER TABLE contributions ADD COLUMN updated_by TEXT;
ALTER TABLE contributions ADD COLUMN is_deleted INTEGER NOT NULL DEFAULT 0;
ALTER TABLE contributions ADD COLUMN deleted_at DATETIME;
