import { test } from "node:test";
import assert from "node:assert/strict";
import { freshDb, makeContext } from "../helpers/mock-d1.mjs";
import * as programs from "../../functions/api/programs.js";
import * as churches from "../../functions/api/churches.js";

async function readJson(res) { return JSON.parse(await res.text()); }

// schema.sql seeds the real ministry prayer/service schedule (see
// migrations/0024_seed_prayer_programs.sql), so a freshDb() already has 6
// programs — tests below assert on the specific program they created/looked
// for, not on absolute counts, except where a test explicitly clears the
// slate by filtering to a title it just created.

test("programs: POST requires manage_content; created program shows in public listing joined with church", async () => {
  const db = freshDb();
  const churchList = await readJson(await churches.onRequestGet(makeContext({ db, authToken: null, url: "https://test.local/api/churches" })));
  const churchId = churchList.churches.find(c => c.slug === "church-of-light").id;

  const denied = await readJson(await programs.onRequestPost(makeContext({
    db, authToken: null, method: "POST", url: "https://test.local/api/programs", body: { titleEn: "Sunday Service" }
  })));
  assert.equal(denied.success, false);

  await programs.onRequestPost(makeContext({
    db, method: "POST", url: "https://test.local/api/programs",
    body: { titleEn: "Sunday Service", churchId, recurrence: "weekly", dayOfWeek: 0, startTime: "09:00" }
  }));

  const pub = await readJson(await programs.onRequestGet(makeContext({ db, authToken: null, url: "https://test.local/api/programs" })));
  const created = pub.programs.find(p => p.titleEn === "Sunday Service");
  assert.ok(created, "newly created program should appear in the public listing");
  assert.equal(created.churchSlug, "church-of-light");
});

test("programs: ?church= filters by church slug", async () => {
  const db = freshDb();
  const churchList = await readJson(await churches.onRequestGet(makeContext({ db, authToken: null, url: "https://test.local/api/churches" })));
  const light = churchList.churches.find(c => c.slug === "church-of-light").id;
  const city = churchList.churches.find(c => c.slug === "city-worship-center").id;

  await programs.onRequestPost(makeContext({ db, method: "POST", url: "https://test.local/api/programs", body: { titleEn: "Light Service", churchId: light } }));
  await programs.onRequestPost(makeContext({ db, method: "POST", url: "https://test.local/api/programs", body: { titleEn: "City Service", churchId: city } }));

  const res = await readJson(await programs.onRequestGet(makeContext({ db, authToken: null, url: "https://test.local/api/programs?church=city-worship-center" })));
  assert.equal(res.programs.length, 1);
  assert.equal(res.programs[0].titleEn, "City Service");
});

test("programs: ?ministryArea= filters (the real prayer schedule is seeded with ministryArea 'prayer'/'service')", async () => {
  const db = freshDb();
  const res = await readJson(await programs.onRequestGet(makeContext({ db, authToken: null, url: "https://test.local/api/programs?ministryArea=prayer" })));
  const titles = res.programs.map(p => p.titleEn).sort();
  assert.deepEqual(titles, ["Daily Morning Prayer", "Daily Night Prayer", "Full Night Prayer", "Youth Prayer"]);
});

test("programs: inactive programs are excluded from the public listing but visible via ?all=1", async () => {
  const db = freshDb();
  const create = await readJson(await programs.onRequestPost(makeContext({
    db, method: "POST", url: "https://test.local/api/programs", body: { titleEn: "Youth Night" }
  })));
  await programs.onRequestPut(makeContext({
    db, method: "PUT", url: "https://test.local/api/programs", body: { id: create.id, titleEn: "Youth Night", status: "inactive" }
  }));

  const pub = await readJson(await programs.onRequestGet(makeContext({ db, authToken: null, url: "https://test.local/api/programs" })));
  assert.equal(pub.programs.find(p => p.titleEn === "Youth Night"), undefined);

  const all = await readJson(await programs.onRequestGet(makeContext({ db, url: "https://test.local/api/programs?all=1" })));
  assert.ok(all.programs.find(p => p.titleEn === "Youth Night" && p.status === "inactive"));
});

