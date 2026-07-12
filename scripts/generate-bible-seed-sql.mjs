// Generates migrations/0009_bible_kjv_seed.sql from bible-kjv-starter-data.mjs,
// with correct SQL string escaping (doubling single quotes) — run this again
// if the starter data set is ever edited.
//
//   node scripts/generate-bible-seed-sql.mjs
import { writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { KJV_VERSES, BOOK_ORDER } from "./bible-kjv-starter-data.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_PATH = path.resolve(__dirname, "..", "migrations", "0009_bible_kjv_seed.sql");

function sqlEscape(s) {
  return String(s).replace(/'/g, "''");
}

// Sanity: every book referenced in the data must be in the canonical order list.
for (const [book] of KJV_VERSES) {
  if (!BOOK_ORDER.includes(book)) {
    throw new Error(`Book "${book}" is not in BOOK_ORDER — fix bible-kjv-starter-data.mjs`);
  }
}

const lines = [
  "-- Migration 0009: KJV starter verse seed (generated — do not hand-edit).",
  "-- Regenerate with: node scripts/generate-bible-seed-sql.mjs",
  "-- (after editing scripts/bible-kjv-starter-data.mjs). Purely additive:",
  "-- INSERT OR IGNORE keyed on UNIQUE(version_code, book, chapter, verse).",
  ""
];

for (const [book, chapter, verse, text] of KJV_VERSES) {
  lines.push(
    `INSERT OR IGNORE INTO bible_verses (version_code, book, chapter, verse, text) VALUES ('KJV', '${sqlEscape(book)}', ${Number(chapter)}, ${Number(verse)}, '${sqlEscape(text)}');`
  );
}

lines.push("", "UPDATE bible_versions SET is_complete = 0 WHERE code = 'KJV';", "");

writeFileSync(OUT_PATH, lines.join("\n"));
console.log(`Wrote ${KJV_VERSES.length} verses to ${OUT_PATH}`);
