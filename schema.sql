-- Cloudflare D1 SQL Schema for LJM Church Contributions

-- 1. Members Table
CREATE TABLE IF NOT EXISTS members (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    email TEXT,
    phone TEXT,
    is_verified INTEGER DEFAULT 0, -- 0 = No, 1 = Yes
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

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
INSERT OR IGNORE INTO roles (role_name, permissions) VALUES ('super_admin', '["edit_purchases","edit_wishlist","manage_roles","view_members"]');
INSERT OR IGNORE INTO roles (role_name, permissions) VALUES ('editor', '["edit_purchases","edit_wishlist"]');

-- Seed Default Super Admins
INSERT OR IGNORE INTO member_roles (email, role_name) VALUES ('albertjoshrock101@gmail.com', 'super_admin');
INSERT OR IGNORE INTO member_roles (email, role_name) VALUES ('thinkmuthu@gmail.com', 'super_admin');
INSERT OR IGNORE INTO member_roles (email, role_name) VALUES ('augustinraja261@gmail.com', 'super_admin');
