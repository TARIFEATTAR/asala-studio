# Best Bottles Taxonomy Alias Resolver Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow exact, audited Spray Bottle/Cylinder and Tall Cylinder/Cylinder taxonomy aliases through generation and approval while every unrelated website-truth conflict remains blocked.

**Architecture:** Add one pure resolver beside the existing website-truth blocker. The blocker and Studio generation snapshot both consume the resolver's effective status, so generation and approval cannot disagree. The source audit row remains unchanged for traceability.

**Tech Stack:** TypeScript, Node test runner through `tsx`, React/Vite.

## Global Constraints

- Do not modify Convex, Shopify, Sanity, Supabase product rows, SKUs, slugs, or images.
- Normalize only `Spray Bottle → Cylinder` and `Tall Cylinder → Cylinder`.
- Require PDP lane, exact Grace/Convex Grace identity, nonblank website SKU, Glass Bottle source category, Cylinder product-group slug, and an allowlisted issue set.
- Keep duplicates, missing Convex rows, components, Vial/Cylinder, unrelated pairs, bad identities, and bad slugs blocked.

---

### Task 1: Pure effective-status resolver

**Files:**
- Modify: `src/lib/bestBottlesWebsiteTruth.test.ts`
- Modify: `src/lib/bestBottlesWebsiteTruth.ts`

**Interfaces:**
- Produces: `getEffectiveBestBottlesWebsiteTruthStatus(row: BestBottlesWebsiteTruthRow | null): BestBottlesWebsiteTruthStatus | null`
- Consumed by: `getBestBottlesWebsiteTruthBlocker` and Studio generation context.

- [x] **Step 1: Write failing tests**

Add cases for the exact white 3 ml row and a Tall Cylinder row. Assert `alias_exception` and no blocker. Add negative cases for duplicate SKU, missing Convex, component, mismatched Grace, wrong slug, unrelated family, and Vial/Cylinder.

- [x] **Step 2: Verify red**

Run: `npx tsx --test src/lib/bestBottlesWebsiteTruth.test.ts`

Expected: FAIL because `getEffectiveBestBottlesWebsiteTruthStatus` is not exported.

- [x] **Step 3: Implement the minimal resolver**

Use an explicit family-pair allowlist, an allowed issue-name set, exact normalized SKU equality, and `cylinder-` slug/source constraints. Make `getBestBottlesWebsiteTruthBlocker` branch on the effective status rather than the raw status.

- [x] **Step 4: Verify green**

Run: `npx tsx --test src/lib/bestBottlesWebsiteTruth.test.ts`

Expected: all website-truth tests pass.

### Task 2: Feed effective status into approval evidence

**Files:**
- Modify: `src/components/darkroom/MastersTabPanel.tsx`

**Interfaces:**
- Consumes: `getEffectiveBestBottlesWebsiteTruthStatus`.
- Produces: `productContext.websiteTruthStatus` containing `alias_exception` for normalized rows.

- [x] **Step 1: Import and compute effective status once per generation**

Resolve the status immediately after loading the website-truth row and use it for the generation catalog-truth snapshot.

- [x] **Step 2: Run focused tests**

Run: `npx tsx --test src/lib/bestBottlesWebsiteTruth.test.ts src/lib/bestBottlesImageReconciliation.test.ts src/lib/bestBottlesPipeline.test.ts`

Expected: all tests pass.

### Task 3: Catalog dry-run and build verification

**Files:**
- No additional source files.

- [x] **Step 1: Classify all static truth rows through the resolver**

Run a read-only `tsx` script over `public/data/best-bottles-website-truth-status.json`. Verify the patch changes only allowlisted family aliases and leaves duplicate/missing/component rows blocked.

- [x] **Step 2: Run regression suite and build**

Run: `git diff --check && npx tsx --test src/lib/bestBottlesWebsiteTruth.test.ts src/lib/bestBottlesLiveTruthRecovery.test.ts src/lib/bestBottlesImageReconciliation.test.ts src/lib/bestBottlesPipeline.test.ts && npm run build`

Expected: zero test failures, successful Vite build, no whitespace errors.

- [x] **Step 3: Report rollout boundary**

State that localhost is patched. Do not claim static audit regeneration, hosted frontend deployment, or a live Generate-to-Approve smoke test unless each is separately performed.
