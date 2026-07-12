-- Migration 0005: Purchase attribution + new permission scopes.
-- Safe to run on a live database: purely additive. Idempotent except the
-- ALTER TABLE statement below (SQLite has no ADD COLUMN IF NOT EXISTS), so
-- it runs last — a re-run fails only there, after the idempotent part applied.

-- 1. New permission scopes for the upcoming Families and Content (About
--    page / Bible verse curation) admin sections (idempotent: fixed value).
UPDATE roles
SET permissions = '["edit_purchases","edit_wishlist","manage_roles","view_members","manage_funds","delete_funds","view_audit","manage_expenses","manage_sandha","manage_members","manage_content"]'
WHERE role_name = 'super_admin';

-- 2. Record which admin logged a purchase (purchases had no attribution at
--    all before this — unlike expenses, which already has created_by).
--    NOT idempotent — keep this LAST. On re-run the migration fails here harmlessly.
ALTER TABLE purchases ADD COLUMN created_by TEXT;
