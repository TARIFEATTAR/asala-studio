#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────
# Best Bottles — gap coverage run (everything WITHOUT a clear-queue slot)
#
#   Gap A: ~438 colored/other-material SKUs with local madison-master refs
#   Gap B: ~438 SKUs with NO local PNG — downloads bestbottles.com GIF
#          references first, then generates from them
#
# Run AFTER (or chained behind) the clear-glass overnight runner:
#   caffeinate -i bash scripts/run-bestbottles-clear-remaining-overnight.sh \
#     && bash scripts/run-bestbottles-gap-coverage.sh
#
# Resumable: ref downloads and generation both skip existing files.
# ─────────────────────────────────────────────────────────────────────
set -u

MADISON="/Users/jordanrichter/Projects/Madison Studio/madison-app"
RENDERS="/Users/jordanrichter/Projects/Clients/Nemat-International/Best-Bottles-Website-02-20-2026/pipeline/madison-hero-sync/renders"
STAMP="2026-06-11"
LOG="$RENDERS/_gap-coverage-$STAMP.log"

cd "$MADISON"
echo "=== Gap coverage run started $(date) ===" | tee -a "$LOG"

run_batches () { # $1 = manifest glob prefix, $2 = out-dir prefix
  for MANIFEST in "$1"-*.json; do
    [ -e "$MANIFEST" ] || { echo "No manifests matching $1-*.json — skipping" | tee -a "$LOG"; return; }
    N=$(basename "$MANIFEST" .json | grep -oE '[0-9]{3}$')
    OUT="$RENDERS/$2-batch-$N-openai-$STAMP"
    echo "=== $MANIFEST → $OUT · $(date) ===" | tee -a "$LOG"
    # Split-provider routing: bulb sprayers (ASP/AST) → nano-banana-2 for
    # hardware fidelity; everything else → OpenAI gpt-image-2.
    npx tsx scripts/local-generate.ts \
      --manifest "$MANIFEST" \
      --modes cap-on \
      --provider openai \
      --exclude "*-ASP-*,*-AST-*" \
      --concurrency 4 \
      --out-dir "$OUT" 2>&1 | tee -a "$LOG"
    [ -f "$OUT/_generation-report.csv" ] && mv "$OUT/_generation-report.csv" "$OUT/_generation-report-openai.csv"
    npx tsx scripts/local-generate.ts \
      --manifest "$MANIFEST" \
      --modes cap-on \
      --provider gemini \
      --filter "*-ASP-*,*-AST-*" \
      --concurrency 4 \
      --out-dir "$OUT" 2>&1 | tee -a "$LOG"
    [ -f "$OUT/_generation-report.csv" ] && mv "$OUT/_generation-report.csv" "$OUT/_generation-report-gemini.csv"
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
      echo "MADISON_IMPORT_USER_ID not set — skipped import for $OUT" | tee -a "$LOG"
    fi
  done
}

# Gap A — colored/other-material, local references
npx tsx scripts/build-bestbottles-colored-local-manifests.ts 2>&1 | tee -a "$LOG" \
  || { echo "GAP FAIL: colored manifest build" | tee -a "$LOG"; exit 1; }
run_batches "tmp/best-bottles-colored-local" "colored-local"

# Gap B — no local PNG: fetch bestbottles.com GIF refs, then generate
npx tsx scripts/fetch-bestbottles-live-references.ts 2>&1 | tee -a "$LOG" \
  || echo "WARN: some live reference downloads failed — generating from what landed" | tee -a "$LOG"
run_batches "tmp/best-bottles-live-reference" "live-reference"

echo "=== Gap coverage run finished $(date) ===" | tee -a "$LOG"
