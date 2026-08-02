# Best Bottles Family Scale Specification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a complete, controlled Best Bottles family specification table that maps all product families and common bottle types to catalog-friendly framing bands using Convex-derived real-world measurements as classification input.

**Architecture:** Real-world product dimensions choose a visual scale band; the visual scale band defines the target fill-height, width envelope, baseline, centerline, and sidecar behavior. The image generator remains responsible for photorealistic material enhancement, while Madison rig normalization and QA enforce final catalog framing.

**Tech Stack:** React/Vite, TypeScript, Convex snapshot JSON, Supabase generated image rows, Playwright browser QA, Node test runner via `tsx --test`, Madison product image rig postprocess.

## Global Constraints

- Canon prompt remains stable unless a prompt-only experiment is explicitly requested.
- Production provider remains `openai-image-2`.
- All catalog masters use `2080x2288`.
- Best Bottles Bone background is `#F5F3EF`.
- Real-world measurements classify the SKU; they do not directly render true physical scale.
- Product scale must be catalog-friendly: 3ml, 4ml, 5ml, and other small bottles remain large enough to inspect in PDP/catalog thumbnails.
- Every single-product image centers the primary bottle on the canvas centerline.
- Every product uses a shared baseline approximately `8-10%` above the bottom edge.
- Detached caps, pumps, droppers, or applicators use a right-sidecar rule and do not push the primary bottle off center.
- Color, glass tint, cap finish, and fitment size affect material/prompt metadata, but do not create a separate framing class unless they change visible geometry.
- Bulk generation is allowed only for families with an explicit profile and QA coverage.

---

### Task 1: Freeze The Visual Scale Policy

**Files:**
- Modify: `docs/product-image-system/best-bottles-family-framing-map.md`
- Modify: `docs/product-image-system/best-bottles-cylinder-family-spec.md`
- Create: `docs/product-image-system/best-bottles-family-scale-specification.md`

**Interfaces:**
- Consumes: current Cylinder profile behavior from `src/config/bestBottlesFamilyProfiles.ts`
- Produces: a single human-readable scale policy used by code, QA, and smoke-test review

- [x] **Step 1: Define scale bands**

Use these initial visual scale bands:

| Band ID | Product type | Target fill-height | Notes |
| --- | --- | ---: | --- |
| `sample-vial` | 1-4ml sample vials, tiny sprayers | 55-60% | Minimum catalog-friendly size; not true physical scale. |
| `small-bottle` | 5-15ml small upright bottles, regular 9ml roll-ons | 64-70% | Small product family, still readable in grids. |
| `standard-bottle` | 16-60ml upright bottles | 72-80% | Middle catalog zone. |
| `large-bottle` | 100ml+ upright bottles | 80-86% | Large products, still with top/bottom breathing room. |
| `premium-tall` | tall decorative perfume, tall aluminum, tall treatment | 84-92% | Used only when measured height and family justify it. |
| `low-wide` | jars, squat/low bottles | width-first, 45-68% height | Height alone is not valid for jars. |
| `sidecar` | cap-off / applicator-off configurations | inherited primary band | Primary stays centered; sidecar sits on baseline. |

- [x] **Step 2: Correct Cylinder documentation**

Update Cylinder so large/tall Cylinder bottles use the current intended large range:

```text
sample-vial: 55-60%
small-cylinder / small-bottle: 64-70%
standard-cylinder: 72-78%
large-cylinder: 80-84%
```

- [x] **Step 3: State the rule explicitly**

Add this policy sentence to the spec:

```text
Madison does not render products at literal real-world scale. Convex measurements are used to choose a catalog-friendly visual scale band, and the rig enforces that band's target on the fixed 2080x2288 studio canvas.
```

- [ ] **Step 4: Commit documentation**

Run:

```bash
git add docs/product-image-system/best-bottles-family-framing-map.md docs/product-image-system/best-bottles-cylinder-family-spec.md docs/product-image-system/best-bottles-family-scale-specification.md
git commit -m "docs: define best bottles family scale policy"
```

### Task 2: Generate A Convex Family Scale Inventory

**Files:**
- Create: `scripts/best-bottles/family-scale-inventory.ts`
- Create: `scripts/best-bottles/family-scale-inventory.test.ts`
- Output: `public/data/bb-family-scale-inventory.json`
- Output: `docs/product-image-system/best-bottles-family-scale-inventory.md`

