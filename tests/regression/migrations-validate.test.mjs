// Migration validation. This is a tripwire for the gap described in
// docs/milestone-v2 hardening notes: nothing previously executed
// migrations/*.sql, so a migration file could drift from schema.sql (which
// is what freshDb() — and therefore every other test — is built from)
// without `npm test` ever noticing.
//
// There is no schema_migrations ledger and no migration runner in this repo
// (see CONTRIBUTING.md §4): every file under migrations/ is applied by hand,
// once, directly against production D1 via
// .github/workflows/deploy-migrations.yml / apply-d1-migration.yml. Because
// of that, "replay every migration from an empty database" isn't a
// meaningful test here — migrations/ starts at 0002; there is no 0001 file
// to recreate the original pre-migration schema (members, contributions,
// purchases, config, wishlist, roles, member_roles predate the migrations/
// folder entirely and live only in schema.sql). Inventing a synthetic "0001"
// base would mean maintaining a second, hand-guessed copy of history — the
// "migration framework" this task explicitly says not to build.
//
// Instead: schema.sql is the accumulated end-state of every migration ever
// written (each one is additive-only per CONTRIBUTING.md §4), so it is a
// valid stand-in for "a database that already has every migration applied".
// Running each migration's statements against it gives a precise, cheap
// oracle:
//   - CREATE TABLE IF NOT EXISTS / CREATE INDEX IF NOT EXISTS / INSERT OR
//     IGNORE / UPDATE ... SET <fixed value> / plain INSERT (data-only
//     migrations like 0014) must all succeed silently — any error here means
//     either malformed SQL, or the statement depends on a table/column that
//     doesn't exist yet at that point (wrong ordering, or schema.sql is
//     missing something a migration expects — drift).
//   - ALTER TABLE ... ADD COLUMN is the one non-idempotent statement shape
//     used in this repo (SQLite has no ADD COLUMN IF NOT EXISTS — every such
//     migration says so in its own header comment). Against schema.sql it
//     MUST fail with "duplicate column name", because schema.sql already
//     carries that column. If it does NOT fail — i.e. it succeeds — that
//     means schema.sql is missing a column a real migration adds: drift,
//     and the test fails loudly.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const MIGRATIONS_DIR = path.join(REPO_ROOT, "migrations");
const SCHEMA_SQL = readFileSync(path.join(REPO_ROOT, "schema.sql"), "utf8");

function freshSchemaDb() {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(SCHEMA_SQL);
  return sqlite;
}

// Splits a .sql file into individual top-level statements, respecting
// single-quoted string literals (with '' escaping) and -- line comments, so
// a semicolon or a "--" sequence inside a quoted string (both occur in the
// bible-verse seed data) doesn't get mistaken for a statement boundary or a
// comment.
function splitStatements(sql) {
  const statements = [];
  let current = "";
  let inString = false;
  for (let i = 0; i < sql.length; i++) {
    const ch = sql[i];
    if (inString) {
      current += ch;
      if (ch === "'") {
        if (sql[i + 1] === "'") {
          current += "'";
          i++;
        } else {
          inString = false;
        }
      }
      continue;
    }
    if (ch === "'") {
      inString = true;
      current += ch;
      continue;
    }
    if (ch === "-" && sql[i + 1] === "-") {
      while (i < sql.length && sql[i] !== "\n") i++;
      continue;
    }
    if (ch === ";") {
      statements.push(current);
      current = "";
      continue;
    }
    current += ch;
  }
  if (current.trim()) statements.push(current);
  return statements.map((s) => s.trim()).filter(Boolean);
}

const ALTER_ADD_COLUMN_RE = /^ALTER\s+TABLE\s+\S+\s+ADD\s+COLUMN\b/i;

function migrationFiles() {
  return readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();
}

test("migration validation: every migrations/*.sql file is discovered", () => {
  const files = migrationFiles();
  assert.ok(files.length >= 14, `expected at least 14 migration files, found ${files.length}`);
  assert.ok(files.includes("0015_fund_foundation_metadata.sql"), "0015 must be present and discoverable");
});

for (const file of migrationFiles()) {
  test(`migration validation: ${file} parses and executes cleanly against schema.sql`, () => {
    const sqlite = freshSchemaDb();
    const raw = readFileSync(path.join(MIGRATIONS_DIR, file), "utf8");
    const statements = splitStatements(raw);
    assert.ok(statements.length > 0, `${file} produced no statements — check the splitter or an empty file`);

    for (const statement of statements) {
      let error = null;
      try {
        sqlite.exec(statement);
      } catch (e) {
        error = e;
      }

      if (ALTER_ADD_COLUMN_RE.test(statement)) {
        // schema.sql already has every column any migration adds (it's the
        // accumulated end-state), so re-running the ADD COLUMN here must
        // fail with exactly this error. If it succeeds instead, schema.sql
        // is missing a column this migration is supposed to add — drift.
        assert.ok(
          error,
          `${file}: expected "${statement}" to fail with "duplicate column name" ` +
            `(schema.sql should already have this column) but it succeeded — ` +
            `schema.sql is missing a column this migration adds (schema/migration drift)`
        );
        assert.match(
          error.message,
          /duplicate column name/i,
          `${file}: "${statement}" failed with an unexpected error (expected duplicate column name): ${error.message}`
        );
      } else {
        assert.ok(
          !error,
          `${file}: statement failed unexpectedly (malformed SQL, wrong ordering, or missing prerequisite in schema.sql):\n` +
            `  ${statement}\n  -> ${error && error.message}`
        );
      }
    }
  });
}

