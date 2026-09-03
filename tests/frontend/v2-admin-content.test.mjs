// V2 public pages must consume the same APIs the admin console writes.
// A pastor publishing an Event / Program / Blog / Promise / Testimony /
// Church from admin.html should see it on the matching v2 page without a
// deploy. These tests statically assert that contract — they do not drive a
// browser.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const v2Dir = path.join(REPO_ROOT, "v2");
const v2Pages = readdirSync(v2Dir).filter((f) => f.endsWith(".html"));

function readV2(name) {
  return readFileSync(path.join(v2Dir, name), "utf8");
}

test("v2 pages: Events nav stays inside v2 (/v2/events.html), not the legacy /events.html", () => {
  assert.ok(v2Pages.length >= 10, "expected the full set of v2 html pages");
  const offenders = [];
  for (const page of v2Pages) {
    const html = readV2(page);
    if (html.includes('href="/events.html"') || html.includes("'/events.html'") || html.includes('"/events.html"')) {
      // Allow the string only if every occurrence is already /v2/events.html
      const bare = [...html.matchAll(/(['"])(\/events\.html)\1/g)].filter((m) => {
        const idx = m.index;
        return html.slice(Math.max(0, idx - 3), idx) !== "/v2";
      });
      if (bare.length) offenders.push(page);
    }
  }
  assert.deepEqual(offenders, [], `v2 pages still linking to legacy /events.html: ${offenders.join(", ")}`);
});

test("v2/events.html fetches the public events listing (not admin ?all=1)", () => {
  const html = readV2("events.html");
  assert.match(html, /fetch\(\s*"\/api\/events\?_t=/);
  assert.doesNotMatch(html, /\/api\/events\?all=1/, "public v2 Events must not request drafts");
  assert.match(html, /data\.events/, "must render the events array from the API");
});

test("v2/index.html home pulls promises, events, programs, and testimonies", () => {
  const html = readV2("index.html");
  assert.match(html, /fetch\(\s*'\/api\/promises\?when=today/);
  assert.match(html, /fetch\(\s*"\/api\/events\?_t=/);
  assert.match(html, /fetch\(\s*"\/api\/programs\?_t=/);
  assert.match(html, /fetch\(\s*"\/api\/testimonies\?_t=/);
  assert.match(html, /\/v2\/events\.html/, "home 'Learn more' / empty-state must stay on the v2 Events page");
});

test("v2/programs.html fetches churches + programs", () => {
  const html = readV2("programs.html");
  assert.match(html, /fetch\(\s*'\/api\/churches/);
  assert.match(html, /fetch\(\s*'\/api\/programs/);
});

test("v2/blog.html fetches /api/blog (list and optional slug)", () => {
  const html = readV2("blog.html");
  assert.match(html, /fetch\(\s*'\/api\/blog/);
});

test("v2/about.html and v2/contact.html fetch /api/churches", () => {
  assert.match(readV2("about.html"), /fetch\(\s*'\/api\/churches/);
  assert.match(readV2("contact.html"), /fetch\(\s*'\/api\/churches/);
});

test("v2/testimonies.html fetches /api/testimonies", () => {
  assert.match(readV2("testimonies.html"), /fetch\(\s*'\/api\/testimonies/);
});

test("v2/events.html renders published event fields the admin form writes", () => {
  const html = readV2("events.html");
  assert.match(html, /e\.title/);
  assert.match(html, /e\.eventDate/);
  assert.match(html, /e\.category/);
  assert.match(html, /e\.coverPhoto/);
  assert.match(html, /e\.description/);
});