**Interfaces:**
- Consumes: `/Users/jordanrichter/Projects/Clients/Nemat-International/Best-Bottles-Website-02-20-2026/data/audits/2026-06-27-framing-profiles/convex_snapshot.json`
- Produces: per-family observed `count`, `capacityMl`, `heightWithCap`, `heightWithoutCap`, `diameter`, `applicator`, `capState`, and proposed `geometryArchetype`

- [x] **Step 1: Write tests for measurement parsing**

```ts
import assert from "node:assert/strict";
import { test } from "node:test";
import { parseMeasurementMm, summarizeMeasurements } from "./family-scale-inventory";

test("parses tolerance measurement strings", () => {
  assert.equal(parseMeasurementMm("83 ±1 mm"), 83);
  assert.equal(parseMeasurementMm("20 ±0.5 mm"), 20);
  assert.equal(parseMeasurementMm("118mm"), 118);
  assert.equal(parseMeasurementMm(null), null);
});

test("summarizes observed height ranges", () => {
  const summary = summarizeMeasurements([
    { heightWithCap: "83 ±1 mm", heightWithoutCap: "70 ±1 mm", diameter: "20 ±0.5 mm" },
    { heightWithCap: "118 ±2 mm", heightWithoutCap: "106 ±2 mm", diameter: "18 ±0.5 mm" },
  ]);
  assert.deepEqual(summary.heightWithCapMm, { min: 83, max: 118 });
  assert.deepEqual(summary.diameterMm, { min: 18, max: 20 });
});
```

- [x] **Step 2: Implement read-only inventory export**

The script must group products by family and bottle collection, preserving examples by SKU:

```ts
export interface FamilyScaleInventoryRow {
  family: string;
  bottleCollection: string | null;
  count: number;
  capacitiesMl: number[];
  heightWithCapMm: { min: number; max: number } | null;
  heightWithoutCapMm: { min: number; max: number } | null;
  diameterMm: { min: number; max: number } | null;
  applicators: string[];
  exampleSkus: string[];
  proposedArchetype: "upright-small" | "upright-standard" | "upright-large" | "premium-tall" | "low-wide" | "sidecar" | "unknown";
}
```

- [x] **Step 3: Run inventory**

Run:

```bash
npx tsx --test scripts/best-bottles/family-scale-inventory.test.ts
npx tsx scripts/best-bottles/family-scale-inventory.ts
```

Expected:

```text
public/data/bb-family-scale-inventory.json written
docs/product-image-system/best-bottles-family-scale-inventory.md written
39 family groups mapped or explicitly marked unknown
```

### Task 3: Implement The Family Scale Resolver

**Files:**
- Modify: `src/config/bestBottlesFamilyProfiles.ts`
- Modify: `src/config/bestBottlesFamilyProfiles.test.ts`
- Modify: `supabase/functions/_shared/familyRig.ts`
- Modify: `supabase/functions/_shared/familyRig.test.ts`

**Interfaces:**
- Consumes: product metadata `family`, `bottleCollection`, `capacityMl`, `heightWithCap`, `heightWithoutCap`, `diameter`, `applicator`, `itemName`, `itemDescription`
- Produces: `BestBottlesFamilyProfile` with `profileId`, `relativeScaleZoneId`, `targetProductHeightPct`, `targetProductHeightRangePct`, `fillWidthPct`, `baselinePct`, `primaryObjectCenterXPct`

- [ ] **Step 1: Add coverage tests for known scale bands**

Add representative tests for:

```text
3ml Cylinder sprayer -> sample-vial, 55-60%
4ml Cylinder sprayer -> sample-vial, 55-60%
5ml Cylinder cap-off sprayer -> small-bottle, 64-70%
9ml regular roll-on 83mm -> small-bottle / roller-bottle, 64-70%
9ml slim sprayer 118mm -> standard-bottle, 72-78%
28ml Cylinder -> standard-bottle, 72-80%
60ml upright bottle -> standard-bottle, 72-80%
100ml Cylinder -> large-bottle, 80-86%
Cream Jar -> low-wide, width-first
Aluminum Bottle 250ml -> premium-tall, 88-92%
```

- [ ] **Step 2: Add unmapped-family failure behavior**

