---
name: bestbottles-reference-cutover
description: >-
  Cut over a Best Bottles product FAMILY from its OLD legacy-render references to
  the NEW clean transparent references in the live pipeline: upload the clean
  {graceSku}.png to the public Supabase `reference-images` bucket and repoint
  `best_bottles_pipeline_sku_jobs.best_reference_candidate_path` for that family's
  covered_canonical jobs. Use this skill WHENEVER the Best Bottles pipeline shows
  or generates from the wrong/old reference, when a family's clean reference lane
  has landed and needs to go live, when someone says "repoint references",
  "reference cutover", "the bottle still shows the old render", "generate-madison-image
  is using the wrong reference", "sync the clean references", or after a
  reference-intake.json rebuild flips a family's rows to covered_canonical. Also
  use it to understand WHY a Best Bottles reference won't load or generate.
---

# Best Bottles clean-reference cutover (per family)

This skill makes a Best Bottles family's NEW clean transparent references the live
reference the pipeline UI shows and `generate-madison-image` generates from. It is
the operational follow-through after Cowork delivers a family's clean PNGs and the
intake rebuild flips that family to `covered_canonical`.

Read `docs/BEST-BOTTLES-IMAGE-PIPELINE-BRIEF.md` first for the two-axis model and
lane discipline. This repo (Madison) is the single writer to Supabase + generation.

## The one fact that prevents the mistake

The pipeline UI (`BestBottlesProductHub` `MediaPreview`, `MastersTabPanel`) and the
`generate-madison-image` edge function **read each variant's reference from the
Supabase `best_bottles_pipeline_sku_jobs.best_reference_candidate_path` column — NOT
from `best-bottles-reference-intake.json`.** Rebuilding the intake is necessary but
NOT sufficient; the job-table column is a separate write.

That column **must be a public `https://….png` URL** (or a data URL). Two hard
constraints force this — do not fight them:

1. **The validator rejects local paths.** `src/lib/bestBottlesReferenceValidation.ts`
   (`getBestBottlesReferenceUrlIssue`) blocks `/`-prefixed app paths and bare file
   paths. So a `public/data/clean-references/...` copy is rejected before generation.
2. **The edge function fetches server-side.** `generate-madison-image`'s
   `processReferenceImage(url)` does `fetch(url)` → base64 "Image 1". It needs a URL
   it can reach over the network, and the app cannot serve the separate Best Bottles
   repo's files.

A public Supabase Storage URL is the only form that satisfies all three consumers:
the browser `<img>`, the validator, and the edge fetch. Target bucket:
`reference-images` (public, 5 MB/file cap, png allowed; migration `20251020180129…`).

## Where the clean PNG comes from

The intake rebuild already picked the winning clean PNG per SKU (de-duping the messy
`01-transparent-png-candidates/**` subdirs). For each cut row it sets
`referenceSourcePath` = absolute path to the clean transparent `{graceSku}.png` in
the separate repo, and flips `coverageStatus → covered_canonical`. The cutover script
reads `referenceSourcePath` straight from the intake — **never re-derive lanes or
re-pick candidates yourself.**

## How to run it

The whole procedure is one idempotent script, parameterized by family. **Default is
dry run; nothing is written without `--execute`. Only the named family is touched.**

```bash
# 1. Dry run — see the plan + counts, confirm sources exist, no writes.
npm run bestbottles:references:sync-clean -- --family "Boston Round"

# 2. Execute — upload clean PNGs to the bucket + repoint the jobs table, then verify.
npm run bestbottles:references:sync-clean -- --family "Boston Round" --execute --verify
```

`--family` must match the intake/jobs `family` display name exactly (e.g. `Cylinder`,
`"Boston Round"`, `Elegant`). Cylinder has a convenience alias:
`npm run bestbottles:references:sync-clean-cylinder`. Script:
`scripts/sync-bestbottles-clean-references.ts`.

What the script does, in order:
1. Selects intake rows where `family=<FAMILY>` AND `coverageStatus=covered_canonical`.
2. Uploads each `{graceSku}.png` (from `referenceSourcePath`) to
   `reference-images/best-bottles/clean-references/<family-slug>/{graceSku}.png`
   (idempotent upsert; skips/flags any source >5 MB or missing on disk).
3. Repoints `best_reference_candidate_path` to that public URL for the matching jobs
   (join by `graceSku`), only where the value actually differs.
4. Re-reads the family's jobs and classifies them: clean / still-old / null.
5. Writes a report to `tmp/bestbottles-clean-<slug>-reference-sync-report.json`.

Idempotency: re-running uploads the same bytes and writes the same deterministic URL,
so a second run reports `already at target` and 0 repoints. Safe to re-run after every
intake rebuild.

## Scope discipline (do not violate)

- **One family per run, cut families only.** SKUs the intake still marks
  `missing_local_reference_image` have no clean PNG yet — leave their
  `best_reference_candidate_path` untouched. They will correctly show as "still old"
  in the post-sync report. Do not backfill them from legacy.
- **Only `best_reference_candidate_path` is written.** Do not also flip
  `coverage_status` or other columns here unless explicitly asked — keep the change
  minimal and reversible.
- **Madison-only writes.** Uploading to Supabase storage + the jobs table is this
  repo's lane. Do not push to Shopify or mutate the separate repo's clean PNGs.

## Verifying the cutover (what "done" looks like)

`--verify` HEAD/GET-checks a sample of public URLs. To prove the full chain end to end:

1. **Jobs table** rows now read `…/reference-images/best-bottles/clean-references/<slug>/<sku>.png`.
2. **Validator** `getBestBottlesReferenceUrlIssue(url)` returns `null` (usable).
3. **Edge fetch** of the URL returns `200`, `content-type: image/png`, under 5 MB —
   so `processReferenceImage` can produce the base64 "Image 1".
4. **It's the clean cut-out**, not a legacy render: the PNG is `2080×2288` with a
   high transparent-pixel percentage (e.g. ~90%+).
5. **UI**: selecting a variant in the Product Hub shows the clean transparent
   reference in the "Reference" `MediaPreview`; the Studio Masters panel feeds that
   same URL into generation as Image 1.

A throwaway `tsx` script that imports `getBestBottlesReferenceValidation` + `sharp`
and fetches one repointed URL is the fastest way to confirm 2–4 against live data.

## Reconciliation sanity check

After a cut, `total jobs = clean + still-old + null`. Confirm:
`clean count == intake covered_canonical count for the family`, `0` clean rows that
are not canonical (no stray writes), and every still-old/null SKU is genuinely an
intake `missing_local_reference_image` (none accidentally skipped).

## History

2026-06-21: Cylinder cut — 333 covered_canonical jobs repointed to clean 2080×2288
transparent PNGs; 51 left on old refs (intake `missing_local_reference_image`).
Other families (Tulip, Boston Round, Elegant, Diva, Circle, Sleek, Round, Slim,
Empire) await their clean lanes — same one-command procedure when they land.
