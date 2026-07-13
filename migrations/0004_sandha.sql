-- Migration 0004: Subscriptions (monthly membership dues).
-- Purely additive and idempotent. Safe to run on the live database.

-- 1. Subscriptions payment ledger: one row per member per month.
CREATE TABLE IF NOT EXISTS sandha_payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    member_id INTEGER NOT NULL,
    month TEXT NOT NULL,               -- 'YYYY-MM'
    amount REAL NOT NULL,
    paid_on TEXT,                      -- 'YYYY-MM-DD'
    method TEXT DEFAULT 'cash',       -- 'cash' | 'online'
    notes TEXT,
    recorded_by TEXT,                  -- admin email who marked it
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(member_id, month)
);
CREATE INDEX IF NOT EXISTS idx_sandha_month ON sandha_payments(month);
CREATE INDEX IF NOT EXISTS idx_sandha_member ON sandha_payments(member_id);

-- 2. Single monthly Subscriptions amount, set by the pastor in admin settings.
INSERT OR IGNORE INTO config (key, value) VALUES ('sandha_amount', '0');

-- 3. Grant the new manage_sandha scope to super_admin (idempotent fixed value).
UPDATE roles
SET permissions = '["edit_purchases","edit_wishlist","manage_roles","view_members","manage_funds","delete_funds","view_audit","manage_expenses","manage_sandha"]'
WHERE role_name = 'super_admin';
