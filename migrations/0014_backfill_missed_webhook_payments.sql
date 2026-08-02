-- Migration 0014: DATA backfill (no schema change).
--
-- Between 2026-07-08 and 2026-08-02 four Razorpay payments were captured but
-- never reached this backend. Root cause: the only webhook registered in
-- Razorpay pointed at the Google Apps Script URL, so /api/webhook was never
-- called. The gifts reached the Sheet and nothing reached D1.
--
-- These statements were GENERATED, not hand-written: each payment was replayed
-- through functions/api/webhook.js in the test harness and the row it produced
-- was read back and serialised here. The rows are therefore identical to what
-- the webhook would have written had it been delivered.
--
-- Safe to re-run: contributions.proof_id is UNIQUE and every row below carries
-- a real Razorpay payment id, so INSERT OR IGNORE is a genuine no-op on a
-- second pass. Verified against a replica seeded with all 94 production rows.
--
-- Reconciled against the Razorpay payments list for 2026-05-01..2026-08-03:
-- these four are the complete set of captured payments absent from D1.

-- Albert Joshwa A Rs1 @ 2026-08-01 17:31:15 IST
INSERT OR IGNORE INTO members (name, email, phone) VALUES ('Albert Joshwa A', 'albertjoshrock101@gmail.com', '9944270690');
UPDATE members SET email = COALESCE(email, 'albertjoshrock101@gmail.com'), phone = COALESCE(phone, '9944270690') WHERE name = 'Albert Joshwa A';
INSERT OR IGNORE INTO contributions (member_name, amount, date, category, notes, proof_id, email, phone, fund)
  VALUES ('Albert Joshwa A', 1, '2026-08-01 17:31:15', 'Online (Verified)', 'August: Online Payment Received | Method: upi (albertjoshrock101-1@okhdfcbank)', 'pay_TKUwMs3w4mHmNs', 'albertjoshrock101@gmail.com', '9944270690', 'tech-contributions');

-- Prem Kumar Rs200 @ 2026-08-01 17:39:06 IST
INSERT OR IGNORE INTO members (name, email, phone) VALUES ('Prem Kumar', 'premkumarvijaya22@gmail.com', '9790004188');
UPDATE members SET email = COALESCE(email, 'premkumarvijaya22@gmail.com'), phone = COALESCE(phone, '9790004188') WHERE name = 'Prem Kumar';
INSERT OR IGNORE INTO contributions (member_name, amount, date, category, notes, proof_id, email, phone, fund)
  VALUES ('Prem Kumar', 200, '2026-08-01 17:39:06', 'Online (Verified)', 'August: Online Payment Received | Method: upi (9790004188@axl)', 'pay_TKV4eIj1leYGxk', 'premkumarvijaya22@gmail.com', '9790004188', 'tech-contributions');

-- Augusta Moses Rs200 @ 2026-08-02 08:04:20 IST
INSERT OR IGNORE INTO members (name, email, phone) VALUES ('Augusta Moses', 'augustaauga@gmail.com', '9585958215');
UPDATE members SET email = COALESCE(email, 'augustaauga@gmail.com'), phone = COALESCE(phone, '9585958215') WHERE name = 'Augusta Moses';
INSERT OR IGNORE INTO contributions (member_name, amount, date, category, notes, proof_id, email, phone, fund)
  VALUES ('Augusta Moses', 200, '2026-08-02 08:04:20', 'Online (Verified)', 'August: Online Payment Received | Method: upi (augustaauga@okaxis)', 'pay_TKjocewXOMG4lW', 'augustaauga@gmail.com', '9585958215', 'tech-contributions');

-- Albert Joshwa A Rs1 @ 2026-07-08 01:21:39 IST
INSERT OR IGNORE INTO members (name, email, phone) VALUES ('Albert Joshwa A', 'albertjoshrock101@gmail.com', '9944270690');
UPDATE members SET email = COALESCE(email, 'albertjoshrock101@gmail.com'), phone = COALESCE(phone, '9944270690') WHERE name = 'Albert Joshwa A';
INSERT OR IGNORE INTO contributions (member_name, amount, date, category, notes, proof_id, email, phone, fund)
  VALUES ('Albert Joshwa A', 1, '2026-07-08 01:21:39', 'Online (Verified)', 'July: Online Payment Received | Method: upi ()', 'pay_TAjbFttLn3tfMM', 'albertjoshrock101@gmail.com', '9944270690', 'tech-contributions');

-- 4 payments, Rs402 total
