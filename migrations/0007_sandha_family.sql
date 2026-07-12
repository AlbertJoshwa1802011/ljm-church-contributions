-- Migration 0007: Per-family Subscriptions payments.
-- Purely additive — the existing per-member sandha_payments table (and its
-- history) is untouched. Once a member is grouped into a family (see
-- migrations/0006_families.sql), Subscriptions for that household is billed and
-- tracked here instead, normally paid by the family head.

CREATE TABLE IF NOT EXISTS sandha_family_payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    family_id INTEGER NOT NULL,
    month TEXT NOT NULL,               -- 'YYYY-MM'
    amount REAL NOT NULL,
    paid_on TEXT,
    method TEXT DEFAULT 'cash',
    paid_by_member_id INTEGER,         -- usually the family head
    notes TEXT,
    recorded_by TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(family_id, month)
);
CREATE INDEX IF NOT EXISTS idx_sandha_family_month ON sandha_family_payments(month);
CREATE INDEX IF NOT EXISTS idx_sandha_family_family ON sandha_family_payments(family_id);