// Regression: the public Programs page (v2/programs.html) renders
// DAYS[dayOfWeek] from a fixed 7-entry array with no bounds check. An
// out-of-range dayOfWeek stored via the API (previously accepted with no
// validation at all) makes that array index undefined and throws inside the
// page's render loop — breaking the ENTIRE public programs list for every
// visitor, not just the one bad row.
test("programs: POST rejects an out-of-range dayOfWeek instead of storing it", async () => {
  const db = freshDb();
  for (const bad of [999, -1, 7, 3.5, NaN]) {
    const res = await readJson(await programs.onRequestPost(makeContext({
      db, method: "POST", url: "https://test.local/api/programs",
      body: { titleEn: "Bad Day", dayOfWeek: bad }
    })));
    assert.equal(res.success, false, `dayOfWeek=${bad} must be rejected`);
  }
  const all = await readJson(await programs.onRequestGet(makeContext({ db, url: "https://test.local/api/programs?all=1" })));
  assert.equal(all.programs.find(p => p.titleEn === "Bad Day"), undefined, "no 'Bad Day' program should have been created with an invalid dayOfWeek");
});

test("programs: POST accepts every in-range dayOfWeek (0-6) and null/omitted for one-off programs", async () => {
  const db = freshDb();
  for (const good of [0, 1, 6]) {
    const res = await readJson(await programs.onRequestPost(makeContext({
      db, method: "POST", url: "https://test.local/api/programs",
      body: { titleEn: `Day ${good}`, dayOfWeek: good }
    })));
    assert.equal(res.success, true, res.message);
  }
  const omitted = await readJson(await programs.onRequestPost(makeContext({
    db, method: "POST", url: "https://test.local/api/programs", body: { titleEn: "One-off" }
  })));
  assert.equal(omitted.success, true, omitted.message);
  const all = await readJson(await programs.onRequestGet(makeContext({ db, url: "https://test.local/api/programs?all=1" })));
  assert.equal(all.programs.find(p => p.titleEn === "One-off").dayOfWeek, null);
});

test("programs: PUT rejects an out-of-range dayOfWeek", async () => {
  const db = freshDb();
  const create = await readJson(await programs.onRequestPost(makeContext({
    db, method: "POST", url: "https://test.local/api/programs", body: { titleEn: "X", dayOfWeek: 2 }
  })));
  const res = await readJson(await programs.onRequestPut(makeContext({
    db, method: "PUT", url: "https://test.local/api/programs",
    body: { id: create.id, titleEn: "X", dayOfWeek: 999 }
  })));
  assert.equal(res.success, false);

  const all = await readJson(await programs.onRequestGet(makeContext({ db, url: "https://test.local/api/programs?all=1" })));
  assert.equal(all.programs.find(p => p.id === create.id).dayOfWeek, 2, "the original valid value must be untouched by the rejected update");
});

test("programs: PUT/DELETE on a nonexistent id is a 404", async () => {
  const db = freshDb();
  const putRes = await readJson(await programs.onRequestPut(makeContext({
    db, method: "PUT", url: "https://test.local/api/programs", body: { id: 999999, titleEn: "X" }
  })));
  assert.equal(putRes.success, false);

  const delRes = await readJson(await programs.onRequestDelete(makeContext({
    db, method: "DELETE", url: "https://test.local/api/programs?id=999999"
  })));
  assert.equal(delRes.success, false);
});

test("programs: POST/PUT reject an out-of-range dayOfWeek (regression: 7/99/-1 crashed v2/programs.html's DAYS[] lookup)", async () => {
  const db = freshDb();
  for (const bad of [7, 99, -1, 1.5]) {
    const res = await readJson(await programs.onRequestPost(makeContext({
      db, method: "POST", url: "https://test.local/api/programs", body: { titleEn: "Bad Day", dayOfWeek: bad }
    })));
    assert.equal(res.success, false, `dayOfWeek=${bad} should be rejected`);
  }

  const create = await readJson(await programs.onRequestPost(makeContext({
    db, method: "POST", url: "https://test.local/api/programs", body: { titleEn: "Sunday Service", dayOfWeek: 0 }
  })));
  assert.equal(create.success, true);

  const putRes = await readJson(await programs.onRequestPut(makeContext({
    db, method: "PUT", url: "https://test.local/api/programs", body: { id: create.id, titleEn: "Sunday Service", dayOfWeek: 99 }
  })));
  assert.equal(putRes.success, false);
});

