#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────
# Best Bottles — overnight cap-on generation, clear-glass remaining queue
# Batches 002–007 of tmp/best-bottles-reference-backed-clear-remaining-*
# (~804 SKUs) via OpenAI gpt-image-2, then import into Madison Studio.
#
# Resumable: skip-existing is on. Re-running this script after a crash
# or Ctrl-C picks up where it left off at zero API cost.
#
# Run with sleep prevention:
#   caffeinate -i bash scripts/run-bestbottles-clear-remaining-overnight.sh
# ─────────────────────────────────────────────────────────────────────
set -u

MADISON="/Users/jordanrichter/Projects/Madison Studio/madison-app"
RENDERS="/Users/jordanrichter/Projects/Clients/Nemat-International/Best-Bottles-Website-02-20-2026/pipeline/madison-hero-sync/renders"
STAMP="2026-06-11"
LOG="$RENDERS/_overnight-clear-remaining-$STAMP.log"

cd "$MADISON"

echo "=== Overnight run started $(date) ===" | tee -a "$LOG"

# Step 0 — prompt sanity gate: dry-run one SKU; abort the night if broken.
npx tsx scripts/local-generate.ts \
  --manifest tmp/best-bottles-reference-backed-clear-remaining-batch-002.json \
  --modes cap-on --dry-run --limit 1 --out-dir /tmp/bb-dryrun \
  || { echo "DRY-RUN FAILED — aborting before any API spend" | tee -a "$LOG"; exit 1; }

for N in 002 003 004 005 006 007; do
  MANIFEST="tmp/best-bottles-reference-backed-clear-remaining-batch-$N.json"

  # Batch 002 already has 4 PNGs in its June 9 folder — reuse it so
  # skip-existing resumes instead of re-paying for those 4.
  if [ "$N" = "002" ]; then
    OUT="$RENDERS/reference-backed-clear-remaining-batch-002-openai-2026-06-09"
  else
    OUT="$RENDERS/reference-backed-clear-remaining-batch-$N-openai-$STAMP"
  fi

  echo "=== batch $N → $OUT · $(date) ===" | tee -a "$LOG"

  # Pass 1 — OpenAI gpt-image-2 for everything EXCEPT bulb sprayers.
  # (Smoke test 2026-06-11: gpt-image-2 invents hoses on direct-mount
  #  bulbs despite hard constraints; nano-banana-2 reproduces bulb
  #  hardware near-pixel-faithfully, so ASP/AST route to gemini.)
  npx tsx scripts/local-generate.ts \
    --manifest "$MANIFEST" \
    --modes cap-on \
    --provider openai \
    --exclude "*-ASP-*,*-AST-*" \
    --concurrency 4 \
    --out-dir "$OUT" 2>&1 | tee -a "$LOG"
  [ -f "$OUT/_generation-report.csv" ] && mv "$OUT/_generation-report.csv" "$OUT/_generation-report-openai.csv"

  # Pass 2 — nano-banana-2 (gemini) for bulb-sprayer SKUs only.
  npx tsx scripts/local-generate.ts \
    --manifest "$MANIFEST" \
    --modes cap-on \
    --provider gemini \
    --filter "*-ASP-*,*-AST-*" \
    --concurrency 4 \
    --out-dir "$OUT" 2>&1 | tee -a "$LOG"
  [ -f "$OUT/_generation-report.csv" ] && mv "$OUT/_generation-report.csv" "$OUT/_generation-report-gemini.csv"

  # Surface this batch in Madison Studio.
  # Requires MADISON_IMPORT_USER_ID (env or .env/.env.local).
  if [ -n "${MADISON_IMPORT_USER_ID:-}" ] \
     || grep -qsE '^MADISON_IMPORT_USER_ID=.+' .env .env.local; then
    for REPORT in "$OUT/_generation-report-openai.csv" "$OUT/_generation-report-gemini.csv"; do
      [ -f "$REPORT" ] || continue
      npx tsx scripts/import-local-generation-to-madison.ts \
        --report "$REPORT" \
        --batch-slug "$(basename "$OUT")" \
        --execute --upsert 2>&1 | tee -a "$LOG"
    done
  else
    echo "MADISON_IMPORT_USER_ID not set — skipped Madison import for batch $N." | tee -a "$LOG"
    echo "Import later with the two _generation-report-*.csv files in $OUT" | tee -a "$LOG"
  fi
done

echo "=== Overnight run finished $(date) ===" | tee -a "$LOG"
