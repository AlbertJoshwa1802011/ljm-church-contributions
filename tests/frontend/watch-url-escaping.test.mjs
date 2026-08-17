// v2/watch.html builds its Sunday Live / Daily Prayer / Podcast cards by
// concatenating raw strings into innerHTML. Every other v2 page that does
// this (about.html, blog.html, contact.html, events.html, index.html,
// programs.html, testimonies.html) defines and uses an esc() helper —
// watch.html originally did not, so an admin-editable sunday_live_url /
// daily_prayer_url / podcast_playlist_url value like
// `" onmouseover="alert(1)" x="` broke out of the `href`/`iframe src`
// attribute and injected arbitrary HTML/JS for every visitor. Confirmed live
// against a real local Cloudflare Pages Functions + D1 runtime during the
// adversarial QA session that added this test.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const source = readFileSync(path.join(REPO_ROOT, "v2", "watch.html"), "utf8");

test("watch.html: defines an esc() HTML-escaping helper, matching every other v2 page", () => {
  assert.match(source, /function esc\(s\)/, "watch.html must define esc() like the rest of v2/*.html");
});

test("watch.html: the card template escapes title/desc/url/embed, never interpolates them raw", () => {
  const start = source.indexOf("grid.innerHTML = withUrl.map(");
  assert.notEqual(start, -1, "the card-rendering map() must still exist");
  const end = source.indexOf("}).join('');", start);
  const template = source.slice(start, end);

  // The raw, unescaped forms that caused the injection must not appear.
  assert.doesNotMatch(template, /['"] \+ c\.url \+ ['"]/, "c.url must never be concatenated unescaped");
  assert.doesNotMatch(template, /['"] \+ c\.title \+ ['"]/, "c.title must never be concatenated unescaped");
  assert.doesNotMatch(template, /['"] \+ embed \+ ['"]/, "embed must never be concatenated unescaped");

  // And the escaped forms must be present.
  assert.match(template, /esc\(c\.url\)/, "c.url must be passed through esc()");
  assert.match(template, /esc\(c\.title\)/, "c.title must be passed through esc()");
  assert.match(template, /esc\(c\.desc\)/, "c.desc must be passed through esc()");
  assert.match(template, /esc\(embed\)/, "embed must be passed through esc()");
});

test("watch.html: only http(s) URLs are ever treated as renderable (blocks javascript:/data: schemes)", () => {
  assert.match(source, /function safeUrl\(url\)/, "a safeUrl() scheme guard must exist");
  assert.match(source, /\^https\?:\\\/\\\//i, "safeUrl must require an http(s) scheme");
  assert.match(source, /url:\s*safeUrl\(s\.sunday_live_url\)/, "sunday_live_url must be passed through safeUrl()");
  assert.match(source, /url:\s*safeUrl\(s\.daily_prayer_url\)/, "daily_prayer_url must be passed through safeUrl()");
  assert.match(source, /url:\s*safeUrl\(s\.podcast_playlist_url\)/, "podcast_playlist_url must be passed through safeUrl()");
});
