// Cloudflare Pages Function: /api/programs
// Service times & recurring programs, per church (PRD §7.8).
//
//   GET    /api/programs           → public: active programs (?church=slug, ?ministryArea=)
//          /api/programs?all=1     → admin (manage_content): every status
//   POST   /api/programs           → admin: create
//   PUT    /api/programs           → admin: update (body.id)
//   DELETE /api/programs?id=NN     → admin: delete
//
// Recurrence model (kept intentionally simple — a rule, not generated rows):
//   'daily'   — every day. day_of_week/month_ordinal unused.
//   'weekly'  — every week on day_of_week (0=Sun..6=Sat).
//   'monthly' — the month_ordinal-th (1-5) day_of_week of every month, e.g.
//               month_ordinal=2, day_of_week=5 => "second Friday of every month".
//   'once'    — a one-off/other program; day_of_week/month_ordinal unused.
// scheduleLabelEn/Ta below are a pure function of these fields, so they are
// deterministic and safe to compute on every read.

import { requireAuth, audit, json } from "./_lib.js";

function corsHeaders(extra) {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    ...(extra || {})
  };
}

const RECURRENCES = ["daily", "weekly", "monthly", "once"];
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

const DAY_EN = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const DAY_TA = ["ஞாயிற்றுக்கிழமை", "திங்கட்கிழமை", "செவ்வாய்க்கிழமை", "புதன்கிழமை", "வியாழக்கிழமை", "வெள்ளிக்கிழமை", "சனிக்கிழமை"];
const ORDINAL_EN = ["", "First", "Second", "Third", "Fourth", "Fifth"];
const ORDINAL_TA = ["", "முதல்", "இரண்டாம்", "மூன்றாம்", "நான்காம்", "ஐந்தாம்"];

function formatTime12h(hhmm) {
  if (!hhmm || !TIME_RE.test(hhmm)) return null;
  const [h, m] = hhmm.split(":").map(Number);
  const period = h < 12 ? "AM" : "PM";
  let h12 = h % 12;
  if (h12 === 0) h12 = 12;
  return `${h12}:${String(m).padStart(2, "0")} ${period}`;
}

function timeRange(startTime, endTime) {
  const s = formatTime12h(startTime);
  const e = formatTime12h(endTime);
  if (s && e) return `${s} – ${e}`;
  return s;
}

function buildScheduleLabel(row, lang) {
  const isTa = lang === "ta";
  const range = timeRange(row.start_time, row.end_time);

  let base = null;
  if (row.recurrence === "daily") {
    base = isTa ? "தினமும்" : "Every day";
  } else if (row.recurrence === "weekly" && row.day_of_week !== null && row.day_of_week !== undefined) {
    const day = (isTa ? DAY_TA : DAY_EN)[row.day_of_week];
    base = isTa ? `${day} தோறும்` : `Every ${day}`;
  } else if (row.recurrence === "monthly" && row.day_of_week !== null && row.day_of_week !== undefined
             && row.month_ordinal !== null && row.month_ordinal !== undefined && ORDINAL_EN[row.month_ordinal]) {
    const day = (isTa ? DAY_TA : DAY_EN)[row.day_of_week];
    const ordinal = (isTa ? ORDINAL_TA : ORDINAL_EN)[row.month_ordinal];
    base = isTa ? `மாதந்தோறும் ${ordinal} ${day}` : `${ordinal} ${day} of every month`;
  } else if (row.recurrence === "once") {
    base = isTa ? "ஒரு முறை" : "One-off";
  }

  if (!base) return null;
  return range ? `${base} · ${range}` : base;
}

function toProgram(row) {
  return {
    id: row.id,
    titleEn: row.title_en,
    titleTa: row.title_ta,
    descriptionEn: row.description_en,
    descriptionTa: row.description_ta,
    churchId: row.church_id,
    churchSlug: row.church_slug || undefined,
    churchNameEn: row.church_name_en || undefined,
    ministryArea: row.ministry_area,
    dayOfWeek: row.day_of_week,
    monthOrdinal: row.month_ordinal,
    startTime: row.start_time,
    endTime: row.end_time,
    recurrence: row.recurrence,
    location: row.location,
    meetingUrl: row.meeting_url || undefined,
    status: row.status,
    sortOrder: row.sort_order,
    scheduleLabelEn: buildScheduleLabel(row, "en"),
    scheduleLabelTa: buildScheduleLabel(row, "ta")
  };
}

