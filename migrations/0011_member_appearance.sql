-- Migration 0011: Per-member appearance preferences (accent-color themes).
-- Purely additive and idempotent. Safe to run on the live database.
--
-- Stores each signed-in member's chosen accent palette id, independently for
-- light and dark mode (e.g. "indigo", "ocean", "coral"). Keyed by the verified
-- Google email — the same natural key member_roles uses — so the choice syncs
-- across every device the member signs in on. Palette ids (not raw hex) are
-- stored, so the exact colors can evolve in theme.js without a data migration.
CREATE TABLE IF NOT EXISTS member_preferences (
    email        TEXT PRIMARY KEY,   -- lowercased, verified Google email
    accent_light TEXT,               -- palette id used in light mode
    accent_dark  TEXT,               -- palette id used in dark mode
    updated_at   DATETIME DEFAULT CURRENT_TIMESTAMP
);
