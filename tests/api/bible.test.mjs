import { test } from "node:test";
import assert from "node:assert/strict";
import { freshDb, makeContext } from "../helpers/mock-d1.mjs";
import * as bible from "../../functions/api/bible.js";

async function readJson(response) {
  return JSON.parse(await response.text());
}

test("bible: versions lists KJV and TOV with verse counts", async () => {
  const db = freshDb();
  const res = await readJson(await bible.onRequestGet(makeContext({ db, url: "https://test.local/api/bible?action=versions" })));
  assert.equal(res.success, true);
  const kjv = res.versions.find(v => v.code === "KJV");
  const tov = res.versions.find(v => v.code === "TOV");
  assert.ok(kjv, "KJV version row must exist");
  assert.ok(tov, "TOV version row must exist");
  assert.ok(kjv.verseCount > 100, "KJV should have the seeded starter verses");
  assert.equal(tov.verseCount, 0, "TOV has no text yet — awaiting import");
});

test("bible: books are returned in canonical (not alphabetical) order", async () => {
  const db = freshDb();
  const res = await readJson(await bible.onRequestGet(makeContext({ db, url: "https://test.local/api/bible?action=books&version=KJV" })));
  assert.equal(res.success, true);
  const genesisIdx = res.books.indexOf("Genesis");
  const exodusIdx = res.books.indexOf("Exodus");
  const revelationIdx = res.books.indexOf("Revelation");
  assert.ok(genesisIdx > -1 && exodusIdx > -1 && revelationIdx > -1);
  assert.ok(genesisIdx < exodusIdx, "Genesis must come before Exodus");
  assert.ok(exodusIdx < revelationIdx, "Exodus must come before Revelation");
  assert.equal(res.books[0], "Genesis", "Genesis should be first, not alphabetically-first");
});

test("bible: chapters and verses drill-down works for a known book", async () => {
  const db = freshDb();
  const chaptersRes = await readJson(await bible.onRequestGet(makeContext({ db, url: "https://test.local/api/bible?action=chapters&version=KJV&book=Philippians" })));
  assert.equal(chaptersRes.success, true);
  assert.ok(chaptersRes.chapters.includes(4));

  const versesRes = await readJson(await bible.onRequestGet(makeContext({ db, url: "https://test.local/api/bible?action=verses&version=KJV&book=Philippians&chapter=4" })));
  assert.equal(versesRes.success, true);
  const v13 = versesRes.verses.find(v => v.verse === 13);
  assert.ok(v13);
  assert.match(v13.text, /I can do all things through Christ/);
});

test("bible: lookup fetches one exact verse", async () => {
  const db = freshDb();
  const res = await readJson(await bible.onRequestGet(makeContext({ db, url: "https://test.local/api/bible?action=lookup&version=KJV&book=John&chapter=3&verse=16" })));
  assert.equal(res.success, true);
  assert.match(res.verse.text, /For God so loved the world/);
});

test("bible: lookup 404s for a verse not in the starter set", async () => {
  const db = freshDb();
  const res = await bible.onRequestGet(makeContext({ db, url: "https://test.local/api/bible?action=lookup&version=KJV&book=Genesis&chapter=5&verse=3" }));
  assert.equal(res.status, 404);
});

test("bible: search by reference string (e.g. 'Philippians 4:13') finds the exact verse", async () => {
  const db = freshDb();
  const res = await readJson(await bible.onRequestGet(makeContext({ db, url: "https://test.local/api/bible?action=search&version=KJV&q=" + encodeURIComponent("Philippians 4:13") })));
  assert.equal(res.success, true);
  assert.equal(res.results.length, 1);
  assert.match(res.results[0].text, /I can do all things/);
});

test("bible: search by keyword falls back to text search", async () => {
  const db = freshDb();
  const res = await readJson(await bible.onRequestGet(makeContext({ db, url: "https://test.local/api/bible?action=search&version=KJV&q=shepherd" })));
  assert.equal(res.success, true);
  assert.ok(res.results.some(r => r.book === "Psalms" && r.chapter === 23));
});

test("bible: import requires manage_content permission", async () => {
  const db = freshDb();
  const res = await bible.onRequestPost(makeContext({
    db, authToken: null, body: { action: "import", versionCode: "TOV", verses: [{ book: "Genesis", chapter: 1, verse: 1, text: "..." }] }
  }));
  assert.equal(res.status, 401);
});