function parseDayOfWeek(v) {
  if (v === undefined || v === null || v === "") return { ok: true, value: null };
  const n = Number(v);
  if (!Number.isInteger(n) || n < 0 || n > 6) return { ok: false };
  return { ok: true, value: n };
}

function parseMonthOrdinal(v) {
  if (v === undefined || v === null || v === "") return { ok: true, value: null };
  const n = Number(v);
  if (!Number.isInteger(n) || n < 1 || n > 5) return { ok: false };
  return { ok: true, value: n };
}

function parseTime(v) {
  if (v === undefined || v === null || v === "") return { ok: true, value: null };
  if (!TIME_RE.test(v)) return { ok: false };
  return { ok: true, value: v };
}

// Online join URL (e.g. Google Meet). https:// only — never http:// or any
// other scheme (javascript:, data:, etc.) — so the "Join Online" CTA can
// never be turned into an XSS/open-redirect vector via admin input.
function parseMeetingUrl(v) {
  if (v === undefined || v === null || String(v).trim() === "") return { ok: true, value: null };
  const s = String(v).trim();
  let u;
  try {
    u = new URL(s);
  } catch (_err) {
    return { ok: false };
  }
  if (u.protocol !== "https:") return { ok: false };
  return { ok: true, value: s };
}

function validateProgramBody(body) {
  const recurrence = body.recurrence || "weekly";
  if (!RECURRENCES.includes(recurrence)) {
    return { ok: false, message: `recurrence must be one of: ${RECURRENCES.join(", ")}` };
  }

  const dow = parseDayOfWeek(body.dayOfWeek);
  if (!dow.ok) return { ok: false, message: "dayOfWeek must be 0-6 (Sunday-Saturday)" };

  const ord = parseMonthOrdinal(body.monthOrdinal);
  if (!ord.ok) return { ok: false, message: "monthOrdinal must be 1-5" };

  // dayOfWeek/monthOrdinal are optional even for 'weekly'/'monthly' — a blank
  // dayOfWeek has always meant "one-off/other" (see the day_of_week column
  // comment in schema.sql), and the admin form allows leaving it blank. When
  // present they're used to build scheduleLabel (e.g. "second Friday of
  // every month" needs both monthOrdinal and dayOfWeek set).

  const start = parseTime(body.startTime);
  if (!start.ok) return { ok: false, message: "startTime must be in HH:MM 24-hour format" };
  const end = parseTime(body.endTime);
  if (!end.ok) return { ok: false, message: "endTime must be in HH:MM 24-hour format" };

  const meet = parseMeetingUrl(body.meetingUrl);
  if (!meet.ok) return { ok: false, message: "meetingUrl must be a valid https:// URL" };

  return {
    ok: true,
    recurrence,
    dayOfWeek: dow.value,
    monthOrdinal: ord.value,
    startTime: start.value,
    endTime: end.value,
    meetingUrl: meet.value
  };
}

export async function onRequestGet(context) {
  const { env, request } = context;
  const db = env.DB;
  if (!db) return json({ error: "D1 database binding missing" }, 500);

  const url = new URL(request.url);
  const wantsAll = url.searchParams.get("all") === "1";
  const churchSlug = url.searchParams.get("church");
  const ministryArea = url.searchParams.get("ministryArea");

  try {
    if (wantsAll) {
      const auth = await requireAuth(context, "manage_content");
      if (!auth.ok) return auth.response;
      const q = await db.prepare(
        `SELECT p.*, c.slug AS church_slug, c.name_en AS church_name_en
         FROM programs p LEFT JOIN churches c ON c.id = p.church_id
         ORDER BY p.sort_order ASC, p.day_of_week ASC, p.id ASC`
      ).all();
      return json({ success: true, programs: (q.results || []).map(toProgram) }, 200, corsHeaders({ "Cache-Control": "no-store" }));
    }

    const conditions = ["p.status = 'active'"];
    const args = [];
    if (churchSlug) { conditions.push("c.slug = ?"); args.push(churchSlug); }
    if (ministryArea) { conditions.push("p.ministry_area = ?"); args.push(ministryArea); }

    const q = await db.prepare(
      `SELECT p.*, c.slug AS church_slug, c.name_en AS church_name_en
       FROM programs p LEFT JOIN churches c ON c.id = p.church_id
       WHERE ${conditions.join(" AND ")}
       ORDER BY p.sort_order ASC, p.day_of_week ASC, p.id ASC`
    ).bind(...args).all();

    return json({ success: true, programs: (q.results || []).map(toProgram) }, 200, corsHeaders({ "Cache-Control": "public, max-age=120" }));
  } catch (err) {
    return json({ success: false, message: err.message }, 500);
  }
}