test("programs: POST/PUT accept a null/empty dayOfWeek (one-off programs) and valid 0-6", async () => {
  const db = freshDb();
  const create = await readJson(await programs.onRequestPost(makeContext({
    db, method: "POST", url: "https://test.local/api/programs", body: { titleEn: "Full Night Prayer", dayOfWeek: null, recurrence: "once" }
  })));
  assert.equal(create.success, true);

  const six = await readJson(await programs.onRequestPost(makeContext({
    db, method: "POST", url: "https://test.local/api/programs", body: { titleEn: "Saturday Service", dayOfWeek: 6 }
  })));
  assert.equal(six.success, true);

  const all = await readJson(await programs.onRequestGet(makeContext({ db, url: "https://test.local/api/programs?all=1" })));
  const saved = all.programs.find(p => p.titleEn === "Full Night Prayer");
  assert.equal(saved.dayOfWeek, null);
});

test("programs: DELETE requires manage_content", async () => {
  const db = freshDb();
  const create = await readJson(await programs.onRequestPost(makeContext({
    db, method: "POST", url: "https://test.local/api/programs", body: { titleEn: "X" }
  })));
  const denied = await readJson(await programs.onRequestDelete(makeContext({
    db, authToken: null, method: "DELETE", url: `https://test.local/api/programs?id=${create.id}`
  })));
  assert.equal(denied.success, false);
});

test("programs: PUT requires manage_content", async () => {
  const db = freshDb();
  const create = await readJson(await programs.onRequestPost(makeContext({
    db, method: "POST", url: "https://test.local/api/programs", body: { titleEn: "X" }
  })));
  const denied = await readJson(await programs.onRequestPut(makeContext({
    db, authToken: null, method: "PUT", url: "https://test.local/api/programs", body: { id: create.id, titleEn: "Y" }
  })));
  assert.equal(denied.success, false);

  const all = await readJson(await programs.onRequestGet(makeContext({ db, url: "https://test.local/api/programs?all=1" })));
  assert.equal(all.programs.find(p => p.id === create.id).titleEn, "X", "denied PUT must not have changed the row");
});

test("programs: ?all=1 (admin listing) requires manage_content", async () => {
  const db = freshDb();
  const denied = await readJson(await programs.onRequestGet(makeContext({
    db, authToken: null, url: "https://test.local/api/programs?all=1"
  })));
  assert.equal(denied.success, false);
});

// ── Recurrence validation ──────────────────────────────────────────────

test("programs: weekly recurrence with no dayOfWeek is accepted (blank = one-off/other, matches the admin form)", async () => {
  const db = freshDb();
  const res = await readJson(await programs.onRequestPost(makeContext({
    db, method: "POST", url: "https://test.local/api/programs", body: { titleEn: "X", recurrence: "weekly" }
  })));
  assert.equal(res.success, true);
});

test("programs: monthly + ordinal + weekday builds the second-Friday / second-Sunday label", async () => {
  const db = freshDb();
  const missingOrdinal = await readJson(await programs.onRequestPost(makeContext({
    db, method: "POST", url: "https://test.local/api/programs", body: { titleEn: "Full Night No Ordinal", recurrence: "monthly", dayOfWeek: 5 }
  })));
  assert.equal(missingOrdinal.success, true);
  const pubNoOrdinal = await readJson(await programs.onRequestGet(makeContext({ db, authToken: null, url: "https://test.local/api/programs" })));
  assert.equal(pubNoOrdinal.programs.find(p => p.titleEn === "Full Night No Ordinal").scheduleLabelEn, null);

  const secondFriday = await readJson(await programs.onRequestPost(makeContext({
    db, method: "POST", url: "https://test.local/api/programs",
    body: { titleEn: "Full Night Prayer Test", recurrence: "monthly", dayOfWeek: 5, monthOrdinal: 2 }
  })));
  assert.equal(secondFriday.success, true);

  const pub = await readJson(await programs.onRequestGet(makeContext({ db, authToken: null, url: "https://test.local/api/programs" })));
  const row = pub.programs.find(p => p.titleEn === "Full Night Prayer Test");
  assert.equal(row.scheduleLabelEn, "Second Friday of every month");

  const secondSunday = await readJson(await programs.onRequestPost(makeContext({
    db, method: "POST", url: "https://test.local/api/programs",
    body: { titleEn: "Youth Prayer Test", recurrence: "monthly", dayOfWeek: 0, monthOrdinal: 2, startTime: "16:00", endTime: "17:30" }
  })));
  assert.equal(secondSunday.success, true);
  const pub2 = await readJson(await programs.onRequestGet(makeContext({ db, authToken: null, url: "https://test.local/api/programs" })));
  const row2 = pub2.programs.find(p => p.titleEn === "Youth Prayer Test");
  assert.equal(row2.scheduleLabelEn, "Second Sunday of every month · 4:00 PM – 5:30 PM");
});

