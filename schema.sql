-- Cloudflare D1 SQL Schema for LJM Church Contributions

-- 1. Members Table
CREATE TABLE IF NOT EXISTS members (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    email TEXT,
    phone TEXT,
    is_verified INTEGER DEFAULT 0, -- 0 = No, 1 = Yes
    first_join_date TEXT,
    recurring_reminders TEXT DEFAULT 'Yes',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
-- NOTE: pre-existing databases get first_join_date / recurring_reminders via migrations/0002_dynamic_funds_audit.sql

-- 2. Contributions Table (Idempotent via unique proof_id)
CREATE TABLE IF NOT EXISTS contributions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    member_name TEXT NOT NULL,
    amount REAL NOT NULL,
    date DATETIME NOT NULL,
    category TEXT NOT NULL, -- e.g., 'Online (Verified)', 'Direct Cash'
    notes TEXT,
    proof_id TEXT UNIQUE, -- Stores Razorpay Payment ID or reference ID
    email TEXT,
    phone TEXT,
    fund TEXT NOT NULL DEFAULT 'tech-contributions', -- 'tech-contributions' or 'christmas-fund'
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 3. Purchases Table ("What We Bought" tracker)
CREATE TABLE IF NOT EXISTS purchases (
    id TEXT PRIMARY KEY, -- e.g. 'P004'
    name TEXT NOT NULL,
    amount REAL NOT NULL, -- Total cost
    date TEXT NOT NULL,
    fund TEXT NOT NULL, -- e.g., 'tech-contributions' or 'christmas-fund'
    photo TEXT,
    vendor TEXT,
    description TEXT,
    status TEXT DEFAULT 'Active',
    fund_contribution REAL DEFAULT 0,
    external_contribution REAL DEFAULT 0,
    external_sources TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 4. Settings Configuration Table
CREATE TABLE IF NOT EXISTS config (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

-- 5. Wishlist Table (Items the church plans to buy)
CREATE TABLE IF NOT EXISTS wishlist (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    item_name TEXT NOT NULL,
    cost REAL NOT NULL,
    priority TEXT DEFAULT 'Medium', -- 'High', 'Medium', 'Low'
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Seed Initial Values
INSERT OR IGNORE INTO config (key, value) VALUES ('tech_goal_amount', '50000');
INSERT OR IGNORE INTO config (key, value) VALUES ('christmas_goal_amount', '30000');

-- Seed initial wishlist items
INSERT OR IGNORE INTO wishlist (id, item_name, cost, priority, notes) VALUES (1, 'Professional In-Ear Monitors (Stage Setup)', 15000, 'High', 'To improve audio output clarity for stage musicians');
INSERT OR IGNORE INTO wishlist (id, item_name, cost, priority, notes) VALUES (2, 'HD PTZ Camera for Live Streaming', 25000, 'Medium', 'For multi-angle high definition church service streaming');

-- 6. Custom Roles Table
CREATE TABLE IF NOT EXISTS roles (
    role_name TEXT PRIMARY KEY,
    permissions TEXT NOT NULL -- JSON array, e.g. ["edit_purchases", "manage_roles"]
);

-- 7. Member Roles Mapping Table
CREATE TABLE IF NOT EXISTS member_roles (
    email TEXT PRIMARY KEY,
    role_name TEXT NOT NULL,
    FOREIGN KEY(role_name) REFERENCES roles(role_name) ON DELETE CASCADE
);

-- Seed Default Roles
INSERT OR IGNORE INTO roles (role_name, permissions) VALUES ('super_admin', '["edit_purchases","edit_wishlist","manage_roles","view_members","manage_funds","delete_funds","view_audit","manage_expenses"]');
INSERT OR IGNORE INTO roles (role_name, permissions) VALUES ('editor', '["edit_purchases","edit_wishlist"]');
-- Keep existing super_admin rows in sync with the scope list above (idempotent)
UPDATE roles SET permissions = '["edit_purchases","edit_wishlist","manage_roles","view_members","manage_funds","delete_funds","view_audit","manage_expenses"]' WHERE role_name = 'super_admin';

-- Seed Default Super Admins
INSERT OR IGNORE INTO member_roles (email, role_name) VALUES ('albertjoshrock101@gmail.com', 'super_admin');
INSERT OR IGNORE INTO member_roles (email, role_name) VALUES ('thinkmuthu@gmail.com', 'super_admin');
INSERT OR IGNORE INTO member_roles (email, role_name) VALUES ('augustinraja261@gmail.com', 'super_admin');

-- 8. Dynamic Funds Registry
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

-- 9. Member-to-Fund Assignment
CREATE TABLE IF NOT EXISTS fund_members (
    fund_id INTEGER NOT NULL,
    member_id INTEGER NOT NULL,
    added_by TEXT,
    added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (fund_id, member_id)
);

-- 10. Activity / Audit Log (admin operations + user view events)
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

-- 11. Performance indexes for fast retrieval
CREATE INDEX IF NOT EXISTS idx_contrib_fund_date ON contributions(fund, date DESC);
CREATE INDEX IF NOT EXISTS idx_contrib_member ON contributions(member_name);
CREATE INDEX IF NOT EXISTS idx_members_email ON members(email);

-- 12. Church expenses ledger (see migrations/0003_expenses.sql)
CREATE TABLE IF NOT EXISTS expenses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    category TEXT DEFAULT 'General',
    amount REAL NOT NULL,
    expense_date TEXT,
    status TEXT DEFAULT 'paid',        -- 'planned' | 'paid' | 'cancelled'
    recurring TEXT DEFAULT 'none',     -- 'none' | 'monthly' | 'yearly'
    fund TEXT,
    vendor TEXT,
    notes TEXT,
    is_private INTEGER DEFAULT 0,      -- 1 = hide from the public portal
    created_by TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME
);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(expense_date DESC);
CREATE INDEX IF NOT EXISTS idx_expenses_status ON expenses(status);
CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category);

-- Seed legacy funds (goal pulled from config so live values are preserved)
INSERT OR IGNORE INTO funds (slug, name, goal_amount, is_system, status, visibility)
SELECT 'tech-contributions', 'Tech Fund', CAST(value AS REAL), 1, 'active', 'public'
FROM config WHERE key = 'tech_goal_amount';

INSERT OR IGNORE INTO funds (slug, name, goal_amount, is_system, status, visibility)
SELECT 'christmas-fund', 'Christmas Fund', CAST(value AS REAL), 1, 'active', 'public'
FROM config WHERE key = 'christmas_goal_amount';

-- Config flags
INSERT OR IGNORE INTO config (key, value) VALUES ('force_login', 'false');