export async function onRequestPost(context) {
  const { env, request } = context;
  const db = env.DB;
  if (!db) return json({ error: "D1 database binding missing" }, 500);

  const auth = await requireAuth(context, "manage_content");
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json();
    const titleEn = String(body.titleEn || "").trim();
    if (!titleEn) return json({ success: false, message: "titleEn is required" }, 400);

    const v = validateProgramBody(body);
    if (!v.ok) return json({ success: false, message: v.message }, 400);

    const res = await db.prepare(
      `INSERT INTO programs (title_en, title_ta, description_en, description_ta, church_id, ministry_area, day_of_week, month_ordinal, start_time, end_time, recurrence, location, meeting_url, status, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      titleEn, body.titleTa || null, body.descriptionEn || null, body.descriptionTa || null,
      body.churchId ? Number(body.churchId) : null, body.ministryArea || null,
      v.dayOfWeek, v.monthOrdinal, v.startTime, v.endTime, v.recurrence,
      body.location || null, v.meetingUrl, body.status === "inactive" ? "inactive" : "active", Number(body.sortOrder) || 0
    ).run();

    const id = res.meta && res.meta.last_row_id;

    await audit(context, {
      actorEmail: auth.email, actorType: "admin", verified: auth.verified,
      action: "programs.add", entityType: "program", entityId: id, details: { titleEn }
    });

    return json({ success: true, id, message: `Program '${titleEn}' added` }, 200, corsHeaders());
  } catch (err) {
    return json({ success: false, message: err.message }, 500);
  }
}

export async function onRequestPut(context) {
  const { env, request } = context;
  const db = env.DB;
  if (!db) return json({ error: "D1 database binding missing" }, 500);

  const auth = await requireAuth(context, "manage_content");
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json();
    const id = Number(body.id);
    if (!id) return json({ success: false, message: "Program id is required" }, 400);
    const titleEn = String(body.titleEn || "").trim();
    if (!titleEn) return json({ success: false, message: "titleEn is required" }, 400);

    const v = validateProgramBody(body);
    if (!v.ok) return json({ success: false, message: v.message }, 400);

    const res = await db.prepare(
      `UPDATE programs SET title_en=?, title_ta=?, description_en=?, description_ta=?, church_id=?, ministry_area=?, day_of_week=?, month_ordinal=?, start_time=?, end_time=?, recurrence=?, location=?, meeting_url=?, status=?, sort_order=?, updated_at=CURRENT_TIMESTAMP
       WHERE id=?`
    ).bind(
      titleEn, body.titleTa || null, body.descriptionEn || null, body.descriptionTa || null,
      body.churchId ? Number(body.churchId) : null, body.ministryArea || null,
      v.dayOfWeek, v.monthOrdinal, v.startTime, v.endTime, v.recurrence,
      body.location || null, v.meetingUrl, body.status === "inactive" ? "inactive" : "active", Number(body.sortOrder) || 0, id
    ).run();

    if (!res.meta || res.meta.changes === 0) return json({ success: false, message: "Program not found" }, 404);

    await audit(context, {
      actorEmail: auth.email, actorType: "admin", verified: auth.verified,
      action: "programs.update", entityType: "program", entityId: id, details: { titleEn }
    });

    return json({ success: true, message: "Program updated" }, 200, corsHeaders());
  } catch (err) {
    return json({ success: false, message: err.message }, 500);
  }
}

export async function onRequestDelete(context) {
  const { env, request } = context;
  const db = env.DB;
  if (!db) return json({ error: "D1 database binding missing" }, 500);

  const auth = await requireAuth(context, "manage_content");
  if (!auth.ok) return auth.response;

  try {
    const id = Number(new URL(request.url).searchParams.get("id"));
    if (!id) return json({ success: false, message: "Program id is required" }, 400);

    const res = await db.prepare("DELETE FROM programs WHERE id = ?").bind(id).run();
    if (!res.meta || res.meta.changes === 0) return json({ success: false, message: "Program not found" }, 404);

    await audit(context, {
      actorEmail: auth.email, actorType: "admin", verified: auth.verified,
      action: "programs.delete", entityType: "program", entityId: id
    });

    return json({ success: true, message: "Program deleted" }, 200, corsHeaders());
  } catch (err) {
    return json({ success: false, message: err.message }, 500);
  }
}

export async function onRequestOptions() {
  return new Response(null, { headers: corsHeaders() });
}