test("programs: daily recurrence needs no dayOfWeek/monthOrdinal", async () => {
  const db = freshDb();
  const res = await readJson(await programs.onRequestPost(makeContext({
    db, method: "POST", url: "https://test.local/api/programs",
    body: { titleEn: "Daily Test", recurrence: "daily", startTime: "05:00", endTime: "06:00" }
  })));
  assert.equal(res.success, true);
  const pub = await readJson(await programs.onRequestGet(makeContext({ db, authToken: null, url: "https://test.local/api/programs" })));
  const row = pub.programs.find(p => p.titleEn === "Daily Test");
  assert.equal(row.scheduleLabelEn, "Every day · 5:00 AM – 6:00 AM");
});

test("programs: invalid recurrence value is rejected", async () => {
  const db = freshDb();
  const res = await readJson(await programs.onRequestPost(makeContext({
    db, method: "POST", url: "https://test.local/api/programs", body: { titleEn: "X", recurrence: "fortnightly" }
  })));
  assert.equal(res.success, false);
});

test("programs: invalid dayOfWeek / monthOrdinal are rejected", async () => {
  const db = freshDb();
  const badDay = await readJson(await programs.onRequestPost(makeContext({
    db, method: "POST", url: "https://test.local/api/programs", body: { titleEn: "X", recurrence: "weekly", dayOfWeek: 9 }
  })));
  assert.equal(badDay.success, false);

  const badOrdinal = await readJson(await programs.onRequestPost(makeContext({
    db, method: "POST", url: "https://test.local/api/programs", body: { titleEn: "X", recurrence: "monthly", dayOfWeek: 5, monthOrdinal: 9 }
  })));
  assert.equal(badOrdinal.success, false);
});

test("programs: invalid time format is rejected", async () => {
  const db = freshDb();
  const res = await readJson(await programs.onRequestPost(makeContext({
    db, method: "POST", url: "https://test.local/api/programs", body: { titleEn: "X", startTime: "9pm" }
  })));
  assert.equal(res.success, false);
  assert.match(res.message, /startTime/);
});

// ── Google Meet / online URL ───────────────────────────────────────────

test("programs: valid https:// meetingUrl is accepted and returned publicly", async () => {
  const db = freshDb();
  const res = await readJson(await programs.onRequestPost(makeContext({
    db, method: "POST", url: "https://test.local/api/programs",
    body: { titleEn: "Online Program", meetingUrl: "https://meet.google.com/abc-defg-hij" }
  })));
  assert.equal(res.success, true);

  const pub = await readJson(await programs.onRequestGet(makeContext({ db, authToken: null, url: "https://test.local/api/programs" })));
  const row = pub.programs.find(p => p.titleEn === "Online Program");
  assert.equal(row.meetingUrl, "https://meet.google.com/abc-defg-hij");
});

test("programs: non-https meetingUrl protocols are rejected", async () => {
  const db = freshDb();
  for (const badUrl of ["http://meet.google.com/abc-defg-hij", "javascript:alert(1)", "not-a-url"]) {
    const res = await readJson(await programs.onRequestPost(makeContext({
      db, method: "POST", url: "https://test.local/api/programs", body: { titleEn: "X " + badUrl, meetingUrl: badUrl }
    })));
    assert.equal(res.success, false, `expected ${badUrl} to be rejected`);
  }
});

test("programs: empty meetingUrl means offline (no CTA data leaks through as empty string)", async () => {
  const db = freshDb();
  const res = await readJson(await programs.onRequestPost(makeContext({
    db, method: "POST", url: "https://test.local/api/programs", body: { titleEn: "Offline Program", meetingUrl: "" }
  })));
  assert.equal(res.success, true);
  const pub = await readJson(await programs.onRequestGet(makeContext({ db, authToken: null, url: "https://test.local/api/programs" })));
  const row = pub.programs.find(p => p.titleEn === "Offline Program");
  assert.equal(row.meetingUrl, undefined);
});

test("programs: the same Google Meet link can be set on two different programs (Morning + Night Prayer)", async () => {
  const db = freshDb();
  const sharedUrl = "https://meet.google.com/shared-link-xyz";
  await programs.onRequestPost(makeContext({
    db, method: "POST", url: "https://test.local/api/programs",
    body: { titleEn: "Morning Prayer Test", recurrence: "daily", meetingUrl: sharedUrl }
  }));
  await programs.onRequestPost(makeContext({
    db, method: "POST", url: "https://test.local/api/programs",
    body: { titleEn: "Night Prayer Test", recurrence: "daily", meetingUrl: sharedUrl }
  }));

  const pub = await readJson(await programs.onRequestGet(makeContext({ db, authToken: null, url: "https://test.local/api/programs" })));
  const morning = pub.programs.find(p => p.titleEn === "Morning Prayer Test");
  const night = pub.programs.find(p => p.titleEn === "Night Prayer Test");
  assert.equal(morning.meetingUrl, sharedUrl);
  assert.equal(night.meetingUrl, sharedUrl);
});

