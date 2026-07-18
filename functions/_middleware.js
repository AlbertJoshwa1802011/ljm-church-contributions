// Cloudflare Pages Function: global middleware.
// Routes eligible beta testers (see docs/milestone-v2/11-v2-flow-implementation.md)
// to the new "v2" flow for a small set of pages, while everyone else — and
// every request to any other path — gets exactly what they get today,
// completely unmodified. This file is the ONLY thing that makes that
// decision; index.html/script.js/every other existing file is untouched.

import { verifyBetaCookie, parseCookies, BETA_COOKIE_NAME } from "./api/_beta.js";

// Old path → new build's matching file under /v2/. Only these exact paths
// are ever intercepted; everything else (all /api/*, /admin.html, every
// other existing page, every static asset) falls through to next().
const ROUTE_MAP = {
  "/": "/v2/index.html",
  "/index.html": "/v2/index.html",
  "/our-giving.html": "/v2/our-giving.html",
  "/events.html": "/v2/events.html",
  "/give-flow.html": "/v2/give-flow.html",
  "/my-giving.html": "/v2/my-giving.html"
};

export async function onRequest(context) {
  const { request, env, next } = context;
  const url = new URL(request.url);
  const target = ROUTE_MAP[url.pathname];

  if (!target || !env.BETA_COOKIE_SECRET) {
    return next();
  }

  const cookies = parseCookies(request.headers.get("Cookie"));
  const email = await verifyBetaCookie(cookies[BETA_COOKIE_NAME], env.BETA_COOKIE_SECRET);

  if (!email) {
    return next(); // not an active beta session — old flow, unmodified
  }

  const v2Url = new URL(target, url);
  v2Url.search = url.search;
  return env.ASSETS.fetch(new Request(v2Url, request));
}