test("migration validation: numbering is monotonic and the only duplicate is the documented pre-existing 0011 pair", () => {
  const files = migrationFiles();
  const byNumber = new Map();
  for (const file of files) {
    const match = file.match(/^(\d+)_/);
    assert.ok(match, `${file} does not start with a numeric prefix`);
    const num = match[1];
    if (!byNumber.has(num)) byNumber.set(num, []);
    byNumber.get(num).push(file);
  }

  const duplicated = [...byNumber.entries()].filter(([, list]) => list.length > 1);
  assert.deepEqual(
    duplicated.map(([num]) => num),
    ["0011"],
    "a new duplicate migration number appeared. This repo has one known, " +
      "pre-existing, intentionally-not-renumbered duplicate (0011_events.sql / " +
      "0011_member_appearance.sql — see migrations/README.md). Any other " +
      "duplicate number is very likely a real mistake: two unrelated changes " +
      "racing for the same slot. Give the new migration the next free number."
  );
  assert.deepEqual(
    byNumber.get("0011").sort(),
    ["0011_events.sql", "0011_member_appearance.sql"],
    "the 0011 duplicate no longer matches the documented pair — investigate before touching it"
  );

  const numbers = [...byNumber.keys()].map(Number).sort((a, b) => a - b);
  for (let i = 1; i < numbers.length; i++) {
    assert.ok(
      numbers[i] - numbers[i - 1] <= 1,
      `gap in migration numbering between ${numbers[i - 1]} and ${numbers[i]} — ` +
        `confirm this is intentional (e.g. a number retired/renumbered) before adding new migrations`
    );
  }
});

// Static ordering check: every table a migration touches (ALTER TABLE, INSERT
// INTO, UPDATE, or a SELECT ... FROM used as an insert source) must already
// be known by that point — either one of the tables that predate migrations/
// entirely (they live only in schema.sql: members, contributions, purchases,
// config, wishlist, roles, member_roles), or created by this same file, or
// created by an earlier-numbered file. This catches a migration that was
// written or numbered out of order (references a table only a later
// migration creates) without needing a full SQL parser.
const BASE_TABLES = new Set(["members", "contributions", "purchases", "config", "wishlist", "roles", "member_roles"]);

// Strips -- line comments and the CONTENTS of '...' string literals (keeping
// the quotes' surrounding structure), so the keyword-based regexes below
// can't be fooled by a word like "from" or "insert into" that happens to
// appear inside a comment or inside a Bible-verse seed row's text.
function sqlSkeleton(raw) {
  let result = "";
  let inString = false;
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];
    if (inString) {
      if (ch === "'") {
        if (raw[i + 1] === "'") {
          i++;
          continue;
        }
        inString = false;
      }
      continue;
    }
    if (ch === "'") {
      inString = true;
      continue;
    }
    if (ch === "-" && raw[i + 1] === "-") {
      while (i < raw.length && raw[i] !== "\n") i++;
      continue;
    }
    result += ch;
  }
  return result;
}

function tablesCreatedBy(raw) {
  const found = new Set();
  const re = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?([a-zA-Z_][a-zA-Z0-9_]*)/gi;
  let m;
  while ((m = re.exec(raw))) found.add(m[1].toLowerCase());
  return found;
}

function tablesReferencedBy(raw) {
  const found = new Set();
  const patterns = [
    /ALTER\s+TABLE\s+([a-zA-Z_][a-zA-Z0-9_]*)/gi,
    /INSERT\s+(?:OR\s+IGNORE\s+)?INTO\s+([a-zA-Z_][a-zA-Z0-9_]*)/gi,
    /UPDATE\s+([a-zA-Z_][a-zA-Z0-9_]*)\s+SET/gi,
    /FROM\s+([a-zA-Z_][a-zA-Z0-9_]*)/gi,
  ];
  for (const re of patterns) {
    let m;
    while ((m = re.exec(raw))) found.add(m[1].toLowerCase());
  }
  return found;
}

test("migration validation: no migration references a table before it (or an earlier migration) creates it", () => {
  const files = migrationFiles().sort((a, b) => {
    const na = Number(a.match(/^(\d+)_/)[1]);
    const nb = Number(b.match(/^(\d+)_/)[1]);
    return na - nb || a.localeCompare(b);
  });

  const known = new Set(BASE_TABLES);
  for (const file of files) {
    const raw = sqlSkeleton(readFileSync(path.join(MIGRATIONS_DIR, file), "utf8"));
    const createdHere = tablesCreatedBy(raw);
    const referenced = tablesReferencedBy(raw);
    const availableAtThisPoint = new Set([...known, ...createdHere]);

    for (const table of referenced) {
      assert.ok(
        availableAtThisPoint.has(table),
        `${file} references table '${table}' which is not created by this file, ` +
          `an earlier-numbered migration, or a pre-migration base table — ` +
          `either a typo or the migration is numbered/ordered wrong`
      );
    }

    for (const table of createdHere) known.add(table);
  }
});

