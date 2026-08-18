// A program with a very long, unbroken titleEn/descriptionEn (nothing stops
// an admin from pasting one — see tests/api/programs.test.mjs) blew out
// /v2/programs.html to ~2.26 million px wide: .pg-item is a flex row, and a
// flex child's default min-width:auto refuses to shrink below its text's
// intrinsic (unwrapped) width. Confirmed live with Playwright: a 50,000-char
// titleEn pushed document.documentElement.scrollWidth from 1280 to 2,263,745.
//
// v2/programs.html has no build step, so this statically parses the source
// for the CSS/markup that fixes it (min-width:0 on the flex child that holds
// the title/description text, overflow-wrap on the text itself) rather than
// rendering the page.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const source = readFileSync(path.join(REPO_ROOT, "v2", "programs.html"), "utf8");

test("programs.html: the title/description wrapper can shrink below its content's intrinsic width", () => {
  assert.match(source, /\.pg-body\s*\{[^}]*min-width:\s*0/, ".pg-body must set min-width:0 so the flex item can shrink instead of forcing the row (and page) to grow");
});

test("programs.html: long unbroken title/description text wraps instead of overflowing", () => {
  assert.match(source, /\.pg-item h4\s*\{[^}]*overflow-wrap/, ".pg-item h4 must wrap long text");
  assert.match(source, /\.pg-item p\s*\{[^}]*overflow-wrap/, ".pg-item p must wrap long text");
});

test("programs.html: the render function actually assigns the guarded class to the title/description wrapper", () => {
  assert.match(source, /class="pg-body"/, "the title/description <div> in renderList() must carry the pg-body class the CSS guard targets");
});