// ── Deterministic schedule labels / no private field leakage ──────────

test("programs: scheduleLabel is deterministic across repeated reads", async () => {
  const db = freshDb();
  const first = await readJson(await programs.onRequestGet(makeContext({ db, authToken: null, url: "https://test.local/api/programs" })));
  const second = await readJson(await programs.onRequestGet(makeContext({ db, authToken: null, url: "https://test.local/api/programs" })));
  assert.deepEqual(
    first.programs.map(p => p.scheduleLabelEn),
    second.programs.map(p => p.scheduleLabelEn)
  );
});

test("programs: public GET response exposes only public program fields", async () => {
  const db = freshDb();
  const pub = await readJson(await programs.onRequestGet(makeContext({ db, authToken: null, url: "https://test.local/api/programs" })));
  const allowedKeys = new Set([
    "id", "titleEn", "titleTa", "descriptionEn", "descriptionTa", "churchId", "churchSlug", "churchNameEn",
    "ministryArea", "dayOfWeek", "monthOrdinal", "startTime", "endTime", "recurrence", "location", "meetingUrl",
    "status", "sortOrder", "scheduleLabelEn", "scheduleLabelTa"
  ]);
  for (const p of pub.programs) {
    for (const key of Object.keys(p)) {
      assert.ok(allowedKeys.has(key), `unexpected field '${key}' leaked in public programs response`);
    }
  }
});

// ── Real ministry schedule seed (schema.sql / migrations/0024) ────────

test("programs: real ministry schedule seed produces the expected human-readable labels", async () => {
  const db = freshDb();
  const pub = await readJson(await programs.onRequestGet(makeContext({ db, authToken: null, url: "https://test.local/api/programs" })));
  const byTitle = Object.fromEntries(pub.programs.map(p => [p.titleEn, p]));

  assert.equal(byTitle["Daily Morning Prayer"].scheduleLabelEn, "Every day · 5:00 AM – 6:00 AM");
  assert.equal(byTitle["Daily Night Prayer"].scheduleLabelEn, "Every day · 9:30 PM – 10:00 PM");
  assert.equal(byTitle["Sunday First Service"].scheduleLabelEn, "Every Sunday · 6:00 AM – 8:30 AM");
  assert.equal(byTitle["Sunday Second Service"].scheduleLabelEn, "Every Sunday · 10:00 AM – 12:00 PM");
  assert.equal(byTitle["Youth Prayer"].scheduleLabelEn, "Second Sunday of every month · 4:00 PM – 5:30 PM");
  assert.equal(byTitle["Full Night Prayer"].scheduleLabelEn, "Second Friday of every month");

  // No meeting URL was invented for the seed — an admin must set the real one.
  assert.equal(byTitle["Daily Morning Prayer"].meetingUrl, undefined);
  assert.equal(byTitle["Daily Night Prayer"].meetingUrl, undefined);
});

test("programs: re-applying the seed (fresh schema load) does not duplicate the real schedule", async () => {
  const db = freshDb();
  const pub = await readJson(await programs.onRequestGet(makeContext({ db, authToken: null, url: "https://test.local/api/programs" })));
  const titleCounts = {};
  for (const p of pub.programs) titleCounts[p.titleEn] = (titleCounts[p.titleEn] || 0) + 1;
  for (const title of ["Daily Morning Prayer", "Daily Night Prayer", "Sunday First Service", "Sunday Second Service", "Youth Prayer", "Full Night Prayer"]) {
    assert.equal(titleCounts[title], 1, `${title} should appear exactly once`);
  }
});

test("programs: malformed JSON body returns 400, not a 500 with a leaked parser error", async () => {
  const db = freshDb();
  const ctx = makeContext({ db, method: "POST", url: "https://test.local/api/programs" });
  ctx.request.json = async () => { throw new SyntaxError("Unexpected token"); };
  const res = await programs.onRequestPost(ctx);
  assert.equal(res.status, 400);
  const body = await readJson(res);
  assert.equal(body.success, false);
});
