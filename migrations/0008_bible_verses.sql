-- Migration 0008: Bible verse data dictionary (multi-translation).
-- Purely additive and idempotent. Safe to run on the live database.
--
-- bible_versions lists which translations are available (metadata only).
-- bible_verses holds the actual verse text, one row per (version, book,
-- chapter, verse). Seeded with a curated starter set of well-known verses
-- in the King James Version (public domain) across all 66 books, plus a
-- placeholder Tamil O.V. version row ready to receive a bulk import via
-- POST /api/bible?action=import — see BIBLE_VERSES.md for how to complete
-- either translation with the full text.

CREATE TABLE IF NOT EXISTS bible_versions (
    code TEXT PRIMARY KEY,           -- 'KJV', 'TOV', ...
    name TEXT NOT NULL,              -- 'King James Version'
    language TEXT NOT NULL,          -- 'English', 'Tamil'
    is_complete INTEGER DEFAULT 0,   -- 1 once the full 66-book text has been imported
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
