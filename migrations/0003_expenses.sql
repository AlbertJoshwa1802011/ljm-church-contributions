-- Migration 0003: Church expense tracking + planning.
-- Purely additive and idempotent. Safe to run on the live database.

-- 1. Expenses ledger — every outgoing (utilities, rent, events, maintenance,
--    outreach, salaries, one-off or recurring) plus planned/budgeted items.
CREATE TABLE IF NOT EXISTS expenses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    category TEXT DEFAULT 'General',   -- Utilities, Rent, Events, Maintenance, Outreach, Salary, ...
    amount REAL NOT NULL,
    expense_date TEXT,                 -- when it happened, or is planned for (YYYY-MM-DD)
    status TEXT DEFAULT 'paid',        -- 'planned' | 'paid' | 'cancelled'
    recurring TEXT DEFAULT 'none',     -- 'none' | 'monthly' | 'yearly'
    fund TEXT,                         -- optional source fund slug ('' = general funds)
    vendor TEXT,
    notes TEXT,
    is_private INTEGER DEFAULT 0,      -- 1 = hide from the public portal (e.g. salaries)
    created_by TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME
);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(expense_date DESC);
CREATE INDEX IF NOT EXISTS idx_expenses_status ON expenses(status);
CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category);

-- 2. Grant the new manage_expenses scope to super_admin (idempotent fixed value).
UPDATE roles
SET permissions = '["edit_purchases","edit_wishlist","manage_roles","view_members","manage_funds","delete_funds","view_audit","manage_expenses"]'
WHERE role_name = 'super_admin';
