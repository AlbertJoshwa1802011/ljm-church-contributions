-- Milestone v2, Phase 4: extend events with church scoping + good-deed/beneficiary
-- fields, additively. All columns nullable; no existing column is touched.
-- See docs/milestone-v2/05-backend-schema.md §2.8.

ALTER TABLE events ADD COLUMN church_id INTEGER;
ALTER TABLE events ADD COLUMN beneficiaries_count INTEGER;
ALTER TABLE events ADD COLUMN good_deed_summary_en TEXT;
ALTER TABLE events ADD COLUMN good_deed_summary_ta TEXT;
