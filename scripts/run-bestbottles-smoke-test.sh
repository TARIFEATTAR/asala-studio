#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────
# Best Bottles — image pipeline smoke test (run BEFORE the overnight batch)
#
# Exercises every stage of tonight's run on 4 images (~$0.30):
#   1. Prompt assembly        — dry-run 1 manifest SKU, no API spend
#   2. Manifest + gpt-image-2 — live-generate first 3 SKUs of batch 002
#                               (Reducer, Spray Pump, Bulb Sprayer spread)
#   3. Editorial mode         — 1 live editorial render (new lane)
#   4. Report + Madison import wiring (dry-run unless user id is set)
#
#   bash scripts/run-bestbottles-smoke-test.sh
# ─────────────────────────────────────────────────────────────────────
set -u

MADISON="/Users/jordanrichter/Projects/Madison Studio/madison-app"
RENDERS="/Users/jordanrichter/Projects/Clients/Nemat-International/Best-Bottles-Website-02-20-2026/pipeline/madison-hero-sync/renders"
SMOKE="$RENDERS/smoke-openai-2026-06-11"
MANIFEST="tmp/best-bottles-reference-backed-clear-remaining-batch-002.json"

cd "$MADISON"
mkdir -p "$SMOKE"

echo "── [1/4] Prompt assembly dry-run ──────────────────────────────"
npx tsx scripts/local-generate.ts \
  --manifest "$MANIFEST" \
  --modes cap-on --dry-run --limit 1 --out-dir /tmp/bb-smoke-dryrun \
  || { echo "SMOKE FAIL: prompt assembly"; exit 1; }

echo "── [2/4] Live gpt-image-2 · 3 manifest SKUs ───────────────────"
npx tsx scripts/local-generate.ts \
  --manifest "$MANIFEST" \
  --modes cap-on \
  --provider openai \
  --concurrency 3 \
  --limit 3 \
  --out-dir "$SMOKE" \
  || { echo "SMOKE FAIL: live generation"; exit 1; }

echo "── [3/4] Editorial mode · 1 live render ───────────────────────"
npx tsx scripts/local-generate.ts \
  --filter "GB-EMP-CLR-100ML-ASP-BLK" \
  --modes editorial \
  --provider openai \
  --out-dir "$SMOKE" \
  || echo "SMOKE WARN: editorial render failed (does not block tonight's cap-on batch)"

echo "── [4/4] Report + Madison import wiring ───────────────────────"
column -s, -t < "$SMOKE/_generation-report.csv" 2>/dev/null | cut -c1-160 || cat "$SMOKE/_generation-report.csv"

if [ -n "${MADISON_IMPORT_USER_ID:-}" ] \
   || grep -qsE '^MADISON_IMPORT_USER_ID=.+' .env .env.local; then
  npx tsx scripts/import-local-generation-to-madison.ts \
    --report "$SMOKE/_generation-report.csv" --execute --upsert
else
  echo "MADISON_IMPORT_USER_ID not set — testing importer in dry-run (no upload):"
  npx tsx scripts/import-local-generation-to-madison.ts \
    --report "$SMOKE/_generation-report.csv"
fi

echo ""
echo "SMOKE TEST DONE — outputs in: $SMOKE"
echo "Tell Claude to inspect the renders before launching the overnight run."
