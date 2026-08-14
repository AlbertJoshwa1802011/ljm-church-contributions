// Playwright globalTeardown: stops the long-lived wrangler dev server
// started by tests/e2e/global-setup.mjs. Paired file — see that file's
// header comment for why the server lifecycle is managed here rather than
// through Playwright's own `webServer` config option.
import { existsSync, readFileSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const PID_FILE = path.join(REPO_ROOT, ".wrangler", "e2e-server.pid");

export default async function globalTeardown() {
  if (!existsSync(PID_FILE)) return;
  const pid = Number(readFileSync(PID_FILE, "utf8").trim());
  if (pid) {
    try { process.kill(-pid, "SIGTERM"); } catch (_) {
      try { process.kill(pid, "SIGTERM"); } catch (__) {}
    }
  }
  rmSync(PID_FILE, { force: true });
}
