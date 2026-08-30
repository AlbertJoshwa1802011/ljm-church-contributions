// Regression tests for the home experience rework
// (docs/milestone-v2/13-home-experience-rework.md).
//
// Two things are guarded here.
//
// 1. Issue 9 — "clicking Events asks me to log in, and the popup is blocked."
//    Root cause was routing, not auth: every V2 page linked Events as the bare
//    path /events.html, and Home as /. Both go through functions/_middleware.js,
//    which serves the V2 build only to holders of a 24-hour ljm_beta cookie.
//    Once that cookie lapsed mid-session, those links dropped the visitor onto
//    the V1 pages — and V1's events.html loads portal-telemetry.js, a
//    fail-closed login overlay whose Google button is the popup that gets
//    blocked. GET /api/events was, and still is, fully public. The fix is to
//    link /v2/... explicitly, and this test fails if a bare link ever returns.
//
// 2. The CLAUDE.md no-build-step pitfall: with no bundler or type checker, a
//    call to a function that isn't defined is invisible until a real browser
//    throws, and one throw inside a chained init block silently aborts every
//    renderer queued after it (this is what once blanked the Analytics tab).
//    So: every function the home page's init chain calls must be defined in the
//    file, and each call must be individually try/catch wrapped.
//
// Static source parsing, matching tests/frontend/analytics-charts.test.mjs —
// this suite has no jsdom or browser harness.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const V2_DIR = path.join(REPO_ROOT, "v2");

const V2_PAGES = readdirSync(V2_DIR).filter(f => f.endsWith(".html"));
const home = readFileSync(path.join(V2_DIR, "index.html"), "utf8");

test("v2 pages exist to test", () => {
  assert.ok(V2_PAGES.length >= 10, `expected the v2 page set, found ${V2_PAGES.length}`);
});

test("no v2 page links Events by the bare /events.html path", () => {
  const offenders = V2_PAGES.filter(f =>
    /href="\/events\.html"/.test(readFileSync(path.join(V2_DIR, f), "utf8"))
  );
  assert.deepEqual(offenders, [],
    "a bare /events.html link falls back to the V1 login-gated page once the beta cookie lapses — link /v2/events.html instead");
});

test("no v2 page links Home by the bare / path", () => {
  const offenders = V2_PAGES.filter(f =>
    /href="\/"/.test(readFileSync(path.join(V2_DIR, f), "utf8"))
  );
  assert.deepEqual(offenders, [],
    "a bare / link leaves the V2 build once the beta cookie lapses — link /v2/index.html instead");
});

test("v2 pages never load the V1 fail-closed login overlay", () => {
  const offenders = V2_PAGES.filter(f =>
    /portal-telemetry\.js/.test(readFileSync(path.join(V2_DIR, f), "utf8"))
  );
  assert.deepEqual(offenders, [], "portal-telemetry.js hard-gates the page behind a Google popup");
});

test("portal-telemetry's force_login setting is actually read, not discarded", () => {
  const src = readFileSync(path.join(REPO_ROOT, "portal-telemetry.js"), "utf8");
  // Strip comments first: the fix's own comment quotes the broken expression it
  // replaced, and matching that would make this test pass or fail on prose.
  const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
  assert.doesNotMatch(code, /\?\s*true\s*:\s*true/,
    "the degenerate ternary made the admin's force_login toggle a no-op");
  assert.match(code, /force_login/, "the setting should still be consulted");
});

test("the home page's Events link points inside v2", () => {
  assert.match(home, /href="\/v2\/events\.html"/);
});

test("home page sections render in the agreed order", () => {
  const ids = [...home.matchAll(/<section[^>]*\bid="([^"]+)"/g)].map(m => m[1]);
  assert.deepEqual(ids, [
    "heroBanner", "intro", "actions", "happening", "times",
    "watch", "latestTestimonyWrap", "give", "visit"
  ], "Give and Plan a Visit were moved to the bottom — see issues 2 and 7");

  assert.ok(ids.indexOf("give") > ids.indexOf("happening"), "Give must sit below the ministry content");
  assert.equal(ids[ids.length - 1], "visit", "Plan a Visit is the last section");
});

// ---- the no-build-step pitfall ---------------------------------------------

function initChain(source) {
  const block = source.match(/\/\/ ── Init chain ──[\s\S]*?<\/script>/);
  assert.ok(block, "expected the home page's init chain");
  return block[0];
}

