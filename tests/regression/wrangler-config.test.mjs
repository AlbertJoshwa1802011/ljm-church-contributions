// Deploy-blocking invariants for wrangler.jsonc + the Pages deploy workflow.
// wrangler-action validates every binding in wrangler.jsonc; a declared R2
// bucket that does not exist in the account fails Function publish after
// assets have already uploaded (seen on main after PR #27).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const wrangler = readFileSync(path.join(REPO_ROOT, "wrangler.jsonc"), "utf8");
const wranglerActive = wrangler
  .split("\n")
  .filter((line) => !line.trim().startsWith("//"))
  .join("\n");
const deployYml = readFileSync(path.join(REPO_ROOT, ".github/workflows/deploy.yml"), "utf8");

test("wrangler.jsonc binds D1 and does not declare a missing R2 bucket", () => {
  assert.match(wranglerActive, /"binding": "DB"/);
  assert.match(wranglerActive, /"database_name": "ljm-contributions-db"/);
  assert.doesNotMatch(wranglerActive, /"r2_buckets"\s*:/);
  assert.doesNotMatch(wranglerActive, /"bucket_name": "ljm-event-photos"/);
});

test("deploy.yml pages deploy silences wrangler-action dirty-tree noise", () => {
  assert.match(deployYml, /pages deploy \. --project-name=light-of-jesus-ministry-contributions --commit-dirty=true/);
});

test("deploy.yml applies idempotent migration 0023 against remote D1", () => {
  assert.match(deployYml, /needs: test/);
  assert.match(deployYml, /d1 execute ljm-contributions-db --remote --file=\.\/migrations\/0023_christmas_fund_2k26\.sql/);
  assert.match(deployYml, /slug IN \('christmas-fund','christmas-fund-2k26'\)/);
});