test("bible: import adds verses to a translation and can mark it complete", async () => {
  const db = freshDb();
  const res = await readJson(await bible.onRequestPost(makeContext({
    db,
    body: {
      action: "import", versionCode: "TOV", versionName: "Tamil O.V.", language: "Tamil", markComplete: true,
      verses: [
        { book: "Genesis", chapter: 1, verse: 1, text: "தமிழ் வசனம் ஒன்று" },
        { book: "Genesis", chapter: 1, verse: 2, text: "தமிழ் வசனம் இரண்டு" }
      ]
    }
  })));
  assert.equal(res.success, true, res.message);
  assert.match(res.message, /Imported 2 of 2/);

  const versionsRes = await readJson(await bible.onRequestGet(makeContext({ db, url: "https://test.local/api/bible?action=versions" })));
  const tov = versionsRes.versions.find(v => v.code === "TOV");
  assert.equal(tov.verseCount, 2);
  assert.equal(tov.isComplete, 1);

  // Re-importing the same verse updates text instead of erroring (UNIQUE conflict handled).
  const res2 = await readJson(await bible.onRequestPost(makeContext({
    db, body: { action: "import", versionCode: "TOV", verses: [{ book: "Genesis", chapter: 1, verse: 1, text: "updated text" }] }
  })));
  assert.equal(res2.success, true);
  const lookupRes = await readJson(await bible.onRequestGet(makeContext({ db, url: "https://test.local/api/bible?action=lookup&version=TOV&book=Genesis&chapter=1&verse=1" })));
  assert.equal(lookupRes.verse.text, "updated text");
});

test("bible: books for an unseeded version returns an empty array, not an error", async () => {
  const db = freshDb();
  const res = await readJson(await bible.onRequestGet(makeContext({ db, url: "https://test.local/api/bible?action=books&version=ZZZ" })));
  assert.equal(res.success, true);
  assert.deepEqual(res.books, []);
});

test("bible: chapters without a book is a 400", async () => {
  const db = freshDb();
  const res = await bible.onRequestGet(makeContext({ db, url: "https://test.local/api/bible?action=chapters&version=KJV" }));
  assert.equal(res.status, 400);
});

test("bible: verses without book or chapter is a 400", async () => {
  const db = freshDb();
  const noBook = await bible.onRequestGet(makeContext({ db, url: "https://test.local/api/bible?action=verses&version=KJV&chapter=1" }));
  assert.equal(noBook.status, 400);
  const noChapter = await bible.onRequestGet(makeContext({ db, url: "https://test.local/api/bible?action=verses&version=KJV&book=Genesis" }));
  assert.equal(noChapter.status, 400);
});

test("bible: lookup without book, chapter, or verse is a 400", async () => {
  const db = freshDb();
  const res = await bible.onRequestGet(makeContext({ db, url: "https://test.local/api/bible?action=lookup&version=KJV&book=Genesis" }));
  assert.equal(res.status, 400);
});

test("bible: search with a query under 2 characters is a 400", async () => {
  const db = freshDb();
  const res = await bible.onRequestGet(makeContext({ db, url: "https://test.local/api/bible?action=search&version=KJV&q=a" }));
  assert.equal(res.status, 400);
});

test("bible: an unknown or missing action is a 400", async () => {
  const db = freshDb();
  const missing = await bible.onRequestGet(makeContext({ db, url: "https://test.local/api/bible" }));
  assert.equal(missing.status, 400);
  const unknown = await bible.onRequestGet(makeContext({ db, url: "https://test.local/api/bible?action=nonsense" }));
  assert.equal(unknown.status, 400);
});

test("bible: POST with an action other than 'import' is a 400", async () => {
  const db = freshDb();
  const res = await readJson(await bible.onRequestPost(makeContext({
    db, body: { action: "delete_everything", versionCode: "TOV", verses: [] }
  })));
  assert.equal(res.success, false);
  assert.match(res.message, /Unknown action/);
});

test("bible: import requires a versionCode and a non-empty verses array", async () => {
  const db = freshDb();
  const noVersion = await readJson(await bible.onRequestPost(makeContext({
    db, body: { action: "import", verses: [{ book: "Genesis", chapter: 1, verse: 1, text: "x" }] }
  })));
  assert.equal(noVersion.success, false);

  const noVerses = await readJson(await bible.onRequestPost(makeContext({
    db, body: { action: "import", versionCode: "TOV", verses: [] }
  })));
  assert.equal(noVerses.success, false);
});

test("bible: import rejects more than 5000 verses in one request", async () => {
  const db = freshDb();
  const verses = Array.from({ length: 5001 }, (_, i) => ({ book: "Genesis", chapter: 1, verse: i + 1, text: "x" }));
  const res = await readJson(await bible.onRequestPost(makeContext({
    db, body: { action: "import", versionCode: "TOV", verses }
  })));
  assert.equal(res.success, false);
  assert.match(res.message, /5000/);
});

test("bible: import silently skips malformed rows (missing book/chapter/verse/text) without failing the batch", async () => {
  const db = freshDb();
  const res = await readJson(await bible.onRequestPost(makeContext({
    db,
    body: {
      action: "import", versionCode: "TOV",
      verses: [
        { book: "Genesis", chapter: 1, verse: 1, text: "valid" },
        { book: "", chapter: 1, verse: 2, text: "missing book" },
        { book: "Genesis", chapter: 1, verse: 3, text: "" } // missing text
      ]
    }
  })));
  assert.equal(res.success, true, res.message);
  assert.match(res.message, /Imported 1 of 3/);
});
