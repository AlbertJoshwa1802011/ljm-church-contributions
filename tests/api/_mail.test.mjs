import { test } from "node:test";
import assert from "node:assert/strict";
import { sendMail, notifyTeam } from "../../functions/api/_mail.js";

test("_mail: sendMail is a no-op (never throws, no network) when RESEND_API_KEY is unset", async () => {
  const result = await sendMail({ env: {}, to: "a@b.com", subject: "Hi", text: "Hello" });
  assert.equal(result.sent, false);
  assert.match(result.reason, /RESEND_API_KEY/);
});

test("_mail: sendMail validates required fields before touching the network", async () => {
  const result = await sendMail({ env: { RESEND_API_KEY: "test" }, to: "", subject: "", text: "" });
  assert.equal(result.sent, false);
  assert.match(result.reason, /missing/);
});

test("_mail: sendMail posts to Resend with the configured key when set", async () => {
  const realFetch = globalThis.fetch;
  let capturedUrl, capturedInit;
  globalThis.fetch = async (url, init) => {
    capturedUrl = url;
    capturedInit = init;
    return { ok: true, status: 200 };
  };
  try {
    const result = await sendMail({
      env: { RESEND_API_KEY: "test-key" },
      to: "person@example.com", subject: "Thanks", text: "We got your message"
    });
    assert.equal(result.sent, true);
    assert.equal(capturedUrl, "https://api.resend.com/emails");
    assert.equal(capturedInit.headers.Authorization, "Bearer test-key");
    const body = JSON.parse(capturedInit.body);
    assert.deepEqual(body.to, ["person@example.com"]);
    assert.equal(body.subject, "Thanks");
  } finally {
    globalThis.fetch = realFetch;
  }
});

test("_mail: sendMail reports failure (never throws) on a non-OK Resend response", async () => {
  const realFetch = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: false, status: 422 });
  try {
    const result = await sendMail({
      env: { RESEND_API_KEY: "test-key" },
      to: "person@example.com", subject: "Thanks", text: "We got your message"
    });
    assert.equal(result.sent, false);
    assert.match(result.reason, /422/);
  } finally {
    globalThis.fetch = realFetch;
  }
});

test("_mail: sendMail reports failure (never throws) when fetch itself rejects", async () => {
  const realFetch = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error("network down"); };
  try {
    const result = await sendMail({
      env: { RESEND_API_KEY: "test-key" },
      to: "person@example.com", subject: "Thanks", text: "We got your message"
    });
    assert.equal(result.sent, false);
    assert.match(result.reason, /network down/);
  } finally {
    globalThis.fetch = realFetch;
  }
});

test("_mail: notifyTeam is a no-op when TEAM_NOTIFY_EMAIL is unset", async () => {
  const result = await notifyTeam({ env: { RESEND_API_KEY: "test-key" }, subject: "New request", text: "..." });
  assert.equal(result.sent, false);
  assert.match(result.reason, /TEAM_NOTIFY_EMAIL/);
});

test("_mail: notifyTeam sends to the configured team address", async () => {
  const realFetch = globalThis.fetch;
  let capturedInit;
  globalThis.fetch = async (url, init) => { capturedInit = init; return { ok: true, status: 200 }; };
  try {
    const result = await notifyTeam({
      env: { RESEND_API_KEY: "test-key", TEAM_NOTIFY_EMAIL: "team@ljm.org" },
      subject: "New prayer request", text: "Someone needs prayer"
    });
    assert.equal(result.sent, true);
    const body = JSON.parse(capturedInit.body);
    assert.deepEqual(body.to, ["team@ljm.org"]);
  } finally {
    globalThis.fetch = realFetch;
  }
});
