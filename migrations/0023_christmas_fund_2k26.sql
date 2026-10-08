-- Migration 0023: Christmas Fund 2k26 + display rename of the 2025 ledger.
-- Additive only: keeps slug `christmas-fund` so historical gifts stay attached.

UPDATE funds
SET name = 'Christmas Fund 2025', updated_at = CURRENT_TIMESTAMP
WHERE slug = 'christmas-fund';

INSERT OR IGNORE INTO config (key, value) VALUES ('christmas_2k26_goal_amount', '15000');

INSERT OR IGNORE INTO funds (slug, name, description, goal_amount, is_system, status, visibility)
SELECT 'christmas-fund-2k26',
       'Christmas Fund 2k26',
       'Oct · Nov · Dec — Christmas 2026 season',
       CAST(value AS REAL),
       1,
       'active',
       'public'
FROM config WHERE key = 'christmas_2k26_goal_amount';
