# Best Bottles Cap-On Mass Generation Design

## Summary

Generate the remaining prompt-ready Best Bottles primary PDP images in bulk, cap-on only. The current local readiness data reports 1,599 rows with `status: "ready"` and `generatedCandidateCount: 0`; these are the only rows in scope for the first mass run.

## Scope

Included:

- Cap-on primary PDP masters only.
- Rows from `public/data/best-bottles-generation-readiness.json`.
- Rows where `status === "ready"` and `generatedCandidateCount === 0`.
- Outputs at 2080 x 2288, preserving the current 10:11 product image contract.
- Four resumable generation cycles of roughly 400 images each.
- Existing pipeline lane styling for lighting, background, and shadow.

Excluded:

- Cap-off alternate PDP images.
- Rows marked `needs-reference`, `component-exception`, `needs-measurement`, or `needs-prompt-policy`.
- Boston Round and other families with no usable local reference source in readiness data.
- Shopify push, Convex writeback, or Sanity/CDN publication.
- Any product-truth correction, SKU crosswalk change, or reference-image cleanup.

## Current Inputs

The batch selector reads:

- `public/data/best-bottles-generation-readiness.json`
- `public/data/best-bottles-catalog-lite.json`
- `public/data/best-bottles-madison-pipeline-ui.json`

The generation CLI reads the Convex-enriched catalog from the Best Bottles repo:

- `/Users/jordanrichter/Projects/Clients/Nemat-International/Best-Bottles-Website-02-20-2026/pipeline/madison-hero-sync/catalog-enriched.json`

Reference images are resolved from each readiness row's `bestReferenceCandidatePath`, not from a single flat reference directory. Most eligible references are under:

- `pipeline/madison-hero-sync/renders/madison-masters-2080x2288-all-families-2026-05-08`

## Architecture

Add a small manifest layer in Madison app scripts:

1. A planning script filters the readiness rows to the cap-on backlog and writes four cycle manifests.
2. The local generator accepts a manifest path and processes only those rows.
3. The generator uses each manifest row's exact reference path for cap-on generation.
4. The generator keeps the same pipeline lane/preset contract used by Madison's product image pipeline.
5. Each cycle writes images and a `_generation-report.csv` into a dated output directory in the Best Bottles repo.

This keeps the existing prompt assembler, OpenAI call path, and grid lane styling intact while replacing the fragile SKU glob plus flat-reference lookup with an explicit per-row manifest.

## Pipeline Lane Contract

Every cap-on job uses the existing Grid Card cap-on lane:

- Preset ID: `grid-card-2000x2200`
- Source: `src/config/imagePresets.ts`
- Background: Best Bottles Bone `#F5F3EF`
- Lighting: the preset's shared controlled product-lighting language
- Shadow: the preset's back-right contact-shadow language and family-consistency rules

The implementation must call the same `assemblePrompt()` path that the current product image pipeline uses. It must not create a separate ad hoc prompt for background, lighting, or shadow. Any batch manifest should carry the lane ID so reports can prove which styling lane was used.

The local generator may still bypass the UI for speed, but it must not bypass the lane style contract. In practical terms, cap-on jobs run as `preset:grid-card-2000x2200` and `mode: cap-on` for every SKU in every cycle.

## Batch Design

The manifest builder creates four cycles:

- `cycle-01`: about 400 cap-on rows
- `cycle-02`: about 400 cap-on rows
- `cycle-03`: about 400 cap-on rows
- `cycle-04`: remaining cap-on rows

Rows are sorted and distributed by family, product group, capacity, applicator, and SKU so each cycle contains a representative spread instead of one huge family block. The manifest includes enough fields to audit each generated image:

- `cycleId`
- `launchOrder`
- `graceSku`
- `websiteSku`
- `family`
- `productGroupSlug`
- `productGroupDisplayName`
- `applicator`
- `capacityMl`
- `color`
- `pipelineLaneId`
- `bestReferenceCandidatePath`
- `expectedCanonicalFilename`

## Generation Flow

For each cycle:

1. Run a dry-run to confirm every manifest row has a valid prompt and reference image.
2. Confirm every manifest row is assigned `pipelineLaneId: "grid-card-2000x2200"`.
3. Run live generation with `--modes cap-on`.
4. Skip any output file that already exists unless `--force` is passed.
5. Recanvas and normalize each result to 2080 x 2288.
6. Run the existing fixed-frame audit.
7. Write per-job status to `_generation-report.csv`.

Output folders use this pattern:

`/Users/jordanrichter/Projects/Clients/Nemat-International/Best-Bottles-Website-02-20-2026/pipeline/madison-hero-sync/renders/heroes-fresh-ai-cap-on-2026-06-08/cycle-01`

## Error Handling

Dry-run failures block the live cycle. Live generation records failures per job and exits non-zero if any job fails. Re-running the same cycle resumes because existing output files are skipped by default.

Failure categories:

- Missing reference path on disk.
- Missing enriched catalog row or prompt-critical product fields.
- OpenAI API error.
- Sharp/recanvas error.
- Fixed-frame audit failure.

Rows with failures stay in that cycle manifest and are retried after the underlying issue is fixed.

## Verification

Before live generation:

- Run the manifest builder and confirm totals equal 1,599 cap-on rows.
- Run cycle dry-runs and confirm zero missing references.
- Confirm dry-run prompts include `preset:grid-card-2000x2200` lane language for Bone background, shared lighting, and back-right contact shadow.

After each live cycle:

- Confirm the cycle output PNG count equals successful rows in `_generation-report.csv`.
- Confirm every output PNG is 2080 x 2288.
- Confirm `_generation-report.csv` records `pipelineLaneId` for every generated row.
- Review fixed-frame audit warnings before starting the next cycle.
- Spot-check a small set from large families: Cylinder, Elegant, Circle, Round, Diva, Sleek, Slim, and Empire.

## Operational Guardrails

- Start with `cycle-01`; do not launch all four cycles blindly.
- Use conservative concurrency first, then increase only if OpenAI/API and local disk behavior are stable.
- Use the pipeline lane preset for styling consistency; do not substitute a custom lighting/background/shadow prompt.
- Do not generate cap-off alternates in this run.
- Do not push to Shopify until generated images have been reviewed.
- Do not include rows that require reference cleanup or product-truth reconciliation.