test("every renderer the init chain calls is defined in the page", () => {
  const chain = initChain(home);
  const called = new Set([
    ...[...chain.matchAll(/\brun\("[^"]+",\s*(\w+)\)/g)].map(m => m[1]),
    ...[...chain.matchAll(/return (\w+)\(\)\.then/g)].map(m => m[1])
  ]);
  called.delete("function");
  assert.ok(called.size >= 7, `expected the full renderer set, saw ${[...called].join(", ")}`);

  const defined = new Set([...home.matchAll(/function (\w+)\s*\(/g)].map(m => m[1]));
  const missing = [...called].filter(fn => !defined.has(fn));
  assert.deepEqual(missing, [],
    "a call to an undefined function is invisible until a real browser throws — see CLAUDE.md");
});

test("each chained renderer is individually try/catch wrapped", () => {
  const chain = initChain(home);
  assert.match(chain, /try \{/, "the run() helper must catch synchronous throws");
  assert.match(chain, /catch \(err\)/);
  assert.match(chain, /typeof result\.catch === "function"/,
    "async renderers must have their rejections caught too, or one failed fetch kills the rest");

  const wrapped = [...chain.matchAll(/run\("([^"]+)"/g)].map(m => m[1]);
  assert.ok(wrapped.length >= 7,
    `every renderer must go through run(); only ${wrapped.length} do`);
});

test("every element id the home page's scripts reach for exists in its markup", () => {
  const ids = new Set([...home.matchAll(/id="([^"]+)"/g)].map(m => m[1]));
  const referenced = new Set([...home.matchAll(/getElementById\("([^"]+)"\)/g)].map(m => m[1]));
  const missing = [...referenced].filter(id => !ids.has(id));
  assert.deepEqual(missing, [], "getElementById on a missing id returns null and throws on first use");
});

test("every data-i18n key on the home page resolves in both languages", () => {
  const dict = readFileSync(path.join(V2_DIR, "i18n.js"), "utf8");
  const keys = [...new Set([...home.matchAll(/data-i18n="([^"]+)"/g)].map(m => m[1]))];
  assert.ok(keys.length > 20, "the home page should carry i18n keys — it previously had none at all");

  // i18n.js's t() falls back to the raw key, so a missing entry would print
  // "home.give.title" to a visitor instead of the sentence.
  const missing = keys.filter(k => !dict.includes(`"${k}"`));
  assert.deepEqual(missing, [], "an unknown key renders the key itself to the visitor");

  // Present in the Tamil half too, not just English.
  const ta = dict.slice(dict.indexOf("ta: {"));
  const missingTa = keys.filter(k => !ta.includes(`"${k}"`));
  assert.deepEqual(missingTa, [], "keys must be translated, not just declared in English");
});

test("the hero carousel picks its image in JS, not with a both-images CSS swap", () => {
  // The old CSS swap needed both variants in the DOM; with ten slides that is
  // twenty downloads on every visit.
  assert.doesNotMatch(home, /\.hero-photo-dark \{ display: none; \}/,
    "the CSS light/dark image swap should be gone");
  assert.match(home, /function imageFor\(slide\)/, "slides choose their image in JS");
  assert.match(home, /imageDarkUrl/, "a dark variant is used when one exists");
});

test("the hero carousel auto-advances at the requested 2.5 seconds", () => {
  const heroBlock = home.match(/function initHeroCarousel\(\)[\s\S]*?\n  \}/);
  assert.ok(heroBlock, "expected initHeroCarousel");
  assert.match(heroBlock[0], /interval:\s*2500/, "the owner asked for a 2.5s rotation");
});

test("the promise card shows the monthly promise in both languages, swipeable", () => {
  const block = home.match(/function initPromiseCard\(\)[\s\S]*?\n  \}/);
  assert.ok(block, "expected initPromiseCard");
  assert.match(block[0], /today\.monthly/, "the card reads the monthly promise");
  assert.match(block[0], /textTa/, "Tamil is one of the slides");
  assert.match(block[0], /textEn/, "English is the other");
  assert.match(block[0], /LJMCarousel\.create/, "it must use the shared swipeable carousel");
  assert.match(block[0], /ljm-lang-changed/, "switching site language should re-render the card");
});

test("the shared carousel supports real swiping, with an axis lock", () => {
  const carousel = readFileSync(path.join(V2_DIR, "carousel.js"), "utf8");
  for (const evt of ["touchstart", "touchmove", "touchend", "mousedown", "keydown"]) {
    assert.match(carousel, new RegExp(`"${evt}"`), `${evt} must be handled — swiping did nothing before`);
  }
  assert.match(carousel, /axis = Math\.abs\(dx\) > Math\.abs\(dy\)/,
    "an axis lock is what lets a vertical page scroll pass through the carousel");
  assert.match(carousel, /prefers-reduced-motion/, "autoplay must respect reduced motion");
});

test("videos only load YouTube after the visitor presses play", () => {
  assert.doesNotMatch(home, /<iframe[^>]+youtube/i,
    "no YouTube iframe should be in the served markup");
  assert.match(home, /youtube-nocookie\.com\/embed\//, "the embed is built on click");
  assert.match(home, /class="video-play"/, "the thumbnail carries a play button");
});

test("theme choice is persisted so the hero keeps the right image across pages", () => {
  const offenders = V2_PAGES.filter(f => {
    const src = readFileSync(path.join(V2_DIR, f), "utf8");
    return src.includes("theme-toggle") && !src.includes("ljmTheme");
  });
  assert.deepEqual(offenders, [], "theme was per-page only, so navigating reset it to the OS preference");
});
