// Cloudflare Pages Function: /api/bible
// Bible verse data dictionary — lets the admin "Verses" picker browse/search
// by book/chapter/verse instead of the pastor typing text out by hand.
// Public GET (read-only, no auth — this is scripture, not church data).
//
//   GET ?action=versions                                  → [{code,name,language,isComplete,verseCount}]
//   GET ?action=books&version=KJV                         → ["Genesis", "Exodus", ...] in canonical order
//   GET ?action=chapters&version=KJV&book=Genesis          → [1,2,3,...]
//   GET ?action=verses&version=KJV&book=Genesis&chapter=1  → [{verse,text}]
//   GET ?action=lookup&version=KJV&book=Genesis&chapter=1&verse=1 → {book,chapter,verse,text}
//   GET ?action=search&version=KJV&q=love                  → [{book,chapter,verse,text}] (max 40)
//   POST {action:'import', versionCode, versionName?, language?, verses:[{book,chapter,verse,text}]}  (manage_content)

import { requireAuth, audit, json } from "./_lib.js";

// Canonical reading order — books are stored alphabetically-agnostic in SQL,
// this is only for sorting the "books" list the way a Bible is laid out.
const BOOK_ORDER = [
  "Genesis", "Exodus", "Leviticus", "Numbers", "Deuteronomy",
  "Joshua", "Judges", "Ruth", "1 Samuel", "2 Samuel",
  "1 Kings", "2 Kings", "1 Chronicles", "2 Chronicles", "Ezra",
  "Nehemiah", "Esther", "Job", "Psalms", "Proverbs",
  "Ecclesiastes", "Song of Solomon", "Isaiah", "Jeremiah", "Lamentations",
  "Ezekiel", "Daniel", "Hosea", "Joel", "Amos",
  "Obadiah", "Jonah", "Micah", "Nahum", "Habakkuk",
  "Zephaniah", "Haggai", "Zechariah", "Malachi",
  "Matthew", "Mark", "Luke", "John", "Acts",
  "Romans", "1 Corinthians", "2 Corinthians", "Galatians", "Ephesians",
  "Philippians", "Colossians", "1 Thessalonians", "2 Thessalonians", "1 Timothy",
  "2 Timothy", "Titus", "Philemon", "Hebrews", "James",
  "1 Peter", "2 Peter", "1 John", "2 John", "3 John",
  "Jude", "Revelation"
];

function bookSort(a, b) {
  const ia = BOOK_ORDER.indexOf(a), ib = BOOK_ORDER.indexOf(b);
  if (ia === -1 && ib === -1) return a.localeCompare(b);
  if (ia === -1) return 1;
  if (ib === -1) return -1;
  return ia - ib;
}

