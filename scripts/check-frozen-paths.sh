#!/usr/bin/env bash
# Frozen payment-path tripwire (see CONTRIBUTING.md section 3).
#
# Fails when a diff between BASE_SHA and HEAD_SHA touches any of the 8 frozen
# giving/money-path files below and no ACKNOWLEDGED-MONEY-PATH-CHANGE token is
# found in the commit messages in that range (or in PR_BODY, when set).
#
# This script is the single source of truth for the check — the
# frozen-payment-paths.yml workflow calls it directly, and it can also be run
# locally to test the tripwire against a synthetic diff:
#
#   BASE_SHA=<sha> HEAD_SHA=<sha> [PR_BODY=<text>] scripts/check-frozen-paths.sh
set -euo pipefail

FROZEN_FILES=(
  "functions/api/webhook.js"
  "functions/api/contributions.js"
  "razorpay-checkout.js"
  "functions/api/verify.js"
  "functions/api/purchases.js"
  "functions/api/_lib.js"
  "functions/api/auth.js"
  "functions/api/roles.js"
)

BASE_SHA="${BASE_SHA:-}"
HEAD_SHA="${HEAD_SHA:-HEAD}"
PR_BODY="${PR_BODY:-}"

if [ -z "$BASE_SHA" ] || [ "$BASE_SHA" = "0000000000000000000000000000000000000000" ]; then
  echo "No usable base SHA (e.g. first push of a new branch) — skipping frozen-path diff check."
  exit 0
fi

CHANGED="$(git diff --name-only "$BASE_SHA" "$HEAD_SHA")"

TOUCHED=()
for f in "${FROZEN_FILES[@]}"; do
  if grep -qxF "$f" <<< "$CHANGED"; then
    TOUCHED+=("$f")
  fi
done

if [ ${#TOUCHED[@]} -eq 0 ]; then
  echo "No frozen payment-path files touched."
  exit 0
fi

echo "Frozen payment-path file(s) touched:"
printf ' - %s\n' "${TOUCHED[@]}"

ACK=0
if git log "$BASE_SHA..$HEAD_SHA" --format=%B | grep -q "ACKNOWLEDGED-MONEY-PATH-CHANGE"; then
  ACK=1
fi
if [ -n "$PR_BODY" ] && grep -q "ACKNOWLEDGED-MONEY-PATH-CHANGE" <<< "$PR_BODY"; then
  ACK=1
fi

if [ "$ACK" -eq 1 ]; then
  echo "ACKNOWLEDGED-MONEY-PATH-CHANGE found — deliberate change, allowing."
  exit 0
fi

echo ""
echo "ERROR: this change touches frozen giving/money-path file(s) listed above"
echo "without an ACKNOWLEDGED-MONEY-PATH-CHANGE acknowledgment."
echo "Per CONTRIBUTING.md section 3, these files never change behavior without a"
echo "deliberate decision. If this change is intentional, add the token"
echo "ACKNOWLEDGED-MONEY-PATH-CHANGE to a commit message or the PR description."
exit 1
