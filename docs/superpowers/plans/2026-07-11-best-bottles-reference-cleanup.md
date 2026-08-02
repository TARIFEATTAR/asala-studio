# Best Bottles Reference Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make single and batch Best Bottles generation fail closed on pixel truth, source-quality resolution, and approved PSD-derived provenance, while producing a rollback-safe read-only migration inventory.

**Architecture:** Carry persisted provenance from the SKU job into the Studio reference object, validate URL, canvas, and approved source independently from retired-lineage detection, and repeat the same checks in the paid batch runner. Keep actual pixel alpha inspection separate from URL/metadata lineage classification.

**Tech Stack:** React, TypeScript, Node test runner, Supabase JS client, Sharp, Vite.

## Global Constraints

- Preserve the existing dirty branch and all unrelated work.
- Do not generate paid images, mutate Supabase/Convex/Shopify, deploy, commit, push, merge, or edit environment files.
- BestBottles.com imagery is evidence only; generation requires reviewed PSD-derived opaque canonicals.
- `GB-CYL-FRS-9ML-01` remains blocked until an exact approved canonical exists.

---

### Task 1: Canonical provenance gate

**Files:** `src/lib/bestBottlesReferenceValidation.ts`, `src/lib/bestBottlesReferenceValidation.test.ts`, `src/pages/BestBottlesStudio.tsx`, `src/components/darkroom/MastersTabPanel.tsx`

- [x] Add a failing test proving a correctly sized storage object without approved provenance is rejected.
- [x] Verify the test fails for the intended missing-provenance reason.
- [x] Require `flattened-product-truth` or an explicitly reviewed local canonical filename contract without conflating native reference size with the 2080 × 2288 output canvas.
- [x] Preserve SKU-job provenance when hydrating persisted Studio references.
- [x] Verify the focused test passes.

### Task 2: Batch parity

**Files:** `scripts/best-bottles/generate-family-batch.ts`

- [x] Select persisted reference source and canonical filename with each SKU job.
- [x] Inspect downloaded pixels with Sharp before any paid generation request.
- [x] Reject wrong canvas, missing provenance, and actual non-opaque alpha pixels.

### Task 3: Prompt and read-only inventory

**Files:** `src/config/bestBottlesCatalogCanon.ts`, `src/lib/bestBottlesPromptPreflight.ts`, `docs/best-bottles-reference-migration-manifest.json`

- [x] Inspect the final `buildFinalPrompt()` output path, not unused legacy prompt constants.
- [x] Confirm identity/material/framing/background-shadow priorities are non-contradictory in the emitted prompt.
- [x] Query live SKU jobs read-only and inspect referenced object bytes without printing credentials.
- [x] Record hashes, dimensions, alpha state, provenance, consumers, classification, replacements, and approval-gated migration actions.

### Task 4: Verification

**Files:** all handoff-scoped files

- [ ] Run focused tests.
- [ ] Run TypeScript.
- [ ] Run targeted lint.
- [ ] Run `git diff --check`.
- [ ] Run production build to a real exit status.
