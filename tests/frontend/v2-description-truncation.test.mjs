// Regression test: v2/events.html, v2/index.html, v2/blog.html, and
// v2/testimonies.html each hard-truncated a long description/body with a
// plain `.slice(0, N)` (testimonies.html appended an ellipsis but still cut
// mid-word). Real seeded content hit this: the VBS 2026 event description is
// longer than 110 chars and the cut landed mid-word ("...Three days of B"),
// on both the Events page and the Home page's "Upcoming" card.
//
// Each of the four pages now defines a `truncate(s, limit)` helper that
// cuts at the last whole word before the limit and appends an ellipsis.
// This statically confirms the helper exists and is actually used at the
// description-rendering call site, rather than the raw `.slice(0, N)`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");

const CASES = [
  { file: "v2/events.html", call: "truncate(e.description, 110)" },
  { file: "v2/index.html", call: "truncate(e.description || \"\", 100)" },
  { file: "v2/blog.html", call: "truncate(p.bodyEn || '', 100)" },
  { file: "v2/testimonies.html", call: "truncate(body || '', 160)" }
];

test("v2 pages: long descriptions are truncated at a word boundary with an ellipsis, not a raw mid-word slice", () => {
  for (const { file, call } of CASES) {
    const source = readFileSync(path.join(REPO_ROOT, file), "utf8");
    assert.match(source, /function truncate\(s, limit\)/, `${file}: expected a truncate(s, limit) helper`);
    assert.ok(source.includes(call), `${file}: expected the description to be rendered via ${call}`);
  }
});
