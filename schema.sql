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
    family_id INTEGER,              -- see families table (migrations/0006_families.sql)
    relation TEXT,                  -- 'Head' | 'Spouse' | 'Child' | 'Parent' | 'Other'
    date_of_birth TEXT,             -- 'YYYY-MM-DD', optional
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
-- NOTE: pre-existing databases get first_join_date / recurring_reminders via migrations/0002_dynamic_funds_audit.sql,
-- and family_id / relation / date_of_birth via migrations/0006_families.sql

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
    created_by TEXT, -- admin email who logged this purchase (see migrations/0005_purchase_attribution.sql)
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
    image_url TEXT, -- Base64 data URL or external image URL
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
INSERT OR IGNORE INTO roles (role_name, permissions) VALUES ('super_admin', '["edit_purchases","edit_wishlist","manage_roles","view_members","manage_funds","delete_funds","view_audit","manage_expenses","manage_subscriptions","manage_members","manage_content","manage_events"]');
INSERT OR IGNORE INTO roles (role_name, permissions) VALUES ('editor', '["edit_purchases","edit_wishlist"]');
-- Keep existing super_admin rows in sync with the scope list above (idempotent)
UPDATE roles SET permissions = '["edit_purchases","edit_wishlist","manage_roles","view_members","manage_funds","delete_funds","view_audit","manage_expenses","manage_subscriptions","manage_members","manage_content","manage_events"]' WHERE role_name = 'super_admin';

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

-- 13. Subscriptions payment ledger (see migrations/0004_sandha.sql)
CREATE TABLE IF NOT EXISTS sandha_payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    member_id INTEGER NOT NULL,
    month TEXT NOT NULL,               -- 'YYYY-MM'
    amount REAL NOT NULL,
    paid_on TEXT,
    method TEXT DEFAULT 'cash',
    notes TEXT,
    recorded_by TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(member_id, month)
);
CREATE INDEX IF NOT EXISTS idx_sandha_month ON sandha_payments(month);
CREATE INDEX IF NOT EXISTS idx_sandha_member ON sandha_payments(member_id);
INSERT OR IGNORE INTO config (key, value) VALUES ('sandha_amount', '0');

-- 14. Families / believer households (see migrations/0006_families.sql)
CREATE TABLE IF NOT EXISTS families (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    family_name TEXT NOT NULL,
    head_member_id INTEGER,
    address TEXT,
    primary_phone TEXT,
    primary_email TEXT,
    notes TEXT,
    status TEXT DEFAULT 'active',
    created_by TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_by TEXT,
    updated_at DATETIME
);
CREATE INDEX IF NOT EXISTS idx_families_status ON families(status);
CREATE INDEX IF NOT EXISTS idx_members_family ON members(family_id);
-- Fast family-name search/sort at scale (see migrations/0012_families_search_index.sql)
CREATE INDEX IF NOT EXISTS idx_families_name ON families(family_name COLLATE NOCASE);

-- 15. Per-family Subscriptions payments (see migrations/0007_sandha_family.sql)
CREATE TABLE IF NOT EXISTS sandha_family_payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    family_id INTEGER NOT NULL,
    month TEXT NOT NULL,
    amount REAL NOT NULL,
    paid_on TEXT,
    method TEXT DEFAULT 'cash',
    paid_by_member_id INTEGER,
    notes TEXT,
    recorded_by TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(family_id, month)
);
CREATE INDEX IF NOT EXISTS idx_sandha_family_month ON sandha_family_payments(month);
CREATE INDEX IF NOT EXISTS idx_sandha_family_family ON sandha_family_payments(family_id);

-- Seed legacy funds (goal pulled from config so live values are preserved)
INSERT OR IGNORE INTO funds (slug, name, goal_amount, is_system, status, visibility)
SELECT 'tech-contributions', 'Tech Fund', CAST(value AS REAL), 1, 'active', 'public'
FROM config WHERE key = 'tech_goal_amount';

INSERT OR IGNORE INTO funds (slug, name, goal_amount, is_system, status, visibility)
SELECT 'christmas-fund', 'Christmas Fund', CAST(value AS REAL), 1, 'active', 'public'
FROM config WHERE key = 'christmas_goal_amount';

-- Config flags
INSERT OR IGNORE INTO config (key, value) VALUES ('force_login', 'false');

-- 16. Bible verse data dictionary (see migrations/0008_bible_verses.sql)
CREATE TABLE IF NOT EXISTS bible_versions (
    code TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    language TEXT NOT NULL,
    is_complete INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS bible_verses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    version_code TEXT NOT NULL,
    book TEXT NOT NULL,
    chapter INTEGER NOT NULL,
    verse INTEGER NOT NULL,
    text TEXT NOT NULL,
    UNIQUE(version_code, book, chapter, verse)
);
CREATE INDEX IF NOT EXISTS idx_bible_lookup ON bible_verses(version_code, book, chapter);
CREATE INDEX IF NOT EXISTS idx_bible_version ON bible_verses(version_code);
INSERT OR IGNORE INTO bible_versions (code, name, language, is_complete) VALUES ('KJV', 'King James Version', 'English', 0);
INSERT OR IGNORE INTO bible_versions (code, name, language, is_complete) VALUES ('TOV', 'Tamil O.V. (Bible Society of India)', 'Tamil', 0);

