// Regression: the V2 header hamburger (#hamburgerBtn) was clipped off-screen
// on real phone widths. .brand (logo + title + "Coimbatore · Worldwide")
// refused to shrink, and .site-header { overflow: hidden } clipped the
// button — the only way to open the nav drawer — so the header looked like
// logo-only with no menu. A prior mobile fix (hide .brand small) was lost
// when the hamburger-everywhere header landed on an older shared.css base.
//
// This suite statically asserts the CSS invariants that keep the button
// visible at every viewport; it does not drive a browser.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const css = readFileSync(path.join(REPO_ROOT, "v2", "shared.css"), "utf8");
const v2Pages = readdirSync(path.join(REPO_ROOT, "v2")).filter((f) => f.endsWith(".html"));

test("v2 shared.css: hamburger is display:flex at every width (not desktop-hidden)", () => {
  assert.match(
    css,
    /\.hamburger-btn\s*\{[^}]*display:\s*flex/s,
    ".hamburger-btn must use display:flex (visible on desktop and mobile)"
  );
  assert.doesNotMatch(
    css,
    /\.hamburger-btn\s*\{[^}]*display:\s*none/s,
    ".hamburger-btn must not default to display:none"
  );
  // The old "only show below 980px" pattern must not return.
  assert.doesNotMatch(
    css,
    /@media\s*\([^)]*max-width:\s*980px[^)]*\)\s*\{\s*\.hamburger-btn\s*\{\s*display:\s*flex/,
    "Do not re-introduce a max-width:980px gate that is the only place hamburger becomes flex"
  );
});

test("v2 shared.css: primary-nav stays hidden (no desktop horizontal row)", () => {
  assert.match(
    css,
    /\.primary-nav\s*\{[^}]*display:\s*none/s,
    ".primary-nav must remain display:none — nav lives in the drawer"
  );
});

test("v2 shared.css: narrow viewports hide the decorative brand subtitle so the hamburger fits", () => {
  // Must hide .brand small somewhere below desktop widths. Accept any
  // max-width ≤720px media query that sets display:none on .brand small.
  const hideSmall = css.match(
    /@media\s*\(\s*max-width:\s*(\d+)px\s*\)\s*\{[^}]*\.brand\s+small\s*\{\s*display:\s*none/s
  );
  assert.ok(hideSmall, "Expected a max-width media query that sets .brand small { display: none }");
  const bp = Number(hideSmall[1]);
  assert.ok(bp >= 380 && bp <= 980, `subtitle-hide breakpoint should be in 380–980px range, got ${bp}`);
});

test("v2 shared.css: .brand can shrink so header-actions keeps its slot", () => {
  const brandRule = css.match(/\.brand\s*\{([^}]+)\}/);
  assert.ok(brandRule, ".brand rule must exist");
  const body = brandRule[1];
  assert.doesNotMatch(body, /flex-shrink:\s*0/, ".brand must not be flex-shrink:0 (that pushed the hamburger off-screen)");
  assert.match(body, /min-width:\s*0/, ".brand needs min-width:0 so it can actually compress in the flex row");
});

test("v2 pages: every page still wires the existing hamburger + drawer", () => {
  assert.ok(v2Pages.length >= 10, "expected the full set of v2 html pages");
  for (const page of v2Pages) {
    const html = readFileSync(path.join(REPO_ROOT, "v2", page), "utf8");
    assert.match(html, /id="hamburgerBtn"/, `${page} must keep #hamburgerBtn`);
    assert.match(html, /id="navDrawer"/, `${page} must keep #navDrawer`);
    assert.match(html, /id="navDrawerClose"/, `${page} must keep #navDrawerClose`);
    assert.match(html, /id="navDrawerBackdrop"/, `${page} must keep #navDrawerBackdrop`);
    assert.match(html, /classList\.add\(['"]open['"]\)/, `${page} must open the drawer via the existing .open class`);
  }
});
