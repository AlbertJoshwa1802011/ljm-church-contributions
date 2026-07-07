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
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 3. Purchases Table ("What We Bought" tracker)
CREATE TABLE IF NOT EXISTS purchases (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    item_name TEXT NOT NULL,
    amount REAL NOT NULL,
    date DATETIME NOT NULL,
    fund TEXT NOT NULL, -- e.g., 'tech-contributions' or 'christmas-fund'
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 4. Settings Configuration Table
CREATE TABLE IF NOT EXISTS config (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

-- Seed Initial Values
INSERT OR IGNORE INTO config (key, value) VALUES ('tech_goal_amount', '50000');
INSERT OR IGNORE INTO config (key, value) VALUES ('christmas_goal_amount', '30000');