Any family not covered by the table must return a profile with:

```ts
{
  profileId: "unmapped",
  bulkGenerationAllowed: false,
  reason: "No Best Bottles family scale profile is defined for this product family."
}
```

- [ ] **Step 3: Mirror resolver behavior into Supabase Edge Function shared code**

Keep browser and Edge Function logic aligned by updating both Madison frontend config and `supabase/functions/_shared/familyRig.ts`.

- [ ] **Step 4: Run resolver tests**

Run:

```bash
npx tsx --test src/config/bestBottlesFamilyProfiles.test.ts supabase/functions/_shared/familyRig.test.ts
```

Expected: all known family examples pass, unmapped families block bulk generation.

### Task 4: Add Family-Spec QA Coverage

**Files:**
- Modify: `src/lib/product-image/framingQa.ts`
- Modify: `src/lib/product-image/framingQa.test.ts`
- Modify: `scripts/best-bottles/readonly-framing-qa.mjs`

**Interfaces:**
- Consumes: generated image URL, detected product bounds, resolved family profile
- Produces: `pass`, `normalize`, or `reject` with exact `fillHeightPct`, `baselineDeltaPx`, `centerDeltaPct`, and `scaleBand`

- [ ] **Step 1: Add low-wide QA behavior**

Low-wide products must be judged by width envelope first, not fill-height first.

- [ ] **Step 2: Add sidecar QA behavior**

For cap-off products:

```text
primary bottle centerline must remain near 50%
sidecar must be on the same baseline
sidecar must not cause the primary bounds to shift left
```

- [ ] **Step 3: Add family coverage reporting**

`readonly-framing-qa.mjs` should include:

```json
{
  "family": "Cylinder",
  "scaleBand": "small-bottle",
  "bulkGenerationAllowed": true,
  "sourceOfTruth": "convex_snapshot",
  "targetFillHeightRangePct": { "min": 64, "max": 70 }
}
```

- [ ] **Step 4: Run QA tests**

Run:

```bash
npx tsx --test src/lib/product-image/framingQa.test.ts
```

Expected: PASS.

### Task 5: Smoke Test By Archetype, Not By Every SKU

**Files:**
- Modify: `scripts/best-bottles/live-cylinder-smoke.ts`
- Create: `scripts/best-bottles/live-family-scale-smoke.ts`

**Interfaces:**
- Consumes: family scale inventory and explicit representative SKU list
- Produces: generated rows tagged by `scale-band:*`, `family:*`, `source-of-truth:convex`

- [ ] **Step 1: Build representative smoke set**

Run one smoke SKU for each archetype before expanding:

```text
sample-vial
small-bottle
standard-bottle
large-bottle
premium-tall
low-wide
sidecar
```

- [ ] **Step 2: Run smoke generation**

Run:

```bash
BB_SMOKE_AI_PROVIDER=openai-image-2 npx tsx scripts/best-bottles/live-family-scale-smoke.ts
```

- [ ] **Step 3: Run read-only QA**

Run:

```bash
node scripts/best-bottles/readonly-framing-qa.mjs <run-id>
```

Expected: every output is `pass` or `normalize`; `reject` blocks that family from bulk generation.

### Task 6: Five-Day Delivery Gate

**Files:**
- Modify: `docs/product-image-system/best-bottles-family-scale-specification.md`
- Modify: `docs/product-image-system/best-bottles-family-scale-inventory.md`

**Interfaces:**
- Consumes: inventory, resolver tests, smoke QA
- Produces: bulk-generation readiness checklist

- [x] **Day 1: Inventory and policy**

Deliver:

```text
39/39 families listed
all families assigned to known archetype or explicit blocked/unknown status
Cylinder doc corrected
```

- [ ] **Day 2: Resolver and tests**

Deliver:

```text
all high-volume families mapped
unmapped families blocked from bulk
browser and Supabase resolver tests passing
```

- [ ] **Day 3: QA and smoke**

Deliver:

```text
representative smoke test by archetype
read-only QA report with pass/normalize/reject
```

- [ ] **Day 4: Reference quality pass**

Deliver:

```text
families with weak reference images flagged
bulk generation allowed only for clean flattened references
```

- [ ] **Day 5: Controlled bulk run**

Deliver:

```text
bulk run only for passing families
failed families routed to reference cleanup or manual review
```
