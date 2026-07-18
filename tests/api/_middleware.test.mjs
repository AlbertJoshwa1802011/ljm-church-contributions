// Tests for functions/_middleware.js — the sole gatekeeper deciding whether
// a request gets the old, unmodified flow or the new "v2" flow. Because this
// decides routing for every request, it's tested for both directions:
// eligible testers get routed to /v2/*, everyone/everything else falls
// through to next() untouched. See docs/milestone-v2/11-v2-flow-implementation.md.
import { test } from "node:test";
import assert from "node:assert/strict";
import * as middleware from "../../functions/_middleware.js";
import { signBetaCookie, BETA_COOKIE_NAME } from "../../functions/api/_beta.js";

const SECRET = "middleware-test-secret";

function makeMiddlewareContext({ path = "/", search = "", cookie = null, secret = SECRET } = {}) {
  const calls = { next: 0, assetsFetch: [] };
  const request = {
    url: `https://test.local${path}${search}`,
    headers: {
      get: (name) => (name === "Cookie" && cookie ? `${BETA_COOKIE_NAME}=${cookie}` : null)
    }
  };
  const env = {
    ...(secret ? { BETA_COOKIE_SECRET: secret } : {}),
    ASSETS: {
      fetch: async (req) => {
        calls.assetsFetch.push(req.url);
        return new Response("v2 page", { status: 200 });
      }
    }
  };
  const next = async () => {
    calls.next++;
    return new Response("old page", { status: 200 });
  };
  return { context: { request, env, next }, calls };
}

test("middleware: an unmapped path always falls through to next(), regardless of cookie", async () => {
  const cookie = await signBetaCookie("tester@example.com", SECRET);
  const { context, calls } = makeMiddlewareContext({ path: "/about.html", cookie });
  const res = await middleware.onRequest(context);
  assert.equal(calls.next, 1);
  assert.equal(calls.assetsFetch.length, 0);
  assert.equal(await res.text(), "old page");
});

test("middleware: a mapped path with no BETA_COOKIE_SECRET configured falls through (fails closed)", async () => {
  const { context, calls } = makeMiddlewareContext({ path: "/", secret: null });
  await middleware.onRequest(context);
  assert.equal(calls.next, 1);
  assert.equal(calls.assetsFetch.length, 0);
});

test("middleware: a mapped path with no cookie falls through to the old flow", async () => {
  const { context, calls } = makeMiddlewareContext({ path: "/" });
  await middleware.onRequest(context);
  assert.equal(calls.next, 1);
  assert.equal(calls.assetsFetch.length, 0);
});

test("middleware: a mapped path with an invalid/garbage cookie falls through to the old flow", async () => {
  const { context, calls } = makeMiddlewareContext({ path: "/", cookie: "not-a-valid-cookie" });
  await middleware.onRequest(context);
  assert.equal(calls.next, 1);
  assert.equal(calls.assetsFetch.length, 0);
});

test("middleware: a mapped path with a cookie signed by the WRONG secret falls through (tamper-proof)", async () => {
  const cookie = await signBetaCookie("tester@example.com", "a-completely-different-secret");
  const { context, calls } = makeMiddlewareContext({ path: "/", cookie });
  await middleware.onRequest(context);
  assert.equal(calls.next, 1);
  assert.equal(calls.assetsFetch.length, 0);
});

test("middleware: an eligible tester hitting / is routed to /v2/index.html, next() never called", async () => {
  const cookie = await signBetaCookie("tester@example.com", SECRET);
  const { context, calls } = makeMiddlewareContext({ path: "/", cookie });
  const res = await middleware.onRequest(context);
  assert.equal(calls.next, 0);
  assert.equal(calls.assetsFetch.length, 1);
  assert.match(calls.assetsFetch[0], /\/v2\/index\.html$/);
  assert.equal(await res.text(), "v2 page");
});

for (const [oldPath, newPath] of [
  ["/index.html", "/v2/index.html"],
  ["/our-giving.html", "/v2/our-giving.html"],
  ["/events.html", "/v2/events.html"],
  ["/give-flow.html", "/v2/give-flow.html"],
  ["/my-giving.html", "/v2/my-giving.html"]
]) {
  test(`middleware: eligible tester hitting ${oldPath} is routed to ${newPath}`, async () => {
    const cookie = await signBetaCookie("tester@example.com", SECRET);
    const { context, calls } = makeMiddlewareContext({ path: oldPath, cookie });
    await middleware.onRequest(context);
    assert.equal(calls.assetsFetch.length, 1);
    assert.ok(calls.assetsFetch[0].endsWith(newPath), calls.assetsFetch[0]);
  });
}

test("middleware: query string is preserved when routing to the v2 build", async () => {
  const cookie = await signBetaCookie("tester@example.com", SECRET);
  const { context, calls } = makeMiddlewareContext({ path: "/our-giving.html", search: "?fund=tech-contributions", cookie });
  await middleware.onRequest(context);
  assert.match(calls.assetsFetch[0], /\?fund=tech-contributions$/);
});

test("middleware: never touches /api/* paths even with a valid cookie", async () => {
  const cookie = await signBetaCookie("tester@example.com", SECRET);
  const { context, calls } = makeMiddlewareContext({ path: "/api/contributions", cookie });
  await middleware.onRequest(context);
  assert.equal(calls.next, 1);
  assert.equal(calls.assetsFetch.length, 0);
});

test("middleware: never touches /admin.html even with a valid cookie", async () => {
  const cookie = await signBetaCookie("tester@example.com", SECRET);
  const { context, calls } = makeMiddlewareContext({ path: "/admin.html", cookie });
  await middleware.onRequest(context);
  assert.equal(calls.next, 1);
  assert.equal(calls.assetsFetch.length, 0);
});