// Migration 0015 gets its own dedicated, from-scratch execution (not just the
// drift check above) per the hardening task: build the `funds` table exactly
// as it looked *before* 0015 (i.e. schema.sql's funds table minus the six
// columns 0015 adds), run 0015's real SQL against it, and confirm the
// columns land with the right nullability/defaults and actually hold data.
test("migration validation: 0015_fund_foundation_metadata.sql executes against a pre-0015 funds table and adds the documented columns", () => {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(`
    CREATE TABLE funds (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      goal_amount REAL DEFAULT 0,
      status TEXT DEFAULT 'active',
      visibility TEXT DEFAULT 'public',
      is_system INTEGER DEFAULT 0,
      created_by TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_by TEXT,
      updated_at DATETIME
    );
  `);
  sqlite.exec("INSERT INTO funds (slug, name) VALUES ('tech-contributions', 'Tech Fund')");

  const raw = readFileSync(path.join(MIGRATIONS_DIR, "0015_fund_foundation_metadata.sql"), "utf8");
  const statements = splitStatements(raw);
  assert.ok(statements.length >= 6, "expected at least 6 ALTER TABLE statements in 0015");
  for (const statement of statements) {
    assert.ok(ALTER_ADD_COLUMN_RE.test(statement), `0015 should only contain ALTER TABLE ... ADD COLUMN, found: ${statement}`);
    sqlite.exec(statement); // must not throw against this pre-0015 table
  }

  const columns = sqlite.prepare("PRAGMA table_info(funds)").all();
  const byName = Object.fromEntries(columns.map((c) => [c.name, c]));
  for (const col of ["hero_image_url", "hero_image_storage", "message", "ranking_enabled", "ranking_visibility", "razorpay_key_id"]) {
    assert.ok(byName[col], `0015 must add column funds.${col}`);
  }
  assert.equal(byName.ranking_enabled.notnull, 1, "ranking_enabled must be NOT NULL");
  assert.equal(byName.ranking_enabled.dflt_value, "0", "ranking_enabled must default to 0");
  assert.equal(byName.ranking_visibility.notnull, 1, "ranking_visibility must be NOT NULL");
  assert.equal(byName.ranking_visibility.dflt_value, "'public'", "ranking_visibility must default to 'public'");
  for (const col of ["hero_image_url", "hero_image_storage", "message", "razorpay_key_id"]) {
    assert.equal(byName[col].notnull, 0, `${col} must be nullable`);
  }

  // Round-trip: the new columns are actually usable, not just declared.
  sqlite.exec(
    `UPDATE funds SET hero_image_url = 'https://example/x.jpg', hero_image_storage = 'external', ` +
      `message = 'why this fund exists', ranking_enabled = 1, ranking_visibility = 'members', ` +
      `razorpay_key_id = 'rzp_test_123' WHERE slug = 'tech-contributions'`
  );
  const row = sqlite.prepare("SELECT * FROM funds WHERE slug = 'tech-contributions'").get();
  assert.equal(row.hero_image_storage, "external");
  assert.equal(row.ranking_enabled, 1);
  assert.equal(row.razorpay_key_id, "rzp_test_123");

  // Documented non-idempotency: SQLite has no ADD COLUMN IF NOT EXISTS, so a
  // second run of the same migration must fail exactly the way its own
  // header comment says it will.
  assert.throws(() => sqlite.exec(statements[0]), /duplicate column name/i);
});

test("migration validation: deploy-migrations.yml's dropdown lists every migration it claims to cover", () => {
  const workflowPath = path.join(REPO_ROOT, ".github", "workflows", "deploy-migrations.yml");
  const workflow = readFileSync(workflowPath, "utf8");
  const listedOptions = [...workflow.matchAll(/^\s{10}- (\S+)$/gm)].map((m) => m[1]);
  assert.ok(listedOptions.length > 0, "could not parse any options out of deploy-migrations.yml — check the indentation-based regex still matches");

  // The dropdown intentionally starts at 0005 (0002-0004 predate this
  // workflow and were applied before it existed — see migrations/README.md).
  // Every migration from 0005 onward must appear, so the picker never again
  // silently stops short of the newest migration.
  const expected = migrationFiles()
    .filter((f) => Number(f.match(/^(\d+)_/)[1]) >= 5)
    .map((f) => f.replace(/\.sql$/, ""));

  for (const name of expected) {
    assert.ok(
      listedOptions.includes(name),
      `deploy-migrations.yml is missing '${name}' from its migration picker — ` +
        `it will silently stop short of the newest migration again`
    );
  }
});
