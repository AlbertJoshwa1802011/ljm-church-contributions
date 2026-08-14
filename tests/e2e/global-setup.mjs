// Playwright globalSetup: prepares a local, offline Cloudflare D1 (via
// `wrangler pages dev --local`) and starts the long-lived dev server the
// whole E2E run talks to.
//
// This does NOT use Playwright's own `webServer` config option — that
// option's startup can run concurrently with globalSetup, and this setup
// needs to delete/recreate `.wrangler/state` before any server touches it,
// so this file owns the server's full lifecycle itself (paired with
// tests/e2e/global-teardown.mjs) to avoid that race entirely.
//
// wrangler creates the local D1 SQLite file lazily on first access, keyed by
// a hash of the `--d1 BINDING=name` binding config — there is no supported
// "apply this schema.sql to local D1" flag for `pages dev`, so this briefly
// starts a throwaway server, makes one request to force D1 file creation,
// stops it, then writes schema.sql (and a couple of deterministic seed rows)
// directly into that file with node:sqlite — the same technique
// tests/helpers/mock-d1.mjs uses for the in-memory D1 mock, just against
// wrangler's on-disk SQLite instead of :memory:. Only once the schema is in
// place does the real, long-lived server for the test run start.
//
// No network, no Cloudflare credentials, no production access: everything
// here talks only to 127.0.0.1 and the local filesystem.
import { spawn } from "node:child_process";
import { readFileSync, readdirSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const STATE_DIR = path.join(REPO_ROOT, ".wrangler", "state");
const D1_DIR = path.join(STATE_DIR, "v3", "d1", "miniflare-D1DatabaseObject");
const PID_FILE = path.join(REPO_ROOT, ".wrangler", "e2e-server.pid");
export const PORT = 8788;

const WRANGLER_ARGS = [
  "wrangler", "pages", "dev", ".",
  "--d1", "DB=ljm-contributions-db",
  "--r2", "EVENT_PHOTOS=ljm-event-photos",
  "--port", String(PORT),
  "--ip", "127.0.0.1"
];

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

function spawnServer() {
  return spawn("npx", WRANGLER_ARGS, {
    cwd: REPO_ROOT,
    stdio: "ignore",
    detached: true
  });
}

function killAndWait(child, timeoutMs = 10000) {
  return new Promise((resolve) => {
    if (child.exitCode !== null || child.killed) return resolve();
    const done = () => resolve();
    child.once("exit", done);
    try { process.kill(-child.pid, "SIGTERM"); } catch (_) { try { child.kill("SIGTERM"); } catch (__) {} }
    setTimeout(() => {
      try { process.kill(-child.pid, "SIGKILL"); } catch (_) {}
      done();
    }, timeoutMs);
  });
}

async function waitForServer(timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/`);
      if (res.status < 500) return true;
    } catch (_) {
      // not up yet
    }
    await sleep(300);
  }
  return false;
}

function findD1File() {
  let files;
  try { files = readdirSync(D1_DIR); } catch (_) { return null; }
  const match = files.filter((f) => f.endsWith(".sqlite") && f !== "metadata.sqlite");
  return match.length ? path.join(D1_DIR, match[0]) : null;
}

export default async function globalSetup() {
  // Start from a clean local-persistence slate so every E2E run is deterministic.
  rmSync(STATE_DIR, { recursive: true, force: true });

  // Phase 1: throwaway probe, just to force wrangler to create the D1 file.
  const probe = spawnServer();
  const probeUp = await waitForServer(30000);
  if (!probeUp) {
    await killAndWait(probe);
    throw new Error("wrangler pages dev did not come up during the schema-seed probe");
  }
  await fetch(`http://127.0.0.1:${PORT}/api/funds`).catch(() => {});
  await killAndWait(probe);

  const dbFile = findD1File();
  if (!dbFile) {
    throw new Error(`Could not locate the local D1 sqlite file under ${D1_DIR} after the probe run.`);
  }

  const db = new DatabaseSync(dbFile);
  try {
    db.exec(readFileSync(path.join(REPO_ROOT, "schema.sql"), "utf8"));

    const existing = db.prepare("SELECT COUNT(*) AS c FROM funds WHERE slug LIKE 'e2e-%'").get();
    if (!existing || existing.c === 0) {
      db.prepare(
        `INSERT INTO funds (slug, name, description, goal_amount, status, visibility, is_system)
         VALUES (?, ?, ?, ?, 'active', 'public', 0)`
      ).run("e2e-building-fund", "E2E Building Fund", "Seeded for Playwright smoke tests", 100000);
      db.prepare(
        `INSERT INTO funds (slug, name, description, goal_amount, status, visibility, is_system)
         VALUES (?, ?, ?, ?, 'active', 'public', 0)`
      ).run("e2e-mission-fund", "E2E Mission Fund", "Seeded for Playwright smoke tests", 50000);

      // admin.html's Overview KPI/recent-table only ever aggregates the two
      // system funds' contributions (fetch("/api/contributions?fund=tech-
      // contributions") / "?fund=christmas-fund") — it does not surface
      // per-dynamic-fund contribution data itself. Seeding against the
      // system fund here is what makes the Overview KPI genuinely non-zero
      // and traceable to a known value; "dynamic funds represented" is
      // checked separately, against the Funds section, where fund NAMES
      // (including the two seeded above) actually render as text.
      db.prepare(
        `INSERT INTO contributions (member_name, amount, date, category, fund, email)
         VALUES (?, ?, ?, ?, ?, ?)`
      ).run("E2E Seed Donor", 2500, "2026-08-01 10:00:00", "Direct Cash", "tech-contributions", "e2e-donor@example.com");

      // A non-super-admin role holder with only `manage_funds` (not
      // `delete_funds`) — admin.html only shows the Archive button (as
      // opposed to Delete) to a fund-editor who isn't the hardcoded super
      // admin, so the FUND ADMIN E2E test logs in as this identity via the
      // same dev-login path to exercise the real Archive flow.
      db.prepare(`INSERT OR IGNORE INTO roles (role_name, permissions) VALUES (?, ?)`)
        .run("e2e_fund_manager", JSON.stringify(["manage_funds", "view_members"]));
      db.prepare(`INSERT OR IGNORE INTO member_roles (email, role_name) VALUES (?, ?)`)
        .run("e2e-fund-admin@example.com", "e2e_fund_manager");
    }
  } finally {
    db.close();
  }

  // Phase 2: the real, long-lived server the test run talks to.
  mkdirSync(path.dirname(PID_FILE), { recursive: true });
  const server = spawnServer();
  const up = await waitForServer(30000);
  if (!up) {
    await killAndWait(server);
    throw new Error("wrangler pages dev did not come up for the E2E test run");
  }
  writeFileSync(PID_FILE, String(server.pid));
  server.unref();
}
