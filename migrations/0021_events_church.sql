-- Migration 0021: extend events additively with church + beneficiary info
-- (PRD §7.7, backend-schema §2.8). Nullable columns only — no existing
-- column is touched. Safe to run on the live database.

ALTER TABLE events ADD COLUMN church_id INTEGER;
ALTER TABLE events ADD COLUMN beneficiaries_count INTEGER;
ALTER TABLE events ADD COLUMN good_deed_summary_en TEXT;
ALTER TABLE events ADD COLUMN good_deed_summary_ta TEXT;
