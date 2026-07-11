// Minimal shim that makes Node's built-in node:sqlite look enough like a
// Cloudflare D1 binding (prepare().bind().first()/.all()/.run()) to run the
// real functions/api/*.js handlers directly in `node --test`, with no
// network access and no Cloudflare runtime required.
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");

export function freshDb() {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(readFileSync(path.join(REPO_ROOT, "schema.sql"), "utf8"));
  return wrapD1(sqlite);
}

export function wrapD1(sqlite) {
  return {
    _sqlite: sqlite,
    prepare(sql) {
      let boundArgs = [];
      const api = {
        bind(...args) {
          boundArgs = args;
          return api;
        },
        async first() {
          const stmt = sqlite.prepare(sql);
          const row = stmt.get(...boundArgs);
          return row === undefined ? null : row;
        },
        async all() {
          const stmt = sqlite.prepare(sql);
          return { results: stmt.all(...boundArgs) };
        },
        async run() {
          const stmt = sqlite.prepare(sql);
          const info = stmt.run(...boundArgs);
          return { meta: { last_row_id: Number(info.lastInsertRowid), changes: info.changes } };
        }
      };
      return api;
    }
  };
}

// Builds a fake Pages Functions `context` for calling onRequestGet/Post/Put/Delete
// directly. `authToken` defaults to the machine ADMIN_API_TOKEN path (wildcard
// permissions, no network call to Google) so tests don't need real Google tokens.
export function makeContext({ db, method = "GET", url = "https://test.local/api/x", body, authToken = "test-admin-token", headers = {} } = {}) {
  const env = { DB: db, ADMIN_API_TOKEN: "test-admin-token" };
  const reqHeaders = new Map(Object.entries(headers));
  if (authToken) reqHeaders.set("Authorization", "Bearer " + authToken);
  const request = {
    url,
    method,
    headers: { get: (k) => reqHeaders.get(k) ?? reqHeaders.get(k.toLowerCase?.() ?? k) ?? null },
    json: async () => body ?? {}
  };
  return { env, request };
}
