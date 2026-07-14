// Regression test for a real incident: the Analytics tab called
// renderCategoryPie(), a function that was never defined anywhere in
// script.js. Because script.js has no build step (no bundler, no linter,
// no TypeScript) that ReferenceError was only ever discoverable at click
// time in a real browser — it threw inside a setTimeout callback and
// silently aborted every chart render queued after it.
//
// This test statically parses script.js so a future PR that adds a chart
// render function to the Analytics lazy-render chain without defining it
// fails `npm test`, instead of only failing silently in production.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const scriptSource = readFileSync(path.join(REPO_ROOT, "script.js"), "utf8");

function extractAnalyticsRenderChain(source) {
  const match = source.match(/\[\s*(render\w+(?:\s*,\s*render\w+)*)\s*\]\.forEach\(renderFn/);
  assert.ok(match, "Expected to find the Analytics tab's lazy-render array (e.g. [renderCategoryPie, renderDistributionPie, ...].forEach(renderFn => ...)) in script.js");
  return match[1].split(",").map(name => name.trim());
}

function isFunctionDefined(source, name) {
  const declaredFn = new RegExp(`function\\s+${name}\\s*\\(`);
  const assignedFn = new RegExp(`(?:const|let|var)\\s+${name}\\s*=\\s*(?:async\\s*)?(?:function|\\()`);
  return declaredFn.test(source) || assignedFn.test(source);
}

test("Analytics tab: every chart renderer queued on tab activation is actually defined", () => {
  const renderFns = extractAnalyticsRenderChain(scriptSource);
  assert.ok(renderFns.length > 0, "Analytics render chain should not be empty");

  const missing = renderFns.filter(name => !isFunctionDefined(scriptSource, name));
  assert.deepEqual(missing, [], `These functions are called by the Analytics tab but never defined: ${missing.join(", ")}`);
});

test("Analytics tab: renderCategoryPie is defined and groups by Category (regression for the original bug)", () => {
  assert.ok(isFunctionDefined(scriptSource, "renderCategoryPie"), "renderCategoryPie must be defined in script.js");

  const fnBody = scriptSource.slice(scriptSource.indexOf("function renderCategoryPie"));
  const fnEnd = fnBody.indexOf("\n}\n");
  const snippet = fnBody.slice(0, fnEnd === -1 ? undefined : fnEnd);

  assert.match(snippet, /categoryPieChart/, "renderCategoryPie should target the #categoryPieChart canvas");
  assert.match(snippet, /c\.Category/, "renderCategoryPie should group contributions by their Category field");
});

test("Analytics tab: each chart render call in the lazy-render chain is wrapped so one failure can't block its siblings", () => {
  const chainStart = scriptSource.indexOf("Lazy-render charts on Analytics tab activation");
  assert.ok(chainStart !== -1, "Expected the Analytics lazy-render block to still exist in initTabs()");

  const chainBlock = scriptSource.slice(chainStart, chainStart + 800);
  assert.match(
    chainBlock,
    /try\s*{[\s\S]*?renderFn\(contributions\)[\s\S]*?}\s*catch/,
    "Each queued chart renderer should run inside its own try/catch so a thrown error in one chart doesn't prevent the others from rendering"
  );
});
