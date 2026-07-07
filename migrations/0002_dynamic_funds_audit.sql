-- Migration 0002: Dynamic Funds, Fund Membership, Activity/Audit Logs, Member profile extensions
-- Safe to run on a live database: purely additive. Idempotent except the two
-- ALTER TABLE statements at the very end (SQLite has no ADD COLUMN IF NOT EXISTS),
-- so they run last — a re-run fails only there, after all idempotent parts applied.

-- 1. Dynamic funds registry
CREATE TABLE IF NOT EXISTS funds (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT UNIQUE NOT NULL,              -- URL/API key, e.g. 'building-fund'
    name TEXT NOT NULL,                     -- Display name, e.g. 'Building Fund'
    description TEXT,
    goal_amount REAL DEFAULT 0,
    status TEXT DEFAULT 'active',           -- 'active' | 'archived' | 'deleted' (soft delete)
    visibility TEXT DEFAULT 'public',       -- 'public' | 'members' (only assigned members can view)
    is_system INTEGER DEFAULT 0,            -- 1 = legacy fund (Tech/Christmas): cannot be deleted or renamed via API
    created_by TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_by TEXT,
    updated_at DATETIME
);

-- 2. Member-to-fund assignment
CREATE TABLE IF NOT EXISTS fund_members (
    fund_id INTEGER NOT NULL,
    member_id INTEGER NOT NULL,
    added_by TEXT,
    added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (fund_id, member_id)
);

-- 3. Activity / audit log (admin operations + user view events)
CREATE TABLE IF NOT EXISTS activity_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    actor_email TEXT,                        -- verified email when available
    actor_type TEXT DEFAULT 'anonymous',     -- 'admin' | 'member' | 'anonymous'
    action TEXT NOT NULL,                    -- e.g. 'fund.create', 'purchase.add', 'view.page'
    entity_type TEXT,
    entity_id TEXT,
    details TEXT,                            -- JSON blob: changed fields, page path, etc.
    ip TEXT,
    user_agent TEXT,
    verified INTEGER DEFAULT 0,              -- 1 = actor identity cryptographically verified (Google ID token)
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_logs_created ON activity_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_logs_actor ON activity_logs(actor_email);
CREATE INDEX IF NOT EXISTS idx_logs_action ON activity_logs(action);

-- 4. Performance indexes for fast retrieval
CREATE INDEX IF NOT EXISTS idx_contrib_fund_date ON contributions(fund, date DESC);
CREATE INDEX IF NOT EXISTS idx_contrib_member ON contributions(member_name);
CREATE INDEX IF NOT EXISTS idx_members_email ON members(email);

-- 5. Seed legacy funds (goal pulled from live config so prod values are preserved)
INSERT OR IGNORE INTO funds (slug, name, goal_amount, is_system, status, visibility)
SELECT 'tech-contributions', 'Tech Fund', CAST(value AS REAL), 1, 'active', 'public'
FROM config WHERE key = 'tech_goal_amount';

INSERT OR IGNORE INTO funds (slug, name, goal_amount, is_system, status, visibility)
SELECT 'christmas-fund', 'Christmas Fund', CAST(value AS REAL), 1, 'active', 'public'
FROM config WHERE key = 'christmas_goal_amount';

-- 6. Config flags
INSERT OR IGNORE INTO config (key, value) VALUES ('force_login', 'false');

-- 7. Extend super_admin with the new permission scopes (idempotent: fixed value)
UPDATE roles
SET permissions = '["edit_purchases","edit_wishlist","manage_roles","view_members","manage_funds","delete_funds","view_audit"]'
WHERE role_name = 'super_admin';

-- 8. Member profile extensions (Sheets 'members' tab parity).
--    NOT idempotent — keep these LAST. On re-run the migration fails here harmlessly.
ALTER TABLE members ADD COLUMN first_join_date TEXT;
ALTER TABLE members ADD COLUMN recurring_reminders TEXT DEFAULT 'Yes';