export async function onRequestGet(context) {
  const { env, request } = context;
  const db = env.DB;
  if (!db) return json({ error: "D1 database binding missing" }, 500);

  const url = new URL(request.url);
  const action = url.searchParams.get("action") || "";
  const version = (url.searchParams.get("version") || "KJV").toUpperCase();

  try {
    if (action === "versions") {
      const q = await db.prepare(
        `SELECT v.code, v.name, v.language, v.is_complete AS isComplete,
                (SELECT COUNT(*) FROM bible_verses bv WHERE bv.version_code = v.code) AS verseCount
         FROM bible_versions v ORDER BY v.code`
      ).all();
      return json({ success: true, versions: q.results || [] }, 200, { "Cache-Control": "public, max-age=300" });
    }

    if (action === "books") {
      const q = await db.prepare("SELECT DISTINCT book FROM bible_verses WHERE version_code = ?").bind(version).all();
      const books = (q.results || []).map(r => r.book).sort(bookSort);
      return json({ success: true, books }, 200, { "Cache-Control": "public, max-age=300" });
    }

    if (action === "chapters") {
      const book = url.searchParams.get("book") || "";
      if (!book) return json({ success: false, message: "Missing book" }, 400);
      const q = await db.prepare(
        "SELECT DISTINCT chapter FROM bible_verses WHERE version_code = ? AND book = ? ORDER BY chapter"
      ).bind(version, book).all();
      return json({ success: true, chapters: (q.results || []).map(r => r.chapter) }, 200, { "Cache-Control": "public, max-age=300" });
    }

    if (action === "verses") {
      const book = url.searchParams.get("book") || "";
      const chapter = Number(url.searchParams.get("chapter"));
      if (!book || !chapter) return json({ success: false, message: "Missing book or chapter" }, 400);
      const q = await db.prepare(
        "SELECT verse, text FROM bible_verses WHERE version_code = ? AND book = ? AND chapter = ? ORDER BY verse"
      ).bind(version, book, chapter).all();
      return json({ success: true, book, chapter, verses: q.results || [] }, 200, { "Cache-Control": "public, max-age=300" });
    }

    if (action === "lookup") {
      const book = url.searchParams.get("book") || "";
      const chapter = Number(url.searchParams.get("chapter"));
      const verse = Number(url.searchParams.get("verse"));
      if (!book || !chapter || !verse) return json({ success: false, message: "Missing book, chapter, or verse" }, 400);
      const row = await db.prepare(
        "SELECT book, chapter, verse, text FROM bible_verses WHERE version_code = ? AND book = ? AND chapter = ? AND verse = ?"
      ).bind(version, book, chapter, verse).first();
      if (!row) return json({ success: false, message: "Verse not found in this translation" }, 404);
      return json({ success: true, verse: row }, 200, { "Cache-Control": "public, max-age=300" });
    }

    if (action === "search") {
      const q = (url.searchParams.get("q") || "").trim();
      if (q.length < 2) return json({ success: false, message: "Search term must be at least 2 characters" }, 400);
      const like = `%${q}%`;
      // A plain reference like "John 3:16" or "John 3" also works as a search.
      const refMatch = q.match(/^([1-3]?\s?[A-Za-z. ]+?)\s+(\d+)(?::(\d+))?$/);
      let results;
      if (refMatch) {
        const book = refMatch[1].trim();
        const chapter = Number(refMatch[2]);
        const verse = refMatch[3] ? Number(refMatch[3]) : null;
        const rows = verse
          ? await db.prepare("SELECT book, chapter, verse, text FROM bible_verses WHERE version_code = ? AND book LIKE ? AND chapter = ? AND verse = ?").bind(version, `%${book}%`, chapter, verse).all()
          : await db.prepare("SELECT book, chapter, verse, text FROM bible_verses WHERE version_code = ? AND book LIKE ? AND chapter = ? ORDER BY verse LIMIT 40").bind(version, `%${book}%`, chapter).all();
        results = rows.results || [];
      }
      if (!results || !results.length) {
        const rows = await db.prepare(
          "SELECT book, chapter, verse, text FROM bible_verses WHERE version_code = ? AND text LIKE ? ORDER BY book, chapter, verse LIMIT 40"
        ).bind(version, like).all();
        results = rows.results || [];
      }
      return json({ success: true, results }, 200, { "Cache-Control": "public, max-age=60" });
    }

    return json({ success: false, message: "Unknown or missing action. Use versions | books | chapters | verses | lookup | search." }, 400);
  } catch (err) {
    return json({ success: false, message: err.message || String(err) }, 500);
  }
}

// Bulk import — the self-serve path to complete a translation (e.g. the full
// Tamil O.V. text, or the rest of the KJV) without needing a code deploy.
export async function onRequestPost(context) {
  const { env, request } = context;
  const db = env.DB;
  if (!db) return json({ error: "D1 database binding missing" }, 500);

  const auth = await requireAuth(context, "manage_content");
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json();
    if (body.action !== "import") return json({ success: false, message: "Unknown action" }, 400);

    const versionCode = String(body.versionCode || "").trim().toUpperCase().substring(0, 10);
    if (!versionCode) return json({ success: false, message: "versionCode is required" }, 400);

    const verses = Array.isArray(body.verses) ? body.verses : [];
    if (!verses.length) return json({ success: false, message: "verses array is required and must be non-empty" }, 400);
    if (verses.length > 5000) return json({ success: false, message: "Import at most 5000 verses per request — split into batches" }, 400);

    await db.prepare(
      `INSERT INTO bible_versions (code, name, language, is_complete) VALUES (?, ?, ?, 0)
       ON CONFLICT(code) DO UPDATE SET name = excluded.name, language = excluded.language`
    ).bind(versionCode, body.versionName || versionCode, body.language || "").run();

    let imported = 0;
    for (const v of verses) {
      const book = String(v.book || "").trim().substring(0, 40);
      const chapter = Number(v.chapter);
      const verse = Number(v.verse);
      const text = String(v.text || "").trim();
      if (!book || !chapter || !verse || !text) continue;
      await db.prepare(
        `INSERT INTO bible_verses (version_code, book, chapter, verse, text) VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(version_code, book, chapter, verse) DO UPDATE SET text = excluded.text`
      ).bind(versionCode, book, chapter, verse, text).run();
      imported++;
    }

    if (body.markComplete) {
      await db.prepare("UPDATE bible_versions SET is_complete = 1 WHERE code = ?").bind(versionCode).run();
    }

    await audit(context, {
      actorEmail: auth.email, actorType: "admin", verified: auth.verified,
      action: "bible.import", entityType: "bible_version", entityId: versionCode,
      details: { requested: verses.length, imported }
    });

    return json({ success: true, message: `Imported ${imported} of ${verses.length} verses for ${versionCode}` });
  } catch (err) {
    return json({ success: false, message: err.message || String(err) }, 500);
  }
}

export async function onRequestOptions() {
  return new Response(null, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization"
    }
  });
}
