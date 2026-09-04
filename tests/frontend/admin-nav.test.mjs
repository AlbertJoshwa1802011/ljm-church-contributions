// Structural contract for the admin console's two-level nav.
//
// admin.html has no build step — a nav key without a matching #section-*
// panel, or a LOADERS key left over from a rename (this happened: sandha vs
// subscriptions), means a menu click opens an empty page in production with
// no error the pastor can see. These tests parse admin.html as text.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const adminSource = readFileSync(path.join(REPO_ROOT, "admin.html"), "utf8");

function isFunctionDefined(source, name) {
  const declaredFn = new RegExp(`function\\s+${name}\\s*\\(`);
  const assignedFn = new RegExp(`(?:const|let|var)\\s+${name}\\s*=\\s*(?:async\\s*)?(?:function|\\()`);
  return declaredFn.test(source) || assignedFn.test(source);
}

function parseNavKeys(source) {
  const match = source.match(/var NAV_GROUPS = \[([\s\S]*?)\];/);
  assert.ok(match, "Expected to find var NAV_GROUPS = [...] in admin.html");
  return [...match[1].matchAll(/\["([a-z]+)",/g)].map((m) => m[1]);
}

function parseLoaderMap(source) {
  const match = source.match(/var LOADERS = \{([\s\S]*?)\};/);
  assert.ok(match, "Expected to find var LOADERS = {...} in admin.html");
  const pairs = [];
  for (const m of match[1].matchAll(/(\w+)\s*:\s*([^,\n]+)/g)) {
    pairs.push({ key: m[1], value: m[2].trim() });
  }
  return pairs;
}

const navKeys = parseNavKeys(adminSource);
const loaders = parseLoaderMap(adminSource);
const loaderKeys = loaders.map((p) => p.key);

test("admin nav: NAV_GROUPS has the Ministry group and Events page", () => {
  assert.ok(adminSource.includes('id: "ministry"'), "Ministry group must exist");
  assert.ok(navKeys.includes("events"), "Events must be a NAV_GROUPS leaf (shown on v2 Events / Home)");
  assert.ok(navKeys.includes("subscriptions"), "Subscriptions must be a NAV_GROUPS leaf");
  assert.ok(!navKeys.includes("sandha"), "legacy sandha nav key must not return");
});

test("admin nav: every NAV_GROUPS leaf has a matching #section-* panel", () => {
  assert.ok(navKeys.length >= 20, `expected a full console, got ${navKeys.length} pages`);
  const missing = navKeys.filter((key) => !adminSource.includes(`id="section-${key}"`));
  assert.deepEqual(missing, [], `Nav keys with no #section-* panel: ${missing.join(", ")}`);
});

test("admin nav: every NAV_GROUPS leaf has a LOADERS entry (and vice versa)", () => {
  const navMissingLoader = navKeys.filter((key) => !loaderKeys.includes(key));
  const loaderMissingNav = loaderKeys.filter((key) => !navKeys.includes(key));
  assert.deepEqual(navMissingLoader, [], `Nav keys with no LOADERS entry (page opens empty): ${navMissingLoader.join(", ")}`);
  assert.deepEqual(loaderMissingNav, [], `LOADERS keys that are not in NAV_GROUPS (rename leftover): ${loaderMissingNav.join(", ")}`);
});

test("admin nav: every named LOADERS function is actually defined", () => {
  const missing = [];
  for (const { key, value } of loaders) {
    if (value.startsWith("function")) continue; // inline noop (selftest)
    if (!isFunctionDefined(adminSource, value)) missing.push(`${key}: ${value}`);
  }
  assert.deepEqual(missing, [], `LOADERS values that are not defined functions: ${missing.join(", ")}`);
});

test("admin nav: openSection looks up LOADERS[name] and writes location.hash", () => {
  assert.match(adminSource, /function openSection\s*\(\s*name\s*\)/);
  assert.match(adminSource, /var loader = LOADERS\[name\]/);
  assert.match(adminSource, /location\.hash = name/);
  assert.match(adminSource, /addEventListener\(\s*"hashchange"/);
});

test("admin nav: subscriptions loader is keyed subscriptions, not sandha", () => {
  const sub = loaders.find((p) => p.key === "subscriptions");
  assert.ok(sub, "LOADERS.subscriptions must exist");
  assert.equal(sub.value, "loadSubscriptions");
  assert.ok(!loaderKeys.includes("sandha"), "LOADERS.sandha leftover would leave Giving → Subscriptions empty");
});
