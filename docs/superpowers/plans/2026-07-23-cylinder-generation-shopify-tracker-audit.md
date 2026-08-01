# Cylinder Generation and Shopify Tracker Audit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reconcile every persisted Cylinder SKU target against generated-image evidence, Shopify publication evidence, and quality-review evidence, then show those truths explicitly in the smallest-to-largest family tracker.

**Architecture:** Keep the persisted `best_bottles_pipeline_sku_jobs` rows as the tracker spine. Derive separate generated, Shopify-published, remaining-generation, and approved-quality counts from the same per-SKU coverage input already used by the Pipeline page, so destination state is never mistaken for generation state or approval state.

**Tech Stack:** React, TypeScript, Supabase/Postgres, Node test runner via `tsx --test`.

## Global Constraints

- The Cylinder catalog master canvas remains 2080 × 2288 (10:11).
- Preserve all existing user work in the dirty worktree.
- Do not mutate Shopify, Convex, Supabase rows, or generated image assets during the audit.
- The tracker must sort product groups by numeric capacity from smallest to largest.

---

### Task 1: Reconcile Cylinder evidence

**Files:**
- Create: `docs/audits/best-bottles-cylinder-generation-shopify-audit-2026-07-23.md`

**Interfaces:**
- Consumes: `best_bottles_pipeline_sku_jobs`, linked `generated_images.library_tags`, and the Best Bottles Convex product-truth audit.
- Produces: dated counts and reconciliation caveats used to validate the UI rollup.

- [ ] **Step 1: Run the read-only Best Bottles product-truth audit**

Run:
```bash
npm run audit:product-truth -- --family Cylinder --out data/audits/product-truth/2026-07-23-cylinder-complete
```

Expected: JSON, Markdown, and CSV reports for the complete Convex Cylinder family.

- [ ] **Step 2: Query persisted Madison Cylinder jobs**

Run read-only SQL that counts total targets, generated targets, Shopify-linked targets, Convex-synced targets, approved-keep targets, and remaining-generation targets, grouped by capacity and `product_group_slug`.

Expected: a 3–454 ml smallest-to-largest result set whose totals reconcile to the family summary.

- [ ] **Step 3: Document the reconciled totals and known count differences**

Record the Convex count, persisted tracker count, canonical closeout target count, generation count, Shopify count, remaining-generation count, and quality-review backlog. Explain duplicate/alias or stale-row differences instead of silently collapsing them.

### Task 2: Add explicit tracker metrics

**Files:**
- Modify: `src/lib/bestBottlesImageCoverage.ts`
- Modify: `src/lib/bestBottlesImageCoverage.test.ts`
- Modify: `src/pages/BestBottlesPipeline.tsx`

**Interfaces:**
- Consumes: `SkuJobCoverageInput`.
- Produces: pure predicates for generated evidence, Shopify destination evidence, and approved-keep evidence; `PdpReadinessCounts` fields `generated`, `shopifyPublished`, and `remainingGeneration`.

- [ ] **Step 1: Write failing tests for evidence predicates**

Add tests proving that generated IDs/URLs count as generated, Shopify media/image/timestamp/status counts as published, and Shopify/Convex destination evidence does not fabricate a generated result when no generated or approved image is linked.

- [ ] **Step 2: Run the focused test and verify failure**

Run:
```bash
npx tsx --test src/lib/bestBottlesImageCoverage.test.ts
```

Expected: failure because the exported evidence predicates do not yet exist.

- [ ] **Step 3: Implement the pure evidence predicates**

Export narrowly named helpers from `bestBottlesImageCoverage.ts` and reuse the existing internal destination helpers so the page and next-action logic share one definition.

- [ ] **Step 4: Update the Pipeline rollup and table**

Increment generated, Shopify-published, remaining-generation, and approved-quality counts per SKU. Show those columns in both the family summary and the smallest-to-largest product-group tracker; retain the workflow-next-action pills.

- [ ] **Step 5: Run focused tests**

Run:
```bash
npx tsx --test src/lib/bestBottlesImageCoverage.test.ts
```

Expected: all tests pass.

### Task 3: Verify the user-facing tracker

**Files:**
- Verify: `src/pages/BestBottlesPipeline.tsx`

**Interfaces:**
- Consumes: the live signed-in Pipeline page at `/best-bottles/pipeline`.
- Produces: visual confirmation that Cylinder groups are ordered by capacity and expose generated, Shopify, remaining, and quality-reviewed counts.

- [ ] **Step 1: Run type/build verification**

Run:
```bash
npm run build
```

Expected: Vite production build succeeds.

- [ ] **Step 2: Reload the local Pipeline page**

Open `http://127.0.0.1:8080/best-bottles/pipeline`, select Cylinder if necessary, and inspect the smallest-to-largest table.

Expected: 3 ml appears first, 454 ml appears last, and the family totals match the dated audit.

- [ ] **Step 3: Re-run the read-only summary query**

Expected: the query returns the same counts displayed by the UI, with no Supabase, Shopify, Convex, or asset mutations.
