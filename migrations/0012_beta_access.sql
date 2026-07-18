-- Migration 0012: Beta-tester allowlist for the flag-gated "v2" flow.
-- Purely additive and idempotent. Safe to run on the live database.
-- See docs/milestone-v2/11-v2-flow-implementation.md for the full design.

CREATE TABLE IF NOT EXISTS beta_testers (
  email TEXT PRIMARY KEY,      -- stored lowercase/trimmed, see beta-testers.js
  added_by TEXT,
  note TEXT,
  added_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Seed the requester's own account per their explicit instruction
-- ("as of now my mail albertjoshrock101@gmail.com alone").
INSERT OR IGNORE INTO beta_testers (email, added_by, note)
VALUES ('albertjoshrock101@gmail.com', 'migration-0012', 'Initial requester, seeded at rollout');
