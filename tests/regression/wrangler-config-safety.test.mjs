// CRITICAL, confirmed-deployed vulnerability: wrangler.jsonc's committed
// `vars` block set ALLOW_LEGACY_EMAIL_TOKEN: "true" globally. That flag,
// per functions/api/_lib.js's requireAuth(), makes any plain email string
// sent as `Authorization: Bearer <email>` a fully-authenticated identity
// with ZERO proof of ownership. POST_MIGRATION_SAFETY_REPORT.md already
// documents this exact flag as "disabled by default" for precisely this
// reason ("full admin API access to anyone who knew an email address") —
// and the three super-admin emails it would unlock are hardcoded in this
// same public repo (_lib.js, admin-session.js). Because wrangler.jsonc has
// no environment-scoped override, this file's `vars` block IS the deployed
// production config — so the flag being "true" here meant the entire admin
// API (members, contributions, funds, roles, every destructive operation)
// was unauthenticated for anyone who could read this repository.
//
// This test parses the actual deployed config file, not a mock — it must
// keep failing shut even if someone re-adds the flag by copy-pasting an
// old snippet.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const configSource = readFileSync(path.join(REPO_ROOT, "wrangler.jsonc"), "utf8");

function stripJsonc(src) {
  return src.replace(/\/\/.*$/gm, "").replace(/,(\s*[}\]])/g, "$1");
}

test("wrangler.jsonc: the deployed config never enables ALLOW_LEGACY_EMAIL_TOKEN", () => {
  const config = JSON.parse(stripJsonc(configSource));
  const vars = config.vars || {};
  assert.notEqual(
    vars.ALLOW_LEGACY_EMAIL_TOKEN,
    "true",
    "ALLOW_LEGACY_EMAIL_TOKEN=true in the committed wrangler.jsonc deploys to production — " +
    "it authenticates any Bearer token that merely looks like an email address, no proof of " +
    "identity required. Use --binding ALLOW_LEGACY_EMAIL_TOKEN=true or a git-ignored .dev.vars " +
    "for local development instead (see .dev.vars.example)."
  );
});

test("wrangler.jsonc: no other obviously-dangerous flags are enabled in the deployed config", () => {
  const config = JSON.parse(stripJsonc(configSource));
  const vars = config.vars || {};
  // Same class of bug as above — any var here ships to production. Fail
  // the build if a future edit re-introduces a bypass flag under a new name.
  for (const [key, value] of Object.entries(vars)) {
    assert.ok(
      !/bypass|skip_auth|disable_auth|no_auth|debug_auth/i.test(key) || value !== "true",
      `Suspicious auth-bypass-shaped var "${key}"="${value}" is enabled in the deployed config`
    );
  }
});
