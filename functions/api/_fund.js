// Shared fund identity for the live giving path.
// Tech Fund and Christmas Fund 2025 keep their historical slugs so existing
// contribution rows, Razorpay notes, and caches stay valid. Christmas Fund 2k26
// is a new slug; unknown values still fall through to Tech Fund (same as today).

export const FUND_TECH = "tech-contributions";
export const FUND_XMAS_2025 = "christmas-fund";
export const FUND_XMAS_2K26 = "christmas-fund-2k26";

const TECH_ALIASES = new Set(["tech", "techfund", "tech-contributions"]);

// Checked before the 2025 aliases so "christmasfund2k26" never collapses into
// the old Christmas ledger.
const XMAS_2K26_ALIASES = new Set([
  "christmas-fund-2k26",
  "christmasfund2k26",
  "christmas2k26",
  "christmas2k26fund",
  "christmasfund2026",
  "christmas-fund-2026",
  "christmas2026",
  "christmas2026fund"
]);

const XMAS_2025_ALIASES = new Set([
  "christmas",
  "christmasfund",
  "christmas-fund",
  "christmasfund2025",
  "christmas-fund-2025",
  "christmas2025"
]);

export function compactFundKey(raw) {
  return String(raw || "").toLowerCase().replace(/\s+/g, "");
}

export function resolveKnownFundSlug(raw) {
  const f = compactFundKey(raw);
  if (TECH_ALIASES.has(f)) return FUND_TECH;
  if (XMAS_2K26_ALIASES.has(f)) return FUND_XMAS_2K26;
  if (XMAS_2025_ALIASES.has(f)) return FUND_XMAS_2025;
  return null;
}

// Webhook + public GET: unknown notes still land on Tech Fund, matching
// the historical money-path contract.
export function canonicalFundSlug(raw) {
  return resolveKnownFundSlug(raw) || FUND_TECH;
}

// Admin writes: known aliases remap; any other slug is kept so custom funds
// can still receive manual cash entries.
export function normalizeFundForWrite(raw) {
  return resolveKnownFundSlug(raw) || compactFundKey(raw) || FUND_TECH;
}

export function fundLedgerName(raw) {
  const slug = resolveKnownFundSlug(raw);
  if (slug === FUND_XMAS_2K26) return "Christmas Fund 2k26";
  if (slug === FUND_XMAS_2025) return "Christmas Fund 2025";
  if (slug === FUND_TECH) return "Tech Fund";
  return raw;
}

// Razorpay / Google Pay description (the note the giver sees).
export function fundPaymentNote(raw) {
  const slug = resolveKnownFundSlug(raw) || FUND_TECH;
  if (slug === FUND_XMAS_2K26) return "Christmas 2k26 fund";
  if (slug === FUND_XMAS_2025) return "Christmas Fund 2025";
  return "Tech Fund";
}

export function systemGoalConfigKey(slug) {
  if (slug === FUND_TECH) return "tech_goal_amount";
  if (slug === FUND_XMAS_2025) return "christmas_goal_amount";
  if (slug === FUND_XMAS_2K26) return "christmas_2k26_goal_amount";
  return null;
}
