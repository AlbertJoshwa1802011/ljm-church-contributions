// Any unmatched path used to fall through to Cloudflare Pages' default
// static-asset behavior, which (with no 404.html present) served the old
// root index.html with a 200 status instead of a real 404 — so a mistyped
// URL looked like a working page. Cloudflare Pages automatically serves a
// root-level 404.html (with a real 404 status) for any unmatched path when
// one exists, so this just locks in that the file exists and doesn't
// silently redirect back to a normal page.
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");

test("root 404.html exists so unmatched paths get a real 404, not the homepage", () => {
  const p = path.join(REPO_ROOT, "404.html");
  assert.ok(existsSync(p), "404.html must exist at the repo root for Cloudflare Pages to serve it on unmatched paths");
  const html = readFileSync(p, "utf8");
  assert.match(html, /<title>[^<]*not found[^<]*<\/title>/i);
  assert.doesNotMatch(html, /http-equiv=["']refresh["']/i, "must not meta-refresh back to a 200 page");
});
