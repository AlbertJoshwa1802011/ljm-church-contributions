-- Migration 0012: index for fast family-name search/sort at scale (1000+ families).
-- Purely additive and idempotent. Safe to run on the live database.

CREATE INDEX IF NOT EXISTS idx_families_name ON families(family_name COLLATE NOCASE);
