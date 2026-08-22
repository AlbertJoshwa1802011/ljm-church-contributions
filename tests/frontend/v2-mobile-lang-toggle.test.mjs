// Two related i18n defects, both scoped to the five original "beta-flow" v2
// pages (index/events/give-flow/my-giving/our-giving.html — the pages built
// before the later Phase 0-5 session added v2/i18n.js and the seven
// ministry pages). Confirmed live via wrangler pages dev + Chromium:
//
// 1. The only `.lang-toggle` button on these five pages lives in the desktop
//    header (`.header-actions`), which shared.css hides at <=980px. Unlike
//    the seven newer pages, these five never got a matching copy inside
//    `.nav-drawer` (shared.css already has `.nav-drawer .lang-toggle {
//    display: block; }` written for exactly this, but the HTML for it was
//    never added) — so on every phone and most tablets, the language toggle
//    was completely unreachable.
// 2. Even once reachable, clicking it did nothing visible: these five pages'
//    nav links and Pray/Give CTAs were plain text/no `data-i18n` attribute,
//    so LJM_I18N.applyDom() had nothing to translate — the nav stayed in
//    English while every other page on the site switched to Tamil.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const V2_DIR = path.join(REPO_ROOT, "v2");
const v2Pages = readdirSync(V2_DIR).filter((f) => f.endsWith(".html"));

test("every v2 page has a reachable language toggle both on desktop and inside the mobile nav drawer", () => {
  assert.ok(v2Pages.length > 0);
  for (const page of v2Pages) {
    const source = readFileSync(path.join(V2_DIR, page), "utf8");
    const count = (source.match(/class="lang-toggle"/g) || []).length;
    assert.ok(
      count >= 2,
      `${page} must have at least 2 .lang-toggle buttons (header + nav-drawer) — found ${count}. ` +
      `shared.css's ".nav-drawer .lang-toggle { display: block; }" rule is dead CSS without a drawer copy, ` +
      `and the header's own copy is display:none at <=980px, so a single copy is unreachable on mobile.`
    );
  }
});

test("every v2 page's primary nav links carry data-i18n (so the Tamil toggle actually translates them)", () => {
  const NAV_KEYS = ["nav.home", "nav.about", "nav.events", "nav.testimonies", "nav.programs", "nav.ourGiving"];
  for (const page of v2Pages) {
    const source = readFileSync(path.join(V2_DIR, page), "utf8");
    const navBlock = source.match(/<nav class="primary-nav">([\s\S]*?)<\/nav>/);
    assert.notEqual(navBlock, null, `${page} must have a <nav class="primary-nav"> block`);
    for (const key of NAV_KEYS) {
      // Not every page links to every section (e.g. give-flow.html has a
      // slightly different set), so only require the keys the page's own
      // hrefs claim to support — i.e. every present nav link must be tagged.
      const hrefForKey = {
        "nav.home": '"/"', "nav.about": '"/v2/about.html"', "nav.events": '"/v2/events.html"',
        "nav.testimonies": '"/v2/testimonies.html"', "nav.programs": '"/v2/programs.html"', "nav.ourGiving": '"/v2/our-giving.html"'
      }[key];
      if (navBlock[1].includes(`href=${hrefForKey}`)) {
        assert.match(
          navBlock[1],
          new RegExp(`href=${hrefForKey.replace(/[/]/g, "\\/")}[^>]*data-i18n="${key}"`),
          `${page}: the ${hrefForKey} nav link must carry data-i18n="${key}" or it never translates`
        );
      }
    }
  }
});
