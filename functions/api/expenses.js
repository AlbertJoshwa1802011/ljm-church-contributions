// Cloudflare Pages Function: /api/expenses
// Church expense ledger + planning. Pastor/admin manages entries (manage_expenses);
// the public portal reads non-private entries for transparency ("where money goes").
//
//   GET    /api/expenses            → public: non-private expenses + summary
//          /api/expenses?all=1      → admin (manage_expenses): every entry incl. private
//   POST   /api/expenses            → admin: create
//   PUT    /api/expenses            → admin: update (body.id)
//   DELETE /api/expenses?id=NN      → admin: delete

import { requireAuth, audit, json } from "./_lib.js";

const STATUSES = ["planned", "paid", "cancelled"];
const RECURRING = ["none", "monthly", "yearly"];

function corsHeaders(extra) {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    ...(extra || {})
  };
}

// Normalise + validate an incoming expense payload. Returns { ok, value|message }.
function parseExpense(body) {
  const title = String(body.title || "").trim();
  if (!title) return { ok: false, message: "Title is required" };

  const amount = Number(body.amount);
  if (!isFinite(amount) || amount < 0) return { ok: false, message: "Amount must be a non-negative number" };

  const status = STATUSES.includes(body.status) ? body.status : "paid";
  const recurring = RECURRING.includes(body.recurring) ? body.recurring : "none";

  return {
    ok: true,
    value: {
      title: title.substring(0, 200),
      category: String(body.category || "General").trim().substring(0, 60) || "General",
      amount,
      expense_date: String(body.expenseDate || body.expense_date || "").trim().substring(0, 30),
      status,
      recurring,
      fund: String(body.fund || "").trim().substring(0, 60),
      vendor: String(body.vendor || "").trim().substring(0, 120),
      notes: String(body.notes || "").trim().substring(0, 500),
      is_private: body.isPrivate || body.is_private ? 1 : 0
    }
  };
}

function summarise(rows) {
  const summary = { totalPaid: 0, totalPlanned: 0, count: rows.length, byCategory: {} };
  for (const r of rows) {
    const amt = Number(r.amount) || 0;
    if (r.status === "paid") summary.totalPaid += amt;
    else if (r.status === "planned") summary.totalPlanned += amt;
    if (r.status !== "cancelled") {
      const c = r.category || "General";
      summary.byCategory[c] = (summary.byCategory[c] || 0) + (r.status === "paid" ? amt : 0);
    }
  }
  summary.totalPaid = Math.round(summary.totalPaid * 100) / 100;
  summary.totalPlanned = Math.round(summary.totalPlanned * 100) / 100;
  return summary;
}

export async function onRequestGet(context) {
  const { env, request } = context;
  const db = env.DB;
  if (!db) return json({ error: "D1 database binding missing" }, 500);

  const url = new URL(request.url);
  const wantsAll = url.searchParams.get("all") === "1";

  let isAdmin = false;
  if (wantsAll) {
    const auth = await requireAuth(context, "manage_expenses").catch(() => null);
    isAdmin = !!(auth && auth.ok);
    if (!isAdmin) return json({ success: false, message: "Unauthorized: manage_expenses required" }, 401);
  }

  try {
    const where = isAdmin ? "" : "WHERE is_private = 0 AND status != 'cancelled'";
    const q = await db.prepare(
      `SELECT id, title, category, amount, expense_date AS expenseDate, status, recurring,
              fund, vendor, notes, is_private AS isPrivate, created_by AS createdBy, created_at AS createdAt
       FROM expenses ${where}
       ORDER BY (expense_date IS NULL), expense_date DESC, id DESC`
    ).all();
    const expenses = q.results || [];

    return json({ success: true, expenses, summary: summarise(expenses) }, 200,
      corsHeaders({ "Cache-Control": isAdmin ? "no-store" : "public, max-age=20" }));
  } catch (err) {
    return json({ success: false, message: err.message }, 500);
  }
}

export async function onRequestPost(context) {
  const { env, request } = context;
  const db = env.DB;
  if (!db) return json({ error: "D1 database binding missing" }, 500);

  const auth = await requireAuth(context, "manage_expenses");
  if (!auth.ok) return auth.response;

  try {
    const parsed = parseExpense(await request.json());
    if (!parsed.ok) return json({ success: false, message: parsed.message }, 400);
    const e = parsed.value;

    const res = await db.prepare(
      `INSERT INTO expenses (title, category, amount, expense_date, status, recurring, fund, vendor, notes, is_private, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(e.title, e.category, e.amount, e.expense_date, e.status, e.recurring, e.fund, e.vendor, e.notes, e.is_private, auth.email).run();

    const id = res.meta && res.meta.last_row_id;
    await audit(context, {
      actorEmail: auth.email, actorType: "admin", verified: auth.verified,
      action: "expense.add", entityType: "expense", entityId: String(id), details: { title: e.title, amount: e.amount, status: e.status }
    });
    return json({ success: true, message: `Expense '${e.title}' added`, id }, 200, corsHeaders());
  } catch (err) {
    return json({ success: false, message: err.message }, 500);
  }
}

export async function onRequestPut(context) {
  const { env, request } = context;
  const db = env.DB;
  if (!db) return json({ error: "D1 database binding missing" }, 500);

  const auth = await requireAuth(context, "manage_expenses");
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json();
    const id = Number(body.id);
    if (!id) return json({ success: false, message: "Expense id is required" }, 400);

    const parsed = parseExpense(body);
    if (!parsed.ok) return json({ success: false, message: parsed.message }, 400);
    const e = parsed.value;

    const res = await db.prepare(
      `UPDATE expenses SET title=?, category=?, amount=?, expense_date=?, status=?, recurring=?, fund=?, vendor=?, notes=?, is_private=?, updated_at=CURRENT_TIMESTAMP
       WHERE id=?`
    ).bind(e.title, e.category, e.amount, e.expense_date, e.status, e.recurring, e.fund, e.vendor, e.notes, e.is_private, id).run();

    if (!res.meta || res.meta.changes === 0) return json({ success: false, message: "Expense not found" }, 404);

    await audit(context, {
      actorEmail: auth.email, actorType: "admin", verified: auth.verified,
      action: "expense.update", entityType: "expense", entityId: String(id), details: { title: e.title, amount: e.amount, status: e.status }
    });
    return json({ success: true, message: `Expense updated` }, 200, corsHeaders());
  } catch (err) {
    return json({ success: false, message: err.message }, 500);
  }
}

export async function onRequestDelete(context) {
  const { env, request } = context;
  const db = env.DB;
  if (!db) return json({ error: "D1 database binding missing" }, 500);

  const auth = await requireAuth(context, "manage_expenses");
  if (!auth.ok) return auth.response;

  try {
    const id = Number(new URL(request.url).searchParams.get("id"));
    if (!id) return json({ success: false, message: "Expense id is required" }, 400);

    const res = await db.prepare("DELETE FROM expenses WHERE id = ?").bind(id).run();
    if (!res.meta || res.meta.changes === 0) return json({ success: false, message: "Expense not found" }, 404);

    await audit(context, {
      actorEmail: auth.email, actorType: "admin", verified: auth.verified,
      action: "expense.delete", entityType: "expense", entityId: String(id)
    });
    return json({ success: true, message: "Expense deleted" }, 200, corsHeaders());
  } catch (err) {
    return json({ success: false, message: err.message }, 500);
  }
}

export async function onRequestOptions() {
  return new Response(null, { headers: corsHeaders() });
}
