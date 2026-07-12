# Bible Verses

A proper data dictionary for Bible verses, so the pastor can **pick** a verse for the Verse of the Month/Year cards instead of typing scripture out by hand — and so the admin console isn't limited to a single hardcoded translation.

## What's actually in the database right now

`bible_versions` lists two translations:

| Code | Name | Language | Status |
|---|---|---|---|
| `KJV` | King James Version | English | 192 well-known verses seeded, spanning all 66 books |
| `TOV` | Tamil O.V. (Bible Society of India) | Tamil | Registered, **no verse text yet** |

**This is intentionally not the complete Bible** (that's roughly 31,100 verses). The King James Version is public domain, so its full text could legally be embedded — but I generated this seed from my own knowledge of well-known passages rather than transcribing a complete Bible from memory at that scale, because getting a sacred text wrong via recall error is not an acceptable risk. The 192 seeded verses are a "greatest hits" set — high-confidence, frequently-quoted verses — chosen so the picker is genuinely useful (every book has at least one entry) from day one, not a placeholder.

**Tamil O.V. has zero verses on purpose.** I didn't fabricate Tamil scripture text, both because I can't guarantee character-perfect accuracy at that scale for a language script, and because I don't know the exact copyright/licensing status of the specific Bible Society of India edition you'd want to use. The infrastructure (schema, API, admin picker, search) fully supports it — it just needs real text imported from a source you have rights to use.

## How to complete a translation

Both gaps close the same way: `POST /api/bible` with `action: "import"`, authenticated as an admin holding the `manage_content` permission scope.

```
POST /api/bible
Authorization: Bearer <your Google ID token, or the ADMIN_API_TOKEN machine token>
Content-Type: application/json

{
  "action": "import",
  "versionCode": "TOV",
  "versionName": "Tamil O.V. (Bible Society of India)",
  "language": "Tamil",
  "markComplete": false,
  "verses": [
    { "book": "Genesis", "chapter": 1, "verse": 1, "text": "..." },
    { "book": "Genesis", "chapter": 1, "verse": 2, "text": "..." }
  ]
}
```

Notes:
- `book` names should match the canonical English book names already used by `KJV` (`"1 Corinthians"`, `"Song of Solomon"`, etc.) so the book/chapter picker groups both translations under the same book list — the verse **text** itself can of course be in any language/script.
- Up to 5000 verses per request; split a full-Bible import into batches (e.g. per book, or a few books at a time).
- Re-importing a verse that already exists **updates its text** rather than erroring (`ON CONFLICT ... DO UPDATE`) — safe to re-run if you need to fix a typo across a whole file.
- Pass `"markComplete": true` on your last batch to flip `bible_versions.is_complete` to `1`, which is purely informational (shown next to the translation's name in the admin picker, e.g. "(31,102 verses)") — nothing in the app *requires* a translation to be complete to use it.
- The `KJV` starter set can be extended the same way — import more verses under `versionCode: "KJV"` to grow past the 192-verse starter set, whenever you have (or generate) a trustworthy source for the rest.

If you don't want to write the `fetch`/`curl` call yourself, this is also a reasonable task to hand to an engineer or another AI session with a source file (a plain-text or JSON Bible export) already in hand — the endpoint does the validation and DB writes, the caller just needs to shape the JSON.

### Where the KJV starter set came from

`scripts/bible-kjv-starter-data.mjs` — a plain JS array of `[book, chapter, verse, text]` tuples — is the actual source of truth for the 192 seeded verses. `scripts/generate-bible-seed-sql.mjs` turns it into `migrations/0009_bible_kjv_seed.sql` (with correct SQL string escaping, since a few KJV verses contain apostrophes like "LORD'S" or "hinds' feet"). If you want to curate/extend the starter set yourself rather than using the bulk-import API, edit the `.mjs` data file and re-run the generator:

```bash
node scripts/generate-bible-seed-sql.mjs
```

## API reference (`functions/api/bible.js`)

All `GET` actions are public (read-only, no auth — this is scripture, not church data).

| Action | Example | Returns |
|---|---|---|
| `versions` | `GET /api/bible?action=versions` | Every translation with its verse count and completeness flag |
| `books` | `GET /api/bible?action=books&version=KJV` | Book names in canonical reading order (not alphabetical) |
| `chapters` | `GET /api/bible?action=chapters&version=KJV&book=Genesis` | Chapter numbers available for that book |
| `verses` | `GET /api/bible?action=verses&version=KJV&book=Genesis&chapter=1` | `{verse, text}` for every verse in that chapter |
| `lookup` | `GET /api/bible?action=lookup&version=KJV&book=John&chapter=3&verse=16` | One exact verse |
| `search` | `GET /api/bible?action=search&version=KJV&q=Philippians+4:13` | Up to 40 matches — accepts either a `Book C:V` / `Book C` reference or a plain keyword |
| `import` (POST) | see above | Bulk upsert, `manage_content` permission required |

## Where verses show up in the app

- **Admin → Content → Verses**: the pastor searches/picks a verse for the Verse of the Month and Verse of the Year cards. The picker fills in the existing `verse_month_ref`/`verse_month_text` (and year equivalents) config fields — the storage format didn't change, only how the pastor fills it in.
- **Public dashboard (`index.html`) and the signed-in believer's page (`member.html`)**: both render the same Verse of the Month/Year cards from those config values.
- The unrelated hardcoded "verse of the day" rotation in `script.js` (`BIBLE_VERSES` array) and the static verses on `about.html` are separate, older pieces of content — not wired to this data dictionary. `about.html`'s verses are now editable from the admin About page editor (see the About page section of the admin console) as plain text/reference pairs, independent of this picker.