-- KJV starter verse seed (192 well-known verses spanning all 66 books —
-- see migrations/0009_bible_kjv_seed.sql and scripts/bible-kjv-starter-data.mjs.
-- NOT the complete Bible; BIBLE_VERSES.md explains how to bulk-import the rest.
INSERT OR IGNORE INTO bible_verses (version_code, book, chapter, verse, text) VALUES ('KJV', 'Genesis', 1, 1, 'In the beginning God created the heaven and the earth.');
INSERT OR IGNORE INTO bible_verses (version_code, book, chapter, verse, text) VALUES ('KJV', 'Genesis', 1, 27, 'So God created man in his own image, in the image of God created he him; male and female created he them.');
INSERT OR IGNORE INTO bible_verses (version_code, book, chapter, verse, text) VALUES ('KJV', 'Genesis', 2, 24, 'Therefore shall a man leave his father and his mother, and shall cleave unto his wife: and they shall be one flesh.');
INSERT OR IGNORE INTO bible_verses (version_code, book, chapter, verse, text) VALUES ('KJV', 'Genesis', 12, 2, 'And I will make of thee a great nation, and I will bless thee, and make thy name great; and thou shalt be a blessing:');
INSERT OR IGNORE INTO bible_verses (version_code, book, chapter, verse, text) VALUES ('KJV', 'Genesis', 50, 20, 'But as for you, ye thought evil against me; but God meant it unto good, to bring to pass, as it is this day, to save much people alive.');
INSERT OR IGNORE INTO bible_verses (version_code, book, chapter, verse, text) VALUES ('KJV', 'Exodus', 3, 14, 'And God said unto Moses, I AM THAT I AM: and he said, Thus shalt thou say unto the children of Israel, I AM hath sent me unto you.');
INSERT OR IGNORE INTO bible_verses (version_code, book, chapter, verse, text) VALUES ('KJV', 'Exodus', 14, 14, 'The LORD shall fight for you, and ye shall hold your peace.');
INSERT OR IGNORE INTO bible_verses (version_code, book, chapter, verse, text) VALUES ('KJV', 'Exodus', 20, 3, 'Thou shalt have no other gods before me.');
INSERT OR IGNORE INTO bible_verses (version_code, book, chapter, verse, text) VALUES ('KJV', 'Exodus', 20, 12, 'Honour thy father and thy mother: that thy days may be long upon the land which the LORD thy God giveth thee.');
INSERT OR IGNORE INTO bible_verses (version_code, book, chapter, verse, text) VALUES ('KJV', 'Leviticus', 19, 18, 'Thou shalt not avenge, nor bear any grudge against the children of thy people, but thou shalt love thy neighbour as thyself: I am the LORD.');
INSERT OR IGNORE INTO bible_verses (version_code, book, chapter, verse, text) VALUES ('KJV', 'Leviticus', 20, 26, 'And ye shall be holy unto me: for I the LORD am holy, and have severed you from other people, that ye should be mine.');
INSERT OR IGNORE INTO bible_verses (version_code, book, chapter, verse, text) VALUES ('KJV', 'Numbers', 6, 24, 'The LORD bless thee, and keep thee:');
INSERT OR IGNORE INTO bible_verses (version_code, book, chapter, verse, text) VALUES ('KJV', 'Numbers', 6, 25, 'The LORD make his face shine upon thee, and be gracious unto thee:');
INSERT OR IGNORE INTO bible_verses (version_code, book, chapter, verse, text) VALUES ('KJV', 'Numbers', 6, 26, 'The LORD lift up his countenance upon thee, and give thee peace.');
INSERT OR IGNORE INTO bible_verses (version_code, book, chapter, verse, text) VALUES ('KJV', 'Numbers', 23, 19, 'God is not a man, that he should lie; neither the son of man, that he should repent: hath he said, and shall he not do it? or hath he spoken, and shall he not make it good?');
INSERT OR IGNORE INTO bible_verses (version_code, book, chapter, verse, text) VALUES ('KJV', 'Deuteronomy', 6, 5, 'And thou shalt love the LORD thy God with all thine heart, and with all thy soul, and with all thy might.');
INSERT OR IGNORE INTO bible_verses (version_code, book, chapter, verse, text) VALUES ('KJV', 'Deuteronomy', 31, 6, 'Be strong and of a good courage, fear not, nor be afraid of them: for the LORD thy God, he it is that doth go with thee; he will not fail thee, nor forsake thee.');
INSERT OR IGNORE INTO bible_verses (version_code, book, chapter, verse, text) VALUES ('KJV', 'Deuteronomy', 31, 8, 'And the LORD, he it is that doth go before thee; he will be with thee, he will not fail thee, neither forsake thee: fear not, neither be dismayed.');
INSERT OR IGNORE INTO bible_verses (version_code, book, chapter, verse, text) VALUES ('KJV', 'Joshua', 1, 9, 'Have not I commanded thee? Be strong and of a good courage; be not afraid, neither be thou dismayed: for the LORD thy God is with thee whithersoever thou goest.');
INSERT OR IGNORE INTO bible_verses (version_code, book, chapter, verse, text) VALUES ('KJV', 'Joshua', 24, 15, 'And if it seem evil unto you to serve the LORD, choose you this day whom ye will serve; whether the gods which your fathers served that were on the other side of the flood, or the gods of the Amorites, in whose land ye dwell: but as for me and my house, we will serve the LORD.');
INSERT OR IGNORE INTO bible_verses (version_code, book, chapter, verse, text) VALUES ('KJV', 'Judges', 6, 12, 'And the angel of the LORD appeared unto him, and said unto him, The LORD is with thee, thou mighty man of valour.');
INSERT OR IGNORE INTO bible_verses (version_code, book, chapter, verse, text) VALUES ('KJV', 'Ruth', 1, 16, 'And Ruth said, Intreat me not to leave thee, or to return from following after thee: for whither thou goest, I will go; and where thou lodgest, I will lodge: thy people shall be my people, and thy God my God:');
INSERT OR IGNORE INTO bible_verses (version_code, book, chapter, verse, text) VALUES ('KJV', '1 Samuel', 16, 7, 'But the LORD said unto Samuel, Look not on his countenance, or on the height of his stature; because I have refused him: for the LORD seeth not as man seeth; for man looketh on the outward appearance, but the LORD looketh on the heart.');
INSERT OR IGNORE INTO bible_verses (version_code, book, chapter, verse, text) VALUES ('KJV', '1 Samuel', 17, 47, 'And all this assembly shall know that the LORD saveth not with sword and spear: for the battle is the LORD''S, and he will give you into our hands.');
INSERT OR IGNORE INTO bible_verses (version_code, book, chapter, verse, text) VALUES ('KJV', '2 Samuel', 22, 31, 'As for God, his way is perfect; the word of the LORD is tried: he is a buckler to all them that trust in him.');
INSERT OR IGNORE INTO bible_verses (version_code, book, chapter, verse, text) VALUES ('KJV', '1 Kings', 8, 57, 'The LORD our God be with us, as he was with our fathers: let him not leave us, nor forsake us:');
INSERT OR IGNORE INTO bible_verses (version_code, book, chapter, verse, text) VALUES ('KJV', '2 Kings', 6, 16, 'And he answered, Fear not: for they that be with us are more than they that be with them.');
INSERT OR IGNORE INTO bible_verses (version_code, book, chapter, verse, text) VALUES ('KJV', '1 Chronicles', 4, 10, 'And Jabez called on the God of Israel, saying, Oh that thou wouldest bless me indeed, and enlarge my coast, and that thine hand might be with me, and that thou wouldest keep me from evil, that it may not grieve me! And God granted him that which he requested.');
INSERT OR IGNORE INTO bible_verses (version_code, book, chapter, verse, text) VALUES ('KJV', '1 Chronicles', 16, 34, 'O give thanks unto the LORD; for he is good; for his mercy endureth for ever.');
INSERT OR IGNORE INTO bible_verses (version_code, book, chapter, verse, text) VALUES ('KJV', '2 Chronicles', 7, 14, 'If my people, which are called by my name, shall humble themselves, and pray, and seek my face, and turn from their wicked ways; then will I hear from heaven, and will forgive their sin, and will heal their land.');
INSERT OR IGNORE INTO bible_verses (version_code, book, chapter, verse, text) VALUES ('KJV', 'Ezra', 7, 10, 'For Ezra had prepared his heart to seek the law of the LORD, and to do it, and to teach in Israel statutes and judgments.');
INSERT OR IGNORE INTO bible_verses (version_code, book, chapter, verse, text) VALUES ('KJV', 'Nehemiah', 8, 10, 'Then he said unto them, Go your way, eat the fat, and drink the sweet, and send portions unto them for whom nothing is prepared: for this day is holy unto our LORD: neither be ye sorry; for the joy of the LORD is your strength.');
INSERT OR IGNORE INTO bible_verses (version_code, book, chapter, verse, text) VALUES ('KJV', 'Esther', 4, 14, 'For if thou altogether holdest thy peace at this time, then shall there enlargement and deliverance arise to the Jews from another place; but thou and thy father''s house shall be destroyed: and who knoweth whether thou art come to the kingdom for such a time as this?');
INSERT OR IGNORE INTO bible_verses (version_code, book, chapter, verse, text) VALUES ('KJV', 'Job', 1, 21, 'And said, Naked came I out of my mother''s womb, and naked shall I return thither: the LORD gave, and the LORD hath taken away; blessed be the name of the LORD.');
INSERT OR IGNORE INTO bible_verses (version_code, book, chapter, verse, text) VALUES ('KJV', 'Job', 19, 25, 'For I know that my redeemer liveth, and that he shall stand at the latter day upon the earth:');
INSERT OR IGNORE INTO bible_verses (version_code, book, chapter, verse, text) VALUES ('KJV', 'Job', 42, 2, 'I know that thou canst do every thing, and that no thought can be withholden from thee.');
INSERT OR IGNORE INTO bible_verses (version_code, book, chapter, verse, text) VALUES ('KJV', 'Psalms', 23, 1, 'The LORD is my shepherd; I shall not want.');
INSERT OR IGNORE INTO bible_verses (version_code, book, chapter, verse, text) VALUES ('KJV', 'Psalms', 23, 4, 'Yea, though I walk through the valley of the shadow of death, I will fear no evil: for thou art with me; thy rod and thy staff they comfort me.');
INSERT OR IGNORE INTO bible_verses (version_code, book, chapter, verse, text) VALUES ('KJV', 'Psalms', 27, 1, 'The LORD is my light and my salvation; whom shall I fear? the LORD is the strength of my life; of whom shall I be afraid?');
INSERT OR IGNORE INTO bible_verses (version_code, book, chapter, verse, text) VALUES ('KJV', 'Psalms', 34, 8, 'O taste and see that the LORD is good: blessed is the man that trusteth in him.');
INSERT OR IGNORE INTO bible_verses (version_code, book, chapter, verse, text) VALUES ('KJV', 'Psalms', 37, 4, 'Delight thyself also in the LORD: and he shall give thee the desires of thine heart.');
INSERT OR IGNORE INTO bible_verses (version_code, book, chapter, verse, text) VALUES ('KJV', 'Psalms', 46, 1, 'God is our refuge and strength, a very present help in trouble.');
INSERT OR IGNORE INTO bible_verses (version_code, book, chapter, verse, text) VALUES ('KJV', 'Psalms', 46, 10, 'Be still, and know that I am God: I will be exalted among the heathen, I will be exalted in the earth.');
INSERT OR IGNORE INTO bible_verses (version_code, book, chapter, verse, text) VALUES ('KJV', 'Psalms', 51, 10, 'Create in me a clean heart, O God; and renew a right spirit within me.');
INSERT OR IGNORE INTO bible_verses (version_code, book, chapter, verse, text) VALUES ('KJV', 'Psalms', 91, 1, 'He that dwelleth in the secret place of the most High shall abide under the shadow of the Almighty.');
INSERT OR IGNORE INTO bible_verses (version_code, book, chapter, verse, text) VALUES ('KJV', 'Psalms', 100, 5, 'For the LORD is good; his mercy is everlasting; and his truth endureth to all generations.');
INSERT OR IGNORE INTO bible_verses (version_code, book, chapter, verse, text) VALUES ('KJV', 'Psalms', 103, 1, 'Bless the LORD, O my soul: and all that is within me, bless his holy name.');
INSERT OR IGNORE INTO bible_verses (version_code, book, chapter, verse, text) VALUES ('KJV', 'Psalms', 119, 105, 'Thy word is a lamp unto my feet, and a light unto my path.');
INSERT OR IGNORE INTO bible_verses (version_code, book, chapter, verse, text) VALUES ('KJV', 'Psalms', 121, 1, 'I will lift up mine eyes unto the hills, from whence cometh my help.');
INSERT OR IGNORE INTO bible_verses (version_code, book, chapter, verse, text) VALUES ('KJV', 'Psalms', 121, 2, 'My help cometh from the LORD, which made heaven and earth.');
INSERT OR IGNORE INTO bible_verses (version_code, book, chapter, verse, text) VALUES ('KJV', 'Psalms', 127, 1, 'Except the LORD build the house, they labour in vain that build it: except the LORD keep the city, the watchman waketh but in vain.');
INSERT OR IGNORE INTO bible_verses (version_code, book, chapter, verse, text) VALUES ('KJV', 'Psalms', 139, 14, 'I will praise thee; for I am fearfully and wonderfully made: marvellous are thy works; and that my soul knoweth right well.');
INSERT OR IGNORE INTO bible_verses (version_code, book, chapter, verse, text) VALUES ('KJV', 'Psalms', 150, 6, 'Let every thing that hath breath praise the LORD. Praise ye the LORD.');
INSERT OR IGNORE INTO bible_verses (version_code, book, chapter, verse, text) VALUES ('KJV', 'Proverbs', 3, 5, 'Trust in the LORD with all thine heart; and lean not unto thine own understanding.');
INSERT OR IGNORE INTO bible_verses (version_code, book, chapter, verse, text) VALUES ('KJV', 'Proverbs', 3, 6, 'In all thy ways acknowledge him, and he shall direct thy paths.');
INSERT OR IGNORE INTO bible_verses (version_code, book, chapter, verse, text) VALUES ('KJV', 'Proverbs', 16, 3, 'Commit thy works unto the LORD, and thy thoughts shall be established.');
INSERT OR IGNORE INTO bible_verses (version_code, book, chapter, verse, text) VALUES ('KJV', 'Proverbs', 17, 17, 'A friend loveth at all times, and a brother is born for adversity.');
INSERT OR IGNORE INTO bible_verses (version_code, book, chapter, verse, text) VALUES ('KJV', 'Proverbs', 18, 10, 'The name of the LORD is a strong tower: the righteous runneth into it, and is safe.');
INSERT OR IGNORE INTO bible_verses (version_code, book, chapter, verse, text) VALUES ('KJV', 'Proverbs', 22, 6, 'Train up a child in the way he should go: and when he is old, he will not depart from it.');
INSERT OR IGNORE INTO bible_verses (version_code, book, chapter, verse, text) VALUES ('KJV', 'Proverbs', 27, 17, 'Iron sharpeneth iron; so a man sharpeneth the countenance of his friend.');
INSERT OR IGNORE INTO bible_verses (version_code, book, chapter, verse, text) VALUES ('KJV', 'Proverbs', 31, 25, 'Strength and honour are her clothing; and she shall rejoice in time to come.');
INSERT OR IGNORE INTO bible_verses (version_code, book, chapter, verse, text) VALUES ('KJV', 'Ecclesiastes', 3, 1, 'To every thing there is a season, and a time to every purpose under the heaven:');
INSERT OR IGNORE INTO bible_verses (version_code, book, chapter, verse, text) VALUES ('KJV', 'Ecclesiastes', 3, 11, 'He hath made every thing beautiful in his time: also he hath set the world in their heart, so that no man can find out the work that God maketh from the beginning to the end.');
INSERT OR IGNORE INTO bible_verses (version_code, book, chapter, verse, text) VALUES ('KJV', 'Song of Solomon', 2, 4, 'He brought me to the banqueting house, and his banner over me was love.');
INSERT OR IGNORE INTO bible_verses (version_code, book, chapter, verse, text) VALUES ('KJV', 'Isaiah', 9, 6, 'For unto us a child is born, unto us a son is given: and the government shall be upon his shoulder: and his name shall be called Wonderful, Counsellor, The mighty God, The everlasting Father, The Prince of Peace.');
INSERT OR IGNORE INTO bible_verses (version_code, book, chapter, verse, text) VALUES ('KJV', 'Isaiah', 40, 31, 'But they that wait upon the LORD shall renew their strength; they shall mount up with wings as eagles; they shall run, and not be weary; and they shall walk, and not faint.');
INSERT OR IGNORE INTO bible_verses (version_code, book, chapter, verse, text) VALUES ('KJV', 'Isaiah', 41, 10, 'Fear thou not; for I am with thee: be not dismayed; for I am thy God: I will strengthen thee; yea, I will help thee; yea, I will uphold thee with the right hand of my righteousness.');
INSERT OR IGNORE INTO bible_verses (version_code, book, chapter, verse, text) VALUES ('KJV', 'Isaiah', 53, 5, 'But he was wounded for our transgressions, he was bruised for our iniquities: the chastisement of our peace was upon him; and with his stripes we are healed.');
INSERT OR IGNORE INTO bible_verses (version_code, book, chapter, verse, text) VALUES ('KJV', 'Isaiah', 55, 8, 'For my thoughts are not your thoughts, neither are your ways my ways, saith the LORD.');
INSERT OR IGNORE INTO bible_verses (version_code, book, chapter, verse, text) VALUES ('KJV', 'Isaiah', 64, 8, 'But now, O LORD, thou art our father; we are the clay, and thou our potter; and we all are the work of thy hand.');
INSERT OR IGNORE INTO bible_verses (version_code, book, chapter, verse, text) VALUES ('KJV', 'Jeremiah', 17, 7, 'Blessed is the man that trusteth in the LORD, and whose hope the LORD is.');
INSERT OR IGNORE INTO bible_verses (version_code, book, chapter, verse, text) VALUES ('KJV', 'Jeremiah', 29, 11, 'For I know the thoughts that I think toward you, saith the LORD, thoughts of peace, and not of evil, to give you an expected end.');
INSERT OR IGNORE INTO bible_verses (version_code, book, chapter, verse, text) VALUES ('KJV', 'Jeremiah', 33, 3, 'Call unto me, and I will answer thee, and shew thee great and mighty things, which thou knowest not.');
INSERT OR IGNORE INTO bible_verses (version_code, book, chapter, verse, text) VALUES ('KJV', 'Lamentations', 3, 22, 'It is of the LORD''S mercies that we are not consumed, because his compassions fail not.');
INSERT OR IGNORE INTO bible_verses (version_code, book, chapter, verse, text) VALUES ('KJV', 'Lamentations', 3, 23, 'They are new every morning: great is thy faithfulness.');
INSERT OR IGNORE INTO bible_verses (version_code, book, chapter, verse, text) VALUES ('KJV', 'Ezekiel', 36, 26, 'A new heart also will I give you, and a new spirit will I put within you: and I will take away the stony heart out of your flesh, and I will give you an heart of flesh.');
INSERT OR IGNORE INTO bible_verses (version_code, book, chapter, verse, text) VALUES ('KJV', 'Daniel', 3, 17, 'If it be so, our God whom we serve is able to deliver us from the burning fiery furnace, and he will deliver us out of thine hand, O king.');
INSERT OR IGNORE INTO bible_verses (version_code, book, chapter, verse, text) VALUES ('KJV', 'Daniel', 3, 18, 'But if not, be it known unto thee, O king, that we will not serve thy gods, nor worship the golden image which thou hast set up.');
INSERT OR IGNORE INTO bible_verses (version_code, book, chapter, verse, text) VALUES ('KJV', 'Daniel', 6, 22, 'My God hath sent his angel, and hath shut the lions'' mouths, that they have not hurt me: forasmuch as before him innocency was found in me.');
INSERT OR IGNORE INTO bible_verses (version_code, book, chapter, verse, text) VALUES ('KJV', 'Hosea', 6, 6, 'For I desired mercy, and not sacrifice; and the knowledge of God more than burnt offerings.');
INSERT OR IGNORE INTO bible_verses (version_code, book, chapter, verse, text) VALUES ('KJV', 'Joel', 2, 25, 'And I will restore to you the years that the locust hath eaten, the cankerworm, and the caterpiller, and the palmerworm, my great army which I sent among you.');
INSERT OR IGNORE INTO bible_verses (version_code, book, chapter, verse, text) VALUES ('KJV', 'Amos', 5, 24, 'But let judgment run down as waters, and righteousness as a mighty stream.');
INSERT OR IGNORE INTO bible_verses (version_code, book, chapter, verse, text) VALUES ('KJV', 'Obadiah', 1, 15, 'For the day of the LORD is near upon all the heathen: as thou hast done, it shall be done unto thee: thy reward shall return upon thine own head.');
INSERT OR IGNORE INTO bible_verses (version_code, book, chapter, verse, text) VALUES ('KJV', 'Jonah', 2, 9, 'But I will sacrifice unto thee with the voice of thanksgiving; I will pay that that I have vowed. Salvation is of the LORD.');
INSERT OR IGNORE INTO bible_verses (version_code, book, chapter, verse, text) VALUES ('KJV', 'Micah', 6, 8, 'He hath shewed thee, O man, what is good; and what doth the LORD require of thee, but to do justly, and to love mercy, and to walk humbly with thy God?');
INSERT OR IGNORE INTO bible_verses (version_code, book, chapter, verse, text) VALUES ('KJV', 'Nahum', 1, 7, 'The LORD is good, a strong hold in the day of trouble; and he knoweth them that trust in him.');
INSERT OR IGNORE INTO bible_verses (version_code, book, chapter, verse, text) VALUES ('KJV', 'Habakkuk', 2, 4, 'Behold, his soul which is lifted up is not upright in him: but the just shall live by his faith.');
INSERT OR IGNORE INTO bible_verses (version_code, book, chapter, verse, text) VALUES ('KJV', 'Habakkuk', 3, 19, 'The LORD God is my strength, and he will make my feet like hinds'' feet, and he will make me to walk upon mine high places.');
INSERT OR IGNORE INTO bible_verses (version_code, book, chapter, verse, text) VALUES ('KJV', 'Zephaniah', 3, 17, 'The LORD thy God in the midst of thee is mighty; he will save, he will rejoice over thee with joy; he will rest in his love, he will joy over thee with singing.');
INSERT OR IGNORE INTO bible_verses (version_code, book, chapter, verse, text) VALUES ('KJV', 'Haggai', 2, 9, 'The glory of this latter house shall be greater than of the former, saith the LORD of hosts: and in this place will I give peace, saith the LORD of hosts.');
INSERT OR IGNORE INTO bible_verses (version_code, book, chapter, verse, text) VALUES ('KJV', 'Zechariah', 4, 6, 'Then he answered and spake unto me, saying, This is the word of the LORD unto Zerubbabel, saying, Not by might, nor by power, but by my spirit, saith the LORD of hosts.');
INSERT OR IGNORE INTO bible_verses (version_code, book, chapter, verse, text) VALUES ('KJV', 'Malachi', 3, 6, 'For I am the LORD, I change not; therefore ye sons of Jacob are not consumed.');
INSERT OR IGNORE INTO bible_verses (version_code, book, chapter, verse, text) VALUES ('KJV', 'Malachi', 3, 10, 'Bring ye all the tithes into the storehouse, that there may be meat in mine house, and prove me now herewith, saith the LORD of hosts, if I will not open you the windows of heaven, and pour you out a blessing, that there shall not be room enough to receive it.');
INSERT OR IGNORE INTO bible_verses (version_code, book, chapter, verse, text) VALUES ('KJV', 'Matthew', 5, 16, 'Let your light so shine before men, that they may see your good works, and glorify your Father which is in heaven.');
INSERT OR IGNORE INTO bible_verses (version_code, book, chapter, verse, text) VALUES ('KJV', 'Matthew', 6, 21, 'For where your treasure is, there will your heart be also.');
INSERT OR IGNORE INTO bible_verses (version_code, book, chapter, verse, text) VALUES ('KJV', 'Matthew', 6, 33, 'But seek ye first the kingdom of God, and his righteousness; and all these things shall be added unto you.');
INSERT OR IGNORE INTO bible_verses (version_code, book, chapter, verse, text) VALUES ('KJV', 'Matthew', 7, 7, 'Ask, and it shall be given you; seek, and ye shall find; knock, and it shall be opened unto you:');
INSERT OR IGNORE INTO bible_verses (version_code, book, chapter, verse, text) VALUES ('KJV', 'Matthew', 11, 28, 'Come unto me, all ye that labour and are heavy laden, and I will give you rest.');
INSERT OR IGNORE INTO bible_verses (version_code, book, chapter, verse, text) VALUES ('KJV', 'Matthew', 22, 37, 'Jesus said unto him, Thou shalt love the Lord thy God with all thy heart, and with all thy soul, and with all thy mind.');
INSERT OR IGNORE INTO bible_verses (version_code, book, chapter, verse, text) VALUES ('KJV', 'Matthew', 28, 19, 'Go ye therefore, and teach all nations, baptizing them in the name of the Father, and of the Son, and of the Holy Ghost:');
INSERT OR IGNORE INTO bible_verses (version_code, book, chapter, verse, text) VALUES ('KJV', 'Matthew', 28, 20, 'Teaching them to observe all things whatsoever I have commanded you: and, lo, I am with you alway, even unto the end of the world. Amen.');
INSERT OR IGNORE INTO bible_verses (version_code, book, chapter, verse, text) VALUES ('KJV', 'Mark', 10, 27, 'And Jesus looking upon them saith, With men it is impossible, but not with God: for with God all things are possible.');
INSERT OR IGNORE INTO bible_verses (version_code, book, chapter, verse, text) VALUES ('KJV', 'Mark', 11, 24, 'Therefore I say unto you, What things soever ye desire, when ye pray, believe that ye receive them, and ye shall have them.');
INSERT OR IGNORE INTO bible_verses (version_code, book, chapter, verse, text) VALUES ('KJV', 'Mark', 16, 15, 'And he said unto them, Go ye into all the world, and preach the gospel to every creature.');
INSERT OR IGNORE INTO bible_verses (version_code, book, chapter, verse, text) VALUES ('KJV', 'Luke', 1, 37, 'For with God nothing shall be impossible.');
INSERT OR IGNORE INTO bible_verses (version_code, book, chapter, verse, text) VALUES ('KJV', 'Luke', 2, 11, 'For unto you is born this day in the city of David a Saviour, which is Christ the Lord.');
INSERT OR IGNORE INTO bible_verses (version_code, book, chapter, verse, text) VALUES ('KJV', 'Luke', 6, 38, 'Give, and it shall be given unto you; good measure, pressed down, and shaken together, and running over, shall men give into your bosom. For with the same measure that ye mete withal it shall be measured to you again.');
INSERT OR IGNORE INTO bible_verses (version_code, book, chapter, verse, text) VALUES ('KJV', 'John', 1, 1, 'In the beginning was the Word, and the Word was with God, and the Word was God.');
INSERT OR IGNORE INTO bible_verses (version_code, book, chapter, verse, text) VALUES ('KJV', 'John', 3, 16, 'For God so loved the world, that he gave his only begotten Son, that whosoever believeth in him should not perish, but have everlasting life.');
INSERT OR IGNORE INTO bible_verses (version_code, book, chapter, verse, text) VALUES ('KJV', 'John', 8, 12, 'Then spake Jesus again unto them, saying, I am the light of the world: he that followeth me shall not walk in darkness, but shall have the light of life.');
INSERT OR IGNORE INTO bible_verses (version_code, book, chapter, verse, text) VALUES ('KJV', 'John', 10, 10, 'The thief cometh not, but for to steal, and to kill, and to destroy: I am come that they might have life, and that they might have it more abundantly.');
INSERT OR IGNORE INTO bible_verses (version_code, book, chapter, verse, text) VALUES ('KJV', 'John', 13, 34, 'A new commandment I give unto you, That ye love one another; as I have loved you, that ye also love one another.');
INSERT OR IGNORE INTO bible_verses (version_code, book, chapter, verse, text) VALUES ('KJV', 'John', 14, 6, 'Jesus saith unto him, I am the way, the truth, and the life: no man cometh unto the Father, but by me.');
INSERT OR IGNORE INTO bible_verses (version_code, book, chapter, verse, text) VALUES ('KJV', 'John', 15, 13, 'Greater love hath no man than this, that a man lay down his life for his friends.');
INSERT OR IGNORE INTO bible_verses (version_code, book, chapter, verse, text) VALUES ('KJV', 'John', 16, 33, 'These things I have spoken unto you, that in me ye might have peace. In the world ye shall have tribulation: but be of good cheer; I have overcome the world.');
INSERT OR IGNORE INTO bible_verses (version_code, book, chapter, verse, text) VALUES ('KJV', 'Acts', 1, 8, 'But ye shall receive power, after that the Holy Ghost is come upon you: and ye shall be witnesses unto me both in Jerusalem, and in all Judaea, and in Samaria, and unto the uttermost part of the earth.');
INSERT OR IGNORE INTO bible_verses (version_code, book, chapter, verse, text) VALUES ('KJV', 'Acts', 4, 12, 'Neither is there salvation in any other: for there is none other name under heaven given among men, whereby we must be saved.');
INSERT OR IGNORE INTO bible_verses (version_code, book, chapter, verse, text) VALUES ('KJV', 'Acts', 20, 35, 'It is more blessed to give than to receive.');
INSERT OR IGNORE INTO bible_verses (version_code, book, chapter, verse, text) VALUES ('KJV', 'Romans', 3, 23, 'For all have sinned, and come short of the glory of God;');
INSERT OR IGNORE INTO bible_verses (version_code, book, chapter, verse, text) VALUES ('KJV', 'Romans', 5, 8, 'But God commendeth his love toward us, in that, while we were yet sinners, Christ died for us.');
INSERT OR IGNORE INTO bible_verses (version_code, book, chapter, verse, text) VALUES ('KJV', 'Romans', 6, 23, 'For the wages of sin is death; but the gift of God is eternal life through Jesus Christ our Lord.');
INSERT OR IGNORE INTO bible_verses (version_code, book, chapter, verse, text) VALUES ('KJV', 'Romans', 8, 28, 'And we know that all things work together for good to them that love God, to them who are the called according to his purpose.');
INSERT OR IGNORE INTO bible_verses (version_code, book, chapter, verse, text) VALUES ('KJV', 'Romans', 8, 38, 'For I am persuaded, that neither death, nor life, nor angels, nor principalities, nor powers, nor things present, nor things to come,');
INSERT OR IGNORE INTO bible_verses (version_code, book, chapter, verse, text) VALUES ('KJV', 'Romans', 8, 39, 'Nor height, nor depth, nor any other creature, shall be able to separate us from the love of God, which is in Christ Jesus our Lord.');
INSERT OR IGNORE INTO bible_verses (version_code, book, chapter, verse, text) VALUES ('KJV', 'Romans', 10, 9, 'That if thou shalt confess with thy mouth the Lord Jesus, and shalt believe in thine heart that God hath raised him from the dead, thou shalt be saved.');
INSERT OR IGNORE INTO bible_verses (version_code, book, chapter, verse, text) VALUES ('KJV', 'Romans', 12, 1, 'I beseech you therefore, brethren, by the mercies of God, that ye present your bodies a living sacrifice, holy, acceptable unto God, which is your reasonable service.');
INSERT OR IGNORE INTO bible_verses (version_code, book, chapter, verse, text) VALUES ('KJV', 'Romans', 12, 2, 'And be not conformed to this world: but be ye transformed by the renewing of your mind, that ye may prove what is that good, and acceptable, and perfect, will of God.');
INSERT OR IGNORE INTO bible_verses (version_code, book, chapter, verse, text) VALUES ('KJV', '1 Corinthians', 10, 13, 'There hath no temptation taken you but such as is common to man: but God is faithful, who will not suffer you to be tempted above that ye are able; but will with the temptation also make a way to escape, that ye may be able to bear it.');
INSERT OR IGNORE INTO bible_verses (version_code, book, chapter, verse, text) VALUES ('KJV', '1 Corinthians', 13, 4, 'Charity suffereth long, and is kind; charity envieth not; charity vaunteth not itself, is not puffed up,');
INSERT OR IGNORE INTO bible_verses (version_code, book, chapter, verse, text) VALUES ('KJV', '1 Corinthians', 13, 7, 'Beareth all things, believeth all things, hopeth all things, endureth all things.');
INSERT OR IGNORE INTO bible_verses (version_code, book, chapter, verse, text) VALUES ('KJV', '1 Corinthians', 13, 13, 'And now abideth faith, hope, charity, these three; but the greatest of these is charity.');
INSERT OR IGNORE INTO bible_verses (version_code, book, chapter, verse, text) VALUES ('KJV', '1 Corinthians', 16, 14, 'Let all your things be done with charity.');
INSERT OR IGNORE INTO bible_verses (version_code, book, chapter, verse, text) VALUES ('KJV', '2 Corinthians', 5, 7, '(For we walk by faith, not by sight:)');
INSERT OR IGNORE INTO bible_verses (version_code, book, chapter, verse, text) VALUES ('KJV', '2 Corinthians', 5, 17, 'Therefore if any man be in Christ, he is a new creature: old things are passed away; behold, all things are become new.');
INSERT OR IGNORE INTO bible_verses (version_code, book, chapter, verse, text) VALUES ('KJV', '2 Corinthians', 9, 6, 'But this I say, He which soweth sparingly shall reap also sparingly; and he which soweth bountifully shall reap also bountifully.');
INSERT OR IGNORE INTO bible_verses (version_code, book, chapter, verse, text) VALUES ('KJV', '2 Corinthians', 9, 7, 'Every man according as he purposeth in his heart, so let him give; not grudgingly, or of necessity: for God loveth a cheerful giver.');
INSERT OR IGNORE INTO bible_verses (version_code, book, chapter, verse, text) VALUES ('KJV', '2 Corinthians', 12, 9, 'And he said unto me, My grace is sufficient for thee: for my strength is made perfect in weakness. Most gladly therefore will I rather glory in my infirmities, that the power of Christ may rest upon me.');
INSERT OR IGNORE INTO bible_verses (version_code, book, chapter, verse, text) VALUES ('KJV', 'Galatians', 2, 20, 'I am crucified with Christ: nevertheless I live; yet not I, but Christ liveth in me: and the life which I now live in the flesh I live by the faith of the Son of God, who loved me, and gave himself for me.');
INSERT OR IGNORE INTO bible_verses (version_code, book, chapter, verse, text) VALUES ('KJV', 'Galatians', 5, 22, 'But the fruit of the Spirit is love, joy, peace, longsuffering, gentleness, goodness, faith,');
INSERT OR IGNORE INTO bible_verses (version_code, book, chapter, verse, text) VALUES ('KJV', 'Galatians', 5, 23, 'Meekness, temperance: against such there is no law.');
INSERT OR IGNORE INTO bible_verses (version_code, book, chapter, verse, text) VALUES ('KJV', 'Galatians', 6, 9, 'And let us not be weary in well doing: for in due season we shall reap, if we faint not.');
INSERT OR IGNORE INTO bible_verses (version_code, book, chapter, verse, text) VALUES ('KJV', 'Ephesians', 2, 8, 'For by grace are ye saved through faith; and that not of yourselves: it is the gift of God:');
INSERT OR IGNORE INTO bible_verses (version_code, book, chapter, verse, text) VALUES ('KJV', 'Ephesians', 2, 9, 'Not of works, lest any man should boast.');
INSERT OR IGNORE INTO bible_verses (version_code, book, chapter, verse, text) VALUES ('KJV', 'Ephesians', 3, 20, 'Now unto him that is able to do exceeding abundantly above all that we ask or think, according to the power that worketh in us,');
INSERT OR IGNORE INTO bible_verses (version_code, book, chapter, verse, text) VALUES ('KJV', 'Ephesians', 4, 32, 'And be ye kind one to another, tenderhearted, forgiving one another, even as God for Christ''s sake hath forgiven you.');
INSERT OR IGNORE INTO bible_verses (version_code, book, chapter, verse, text) VALUES ('KJV', 'Ephesians', 6, 11, 'Put on the whole armour of God, that ye may be able to stand against the wiles of the devil.');
INSERT OR IGNORE INTO bible_verses (version_code, book, chapter, verse, text) VALUES ('KJV', 'Philippians', 1, 6, 'Being confident of this very thing, that he which hath begun a good work in you will perform it until the day of Jesus Christ:');
INSERT OR IGNORE INTO bible_verses (version_code, book, chapter, verse, text) VALUES ('KJV', 'Philippians', 4, 6, 'Be careful for nothing; but in every thing by prayer and supplication with thanksgiving let your requests be made known unto God.');
INSERT OR IGNORE INTO bible_verses (version_code, book, chapter, verse, text) VALUES ('KJV', 'Philippians', 4, 7, 'And the peace of God, which passeth all understanding, shall keep your hearts and minds through Christ Jesus.');
INSERT OR IGNORE INTO bible_verses (version_code, book, chapter, verse, text) VALUES ('KJV', 'Philippians', 4, 13, 'I can do all things through Christ which strengtheneth me.');
INSERT OR IGNORE INTO bible_verses (version_code, book, chapter, verse, text) VALUES ('KJV', 'Philippians', 4, 19, 'But my God shall supply all your need according to his riches in glory by Christ Jesus.');
INSERT OR IGNORE INTO bible_verses (version_code, book, chapter, verse, text) VALUES ('KJV', 'Colossians', 3, 2, 'Set your affection on things above, not on things on the earth.');
INSERT OR IGNORE INTO bible_verses (version_code, book, chapter, verse, text) VALUES ('KJV', 'Colossians', 3, 23, 'And whatsoever ye do, do it heartily, as to the Lord, and not unto men;');
INSERT OR IGNORE INTO bible_verses (version_code, book, chapter, verse, text) VALUES ('KJV', '1 Thessalonians', 5, 16, 'Rejoice evermore.');
INSERT OR IGNORE INTO bible_verses (version_code, book, chapter, verse, text) VALUES ('KJV', '1 Thessalonians', 5, 17, 'Pray without ceasing.');
INSERT OR IGNORE INTO bible_verses (version_code, book, chapter, verse, text) VALUES ('KJV', '1 Thessalonians', 5, 18, 'In every thing give thanks: for this is the will of God in Christ Jesus concerning you.');
INSERT OR IGNORE INTO bible_verses (version_code, book, chapter, verse, text) VALUES ('KJV', '2 Thessalonians', 3, 3, 'But the Lord is faithful, who shall stablish you, and keep you from evil.');
INSERT OR IGNORE INTO bible_verses (version_code, book, chapter, verse, text) VALUES ('KJV', '1 Timothy', 4, 12, 'Let no man despise thy youth; but be thou an example of the believers, in word, in conversation, in charity, in spirit, in faith, in purity.');
INSERT OR IGNORE INTO bible_verses (version_code, book, chapter, verse, text) VALUES ('KJV', '1 Timothy', 6, 10, 'For the love of money is the root of all evil: which while some coveted after, they have erred from the faith, and pierced themselves through with many sorrows.');
INSERT OR IGNORE INTO bible_verses (version_code, book, chapter, verse, text) VALUES ('KJV', '2 Timothy', 1, 7, 'For God hath not given us the spirit of fear; but of power, and of love, and of a sound mind.');
INSERT OR IGNORE INTO bible_verses (version_code, book, chapter, verse, text) VALUES ('KJV', '2 Timothy', 3, 16, 'All scripture is given by inspiration of God, and is profitable for doctrine, for reproof, for correction, for instruction in righteousness:');
INSERT OR IGNORE INTO bible_verses (version_code, book, chapter, verse, text) VALUES ('KJV', '2 Timothy', 4, 7, 'I have fought a good fight, I have finished my course, I have kept the faith:');
INSERT OR IGNORE INTO bible_verses (version_code, book, chapter, verse, text) VALUES ('KJV', 'Titus', 2, 11, 'For the grace of God that bringeth salvation hath appeared to all men,');
INSERT OR IGNORE INTO bible_verses (version_code, book, chapter, verse, text) VALUES ('KJV', 'Philemon', 1, 7, 'For we have great joy and consolation in thy love, because the bowels of the saints are refreshed by thee, brother.');
INSERT OR IGNORE INTO bible_verses (version_code, book, chapter, verse, text) VALUES ('KJV', 'Hebrews', 4, 16, 'Let us therefore come boldly unto the throne of grace, that we may obtain mercy, and find grace to help in time of need.');
INSERT OR IGNORE INTO bible_verses (version_code, book, chapter, verse, text) VALUES ('KJV', 'Hebrews', 11, 1, 'Now faith is the substance of things hoped for, the evidence of things not seen.');
INSERT OR IGNORE INTO bible_verses (version_code, book, chapter, verse, text) VALUES ('KJV', 'Hebrews', 12, 1, 'Wherefore seeing we also are compassed about with so great a cloud of witnesses, let us lay aside every weight, and the sin which doth so easily beset us, and let us run with patience the race that is set before us,');
INSERT OR IGNORE INTO bible_verses (version_code, book, chapter, verse, text) VALUES ('KJV', 'Hebrews', 13, 8, 'Jesus Christ the same yesterday, and to day, and for ever.');
INSERT OR IGNORE INTO bible_verses (version_code, book, chapter, verse, text) VALUES ('KJV', 'James', 1, 2, 'My brethren, count it all joy when ye fall into divers temptations;');
INSERT OR IGNORE INTO bible_verses (version_code, book, chapter, verse, text) VALUES ('KJV', 'James', 1, 3, 'Knowing this, that the trying of your faith worketh patience.');
INSERT OR IGNORE INTO bible_verses (version_code, book, chapter, verse, text) VALUES ('KJV', 'James', 1, 5, 'If any of you lack wisdom, let him ask of God, that giveth to all men liberally, and upbraideth not; and it shall be given him.');
INSERT OR IGNORE INTO bible_verses (version_code, book, chapter, verse, text) VALUES ('KJV', 'James', 1, 17, 'Every good gift and every perfect gift is from above, and cometh down from the Father of lights, with whom is no variableness, neither shadow of turning.');
INSERT OR IGNORE INTO bible_verses (version_code, book, chapter, verse, text) VALUES ('KJV', 'James', 4, 7, 'Submit yourselves therefore to God. Resist the devil, and he will flee from you.');
INSERT OR IGNORE INTO bible_verses (version_code, book, chapter, verse, text) VALUES ('KJV', '1 Peter', 2, 9, 'But ye are a chosen generation, a royal priesthood, an holy nation, a peculiar people; that ye should shew forth the praises of him who hath called you out of darkness into his marvellous light;');
INSERT OR IGNORE INTO bible_verses (version_code, book, chapter, verse, text) VALUES ('KJV', '1 Peter', 3, 15, 'But sanctify the Lord God in your hearts: and be ready always to give an answer to every man that asketh you a reason of the hope that is in you with meekness and fear:');
INSERT OR IGNORE INTO bible_verses (version_code, book, chapter, verse, text) VALUES ('KJV', '1 Peter', 5, 7, 'Casting all your care upon him; for he careth for you.');
INSERT OR IGNORE INTO bible_verses (version_code, book, chapter, verse, text) VALUES ('KJV', '2 Peter', 1, 3, 'According as his divine power hath given unto us all things that pertain unto life and godliness, through the knowledge of him that hath called us to glory and virtue:');
INSERT OR IGNORE INTO bible_verses (version_code, book, chapter, verse, text) VALUES ('KJV', '2 Peter', 3, 9, 'The Lord is not slack concerning his promise, as some men count slackness; but is longsuffering to us-ward, not willing that any should perish, but that all should come to repentance.');
INSERT OR IGNORE INTO bible_verses (version_code, book, chapter, verse, text) VALUES ('KJV', '1 John', 1, 9, 'If we confess our sins, he is faithful and just to forgive us our sins, and to cleanse us from all unrighteousness.');
INSERT OR IGNORE INTO bible_verses (version_code, book, chapter, verse, text) VALUES ('KJV', '1 John', 3, 1, 'Behold, what manner of love the Father hath bestowed upon us, that we should be called the sons of God: therefore the world knoweth us not, because it knew him not.');
INSERT OR IGNORE INTO bible_verses (version_code, book, chapter, verse, text) VALUES ('KJV', '1 John', 4, 8, 'He that loveth not knoweth not God; for God is love.');
INSERT OR IGNORE INTO bible_verses (version_code, book, chapter, verse, text) VALUES ('KJV', '1 John', 4, 18, 'There is no fear in love; but perfect love casteth out fear: because fear hath torment. He that feareth is not made perfect in love.');
INSERT OR IGNORE INTO bible_verses (version_code, book, chapter, verse, text) VALUES ('KJV', '1 John', 4, 19, 'We love him, because he first loved us.');
INSERT OR IGNORE INTO bible_verses (version_code, book, chapter, verse, text) VALUES ('KJV', '2 John', 1, 6, 'And this is love, that we walk after his commandments. This is the commandment, That, as ye have heard from the beginning, ye should walk in it.');
INSERT OR IGNORE INTO bible_verses (version_code, book, chapter, verse, text) VALUES ('KJV', '3 John', 1, 2, 'Beloved, I wish above all things that thou mayest prosper and be in health, even as thy soul prospereth.');
INSERT OR IGNORE INTO bible_verses (version_code, book, chapter, verse, text) VALUES ('KJV', '3 John', 1, 4, 'I have no greater joy than to hear that my children walk in truth.');
INSERT OR IGNORE INTO bible_verses (version_code, book, chapter, verse, text) VALUES ('KJV', 'Jude', 1, 24, 'Now unto him that is able to keep you from falling, and to present you faultless before the presence of his glory with exceeding joy,');
INSERT OR IGNORE INTO bible_verses (version_code, book, chapter, verse, text) VALUES ('KJV', 'Jude', 1, 25, 'To the only wise God our Saviour, be glory and majesty, dominion and power, both now and ever. Amen.');
INSERT OR IGNORE INTO bible_verses (version_code, book, chapter, verse, text) VALUES ('KJV', 'Revelation', 1, 8, 'I am Alpha and Omega, the beginning and the ending, saith the Lord, which is, and which was, and which is to come, the Almighty.');
INSERT OR IGNORE INTO bible_verses (version_code, book, chapter, verse, text) VALUES ('KJV', 'Revelation', 3, 20, 'Behold, I stand at the door, and knock: if any man hear my voice, and open the door, I will come in to him, and will sup with him, and he with me.');
INSERT OR IGNORE INTO bible_verses (version_code, book, chapter, verse, text) VALUES ('KJV', 'Revelation', 21, 4, 'And God shall wipe away all tears from their eyes; and there shall be no more death, neither sorrow, nor crying, neither shall there be any more pain: for the former things are passed away.');
INSERT OR IGNORE INTO bible_verses (version_code, book, chapter, verse, text) VALUES ('KJV', 'Revelation', 22, 13, 'I am Alpha and Omega, the beginning and the end, the first and the last.');

-- 17. Church events + photo galleries (see migrations/0011_events.sql)
CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  category TEXT,
  event_date TEXT,
  location TEXT,
  description TEXT,
  cover_photo TEXT,
  status TEXT DEFAULT 'draft',       -- 'draft' | 'published'
  featured INTEGER DEFAULT 0,        -- 1 = pin to top of public listing
  extra TEXT,                        -- JSON blob for future/optional fields
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_events_status ON events(status);
CREATE INDEX IF NOT EXISTS idx_events_date   ON events(event_date);

CREATE TABLE IF NOT EXISTS event_photos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id INTEGER NOT NULL,
  photo_url TEXT NOT NULL,
  storage TEXT DEFAULT 'r2',         -- 'r2' | 'base64' | 'external'
  caption TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_event_photos_event ON event_photos(event_id);
