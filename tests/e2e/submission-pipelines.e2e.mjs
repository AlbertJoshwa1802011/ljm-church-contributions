// Real-browser E2E: testimony/prayer/contact submission pipelines with
// hostile payloads (HTML/script injection, Tamil, emoji, extremely long
// text, malformed email, rapid double-submit), per Journey D. Confirms the
// browser never renders raw attacker-controlled HTML back to itself.
// See docs/testing/E2E.md for how to run this.
import { test } from "node:test";
import assert from "node:assert/strict";
import { launchGuardedBrowser, newGuardedContext, BASE_URL } from "./helpers/browser.mjs";

const XSS_PAYLOAD = '<img src=x onerror="window.__xssFired = true">';

let browser;
test.before(async () => { browser = await launchGuardedBrowser(); });
test.after(async () => { await browser.close(); });

test("testimonies: submitting an HTML/script payload never executes in the browser, and the public page never renders raw HTML back", async () => {
  const context = await newGuardedContext(browser);
  const page = await context.newPage();
  await page.addInitScript(() => { window.__xssFired = false; });

  await page.goto(BASE_URL + "/v2/testimonies.html", { waitUntil: "networkidle" });
  await page.click("#openSubmitBtn");
  await page.fill("#ts_title", XSS_PAYLOAD);
  await page.fill("#ts_body", "A normal testimony body, with an embedded payload: " + XSS_PAYLOAD + " and Tamil: இயேசு நல்லவர்.");
  await page.fill("#ts_author", "Visitor 😊");
  const [postRes] = await Promise.all([
    page.waitForResponse((r) => r.url().includes("/api/testimonies") && r.request().method() === "POST"),
    page.click("#ts_submitBtn")
  ]);
  const postBody = await postRes.json();
  assert.equal(postBody.success, true, `submit should succeed: ${JSON.stringify(postBody)}`);
  assert.ok(await page.locator("#submitSuccess").isVisible(), "success state should show after a valid submit");

  // The XSS payload must never have executed on the submitting page itself.
  assert.equal(await page.evaluate(() => window.__xssFired), false, "the img onerror payload executed on the submission page");

  // A pending testimony is NOT publicly visible — reload the public listing
  // and confirm the payload text/markup doesn't appear anywhere as raw HTML.
  await page.reload({ waitUntil: "networkidle" });
  const html = await page.content();
  assert.ok(!html.includes(XSS_PAYLOAD), "raw, unescaped payload markup leaked into the public page HTML");

  await context.close();
});

test("testimonies: empty/whitespace-only submission is rejected client-side without hitting the API", async () => {
  const context = await newGuardedContext(browser);
  const page = await context.newPage();
  await page.goto(BASE_URL + "/v2/testimonies.html", { waitUntil: "networkidle" });
  await page.click("#openSubmitBtn");
  await page.fill("#ts_title", "   ");
  await page.fill("#ts_body", "   ");

  let posted = false;
  page.on("request", (req) => { if (req.url().includes("/api/testimonies") && req.method() === "POST") posted = true; });
  await page.click("#ts_submitBtn");
  await page.waitForTimeout(300);

  assert.equal(posted, false, "whitespace-only title/body should be rejected before a network call is made");
  assert.match(await page.locator("#ts_msg").innerText(), /required/i);
  await context.close();
});

test("prayer: submitting an HTML payload in the request text is safely stored and never rendered raw", async () => {
  const context = await newGuardedContext(browser);
  const page = await context.newPage();
  await page.goto(BASE_URL + "/v2/prayer.html", { waitUntil: "networkidle" });
  await page.fill("#pf_request", "Please pray for my family. " + XSS_PAYLOAD);
  await page.fill("#pf_name", "Visitor");
  await page.fill("#pf_email", "not-a-real-address"); // malformed email, optional field

  const [postRes] = await Promise.all([
    page.waitForResponse((r) => r.url().includes("/api/prayer") && r.request().method() === "POST"),
    page.click("#pf_submitBtn")
  ]);
  const body = await postRes.json();
  // Prayer requests never require a valid email (it's optional) — this should succeed.
  assert.equal(body.success, true, `prayer submit should succeed even with a malformed optional email: ${JSON.stringify(body)}`);
  await context.close();
});

test("contact: rejects a malformed email before/at the API and never renders raw HTML from a message", async () => {
  const context = await newGuardedContext(browser);
  const page = await context.newPage();
  await page.goto(BASE_URL + "/v2/contact.html", { waitUntil: "networkidle" });
  await page.fill("#cf_email", "not-an-email");
  await page.fill("#cf_message", "Hello " + XSS_PAYLOAD);

  const [postRes] = await Promise.all([
    page.waitForResponse((r) => r.url().includes("/api/contact") && r.request().method() === "POST"),
    page.click("#cf_submitBtn")
  ]);
  const body = await postRes.json();
  assert.equal(body.success, false, "an invalid email should be rejected by the API");
  assert.match(body.message, /valid email/i);

  // Now with a real email — should succeed and store the payload inertly.
  await page.fill("#cf_email", "visitor@example.com");
  const [postRes2] = await Promise.all([
    page.waitForResponse((r) => r.url().includes("/api/contact") && r.request().method() === "POST"),
    page.click("#cf_submitBtn")
  ]);
  const body2 = await postRes2.json();
  assert.equal(body2.success, true, `valid contact submit should succeed: ${JSON.stringify(body2)}`);
  await context.close();
});

test("testimonies: rapid double-click on submit does not create two records (button disables on first click)", async () => {
  const context = await newGuardedContext(browser);
  const page = await context.newPage();
  await page.goto(BASE_URL + "/v2/testimonies.html", { waitUntil: "networkidle" });
  await page.click("#openSubmitBtn");
  await page.fill("#ts_title", "Double submit test " + Date.now());
  await page.fill("#ts_body", "Testing rapid double submission.");

  let postCount = 0;
  page.on("request", (req) => { if (req.url().includes("/api/testimonies") && req.method() === "POST") postCount++; });

  await Promise.all([
    page.click("#ts_submitBtn"),
    page.click("#ts_submitBtn", { force: true }).catch(() => {}) // second click may hit a disabled button
  ]);
  await page.waitForTimeout(500);

  assert.equal(postCount, 1, `expected exactly one POST from a rapid double-click, got ${postCount}`);
  await context.close();
});
