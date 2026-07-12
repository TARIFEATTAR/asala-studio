# Best Bottles Cylinder 75-Type Lineup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce eight identity-locked Cylinder coverage plates and one 75-product panoramic master, with clean and annotated master variants, using verified measurements and actual catalog references.

**Architecture:** Build one deterministic 75-row manifest from the reconciled catalog and authoritative PSD/reference inventory. Code resolves physical types, scale, primary-product bounds, panel membership, ordering, and master placement; GPT Image 2 may polish only lighting, background integration, materials, and v6.1 shadows. QA compares every polished plate against the manifest before deterministic master assembly.

**Tech Stack:** TypeScript, Node test runner, Sharp, Madison Best Bottles catalog snapshots, GPT Image 2 edit workflow, JSON manifests.

## Global Constraints

- Authoritative PSD archive: `/Users/jordanrichter/Projects/Clients/Nemat-International/Best-Bottles-Original-Photoshop-Sources`; read-only.
- Prompt contract: `best-bottles-reference-locked-v6.1`.
- Background: `#F5F3EF`.
- Exactly 75 unique physical combinations across plates 01–08; each combination appears once.
- Plate 09 contains the same 75 products in one continuous row plus one supplemental 500 ml aluminum scale endpoint, for 76 visible objects.
- The master upper endpoint uses the 227 ml / 8 oz plastic Cylinder and distinct 500 ml aluminum bottle.
- Verified assembled height controls vertical scale; body height preserves cap-state consistency; diameter validates width.
- Detached components never change primary-product scale, baseline, or centerline.
- No sibling-SKU, fuzzy-match, generated, or invented product may satisfy a missing reference.
- No Shopify, Convex, Supabase, or storefront mutation.

---

### Task 1: Measurement-Driven Cylinder Display Curve

**Files:**
- Create: `src/lib/bestBottlesCylinderDisplayCurve.ts`
- Create: `src/lib/bestBottlesCylinderDisplayCurve.test.ts`

**Interfaces:**
- Consumes: reconciled `heightWithCapMm`, `heightWithoutCapMm`, `diameterMm`, and canvas height.
- Produces: `resolveCylinderDisplayScale(input): CylinderDisplayScale` and `assertMonotonicCylinderBodies(rows): void`.

- [ ] **Step 1: Write failing curve tests**

```ts
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  assertMonotonicCylinderBodies,
  resolveCylinderDisplayScale,
} from "./bestBottlesCylinderDisplayCurve";

describe("Cylinder measurement-driven display curve", () => {
  it("keeps the 9 ml body taller than the 5 ml body", () => {
    const five = resolveCylinderDisplayScale({
      canvasHeightPx: 2288, heightWithCapMm: 55, heightWithoutCapMm: 53, diameterMm: 17,
    });
    const nine = resolveCylinderDisplayScale({
      canvasHeightPx: 2288, heightWithCapMm: 75, heightWithoutCapMm: 63, diameterMm: 21,
    });
    assert.ok(nine.bodyTargetPx >= five.bodyTargetPx * 1.06);
    assert.equal(five.assembledTargetPct, 58);
    assert.equal(nine.assembledTargetPct, 71);
  });

  it("keeps the 100 ml body taller than the 50 ml body", () => {
    const fifty = resolveCylinderDisplayScale({
      canvasHeightPx: 2288, heightWithCapMm: 128, heightWithoutCapMm: 117, diameterMm: 32,
    });
    const hundred = resolveCylinderDisplayScale({
      canvasHeightPx: 2288, heightWithCapMm: 180, heightWithoutCapMm: 154, diameterMm: 35,
    });
    assert.ok(hundred.bodyTargetPx >= fifty.bodyTargetPx * 1.04);
    assert.equal(fifty.assembledTargetPct, 79);
    assert.equal(hundred.assembledTargetPct, 88);
  });

  it("rejects a body-order reversal", () => {
    assert.throws(() => assertMonotonicCylinderBodies([
      { key: "small", heightWithoutCapMm: 53, bodyTargetPx: 1400 },
      { key: "large", heightWithoutCapMm: 63, bodyTargetPx: 1399 },
    ]), /body target reversal/i);
  });
});
```

- [ ] **Step 2: Run the test and confirm RED**

Run: `npx tsx --test src/lib/bestBottlesCylinderDisplayCurve.test.ts`  
Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement the versioned curve**

```ts
export const CYLINDER_DISPLAY_CURVE_VERSION = "cylinder-measured-display-v1" as const;

export interface CylinderDisplayScaleInput {
  canvasHeightPx: number;
  heightWithCapMm: number;
  heightWithoutCapMm: number;
  diameterMm: number;
}

export interface CylinderDisplayScale {
  version: typeof CYLINDER_DISPLAY_CURVE_VERSION;
  assembledTargetPct: number;
  assembledTargetPx: number;
  bodyTargetPx: number;
  expectedWidthPx: number;
}

const HEIGHT_KNOTS = [
  { heightMm: 35, targetPct: 52 },
  { heightMm: 47, targetPct: 55 },
  { heightMm: 54, targetPct: 57.5 },
  { heightMm: 55, targetPct: 58 },
  { heightMm: 75, targetPct: 71 },
  { heightMm: 100, targetPct: 76 },
  { heightMm: 128, targetPct: 79 },
  { heightMm: 159, targetPct: 84 },
  { heightMm: 180, targetPct: 88 },
  { heightMm: 186, targetPct: 90 },
  { heightMm: 250, targetPct: 92 },
] as const;

function targetPct(heightMm: number): number {
  if (heightMm <= HEIGHT_KNOTS[0].heightMm) return HEIGHT_KNOTS[0].targetPct;
  for (let index = 1; index < HEIGHT_KNOTS.length; index += 1) {
    const upper = HEIGHT_KNOTS[index];
    if (heightMm <= upper.heightMm) {
      const lower = HEIGHT_KNOTS[index - 1];
      const progress = (heightMm - lower.heightMm) / (upper.heightMm - lower.heightMm);
      return lower.targetPct + progress * (upper.targetPct - lower.targetPct);
    }
  }
  return HEIGHT_KNOTS.at(-1)!.targetPct;
}

export function resolveCylinderDisplayScale(input: CylinderDisplayScaleInput): CylinderDisplayScale {
  if (![input.canvasHeightPx, input.heightWithCapMm, input.heightWithoutCapMm, input.diameterMm]
    .every((value) => Number.isFinite(value) && value > 0)) {
    throw new Error("Cylinder display scale requires positive reconciled measurements.");
  }
  if (input.heightWithoutCapMm > input.heightWithCapMm) {
    throw new Error("Cylinder body height cannot exceed assembled height.");
  }
  const assembledTargetPct = targetPct(input.heightWithCapMm);
  const assembledTargetPx = input.canvasHeightPx * assembledTargetPct / 100;
  const pixelsPerMm = assembledTargetPx / input.heightWithCapMm;
  return {
    version: CYLINDER_DISPLAY_CURVE_VERSION,
    assembledTargetPct,
    assembledTargetPx,
    bodyTargetPx: pixelsPerMm * input.heightWithoutCapMm,
    expectedWidthPx: pixelsPerMm * input.diameterMm,
  };
}

export function assertMonotonicCylinderBodies(rows: Array<{
  key: string; heightWithoutCapMm: number; bodyTargetPx: number;
}>): void {
  const ordered = [...rows].sort((a, b) => a.heightWithoutCapMm - b.heightWithoutCapMm);
  for (let index = 1; index < ordered.length; index += 1) {
    if (ordered[index].bodyTargetPx < ordered[index - 1].bodyTargetPx) {
      throw new Error(`Cylinder body target reversal: ${ordered[index - 1].key} -> ${ordered[index].key}`);
    }
  }
}
```

- [ ] **Step 4: Run tests and confirm GREEN**

Run: `npx tsx --test src/lib/bestBottlesCylinderDisplayCurve.test.ts`  
Expected: 3 passing tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/bestBottlesCylinderDisplayCurve.ts src/lib/bestBottlesCylinderDisplayCurve.test.ts
git commit -m "feat(best-bottles): add measured Cylinder display curve"
```

### Task 2: Resolve the 75 Unique Physical Types

**Files:**
- Create: `src/lib/bestBottlesCylinderPhysicalTypes.ts`
- Create: `src/lib/bestBottlesCylinderPhysicalTypes.test.ts`

**Interfaces:**
- Consumes: catalog product rows.
- Produces: `buildCylinderPhysicalTypes(products): CylinderPhysicalType[]` and `resolveCylinderPlate(row): CylinderPlateId`.

- [ ] **Step 1: Write failing uniqueness and plate-count tests**

```ts
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildCylinderPhysicalTypes } from "./bestBottlesCylinderPhysicalTypes";

describe("Cylinder physical types", () => {
  it("collapses cosmetic variants without collapsing physical topology", () => {
    const rows = buildCylinderPhysicalTypes([
      { graceSku: "A", websiteSku: "A1", family: "Cylinder", capacityMl: 9, category: "Glass Bottle", neckThreadSize: "17-415", applicator: "Metal Roller Ball", capStyle: "Tall", color: "Clear" },
      { graceSku: "B", websiteSku: "B1", family: "Cylinder", capacityMl: 9, category: "Glass Bottle", neckThreadSize: "17-415", applicator: "Metal Roller Ball", capStyle: "Tall", color: "Amber" },
      { graceSku: "C", websiteSku: "C1", family: "Cylinder", capacityMl: 9, category: "Glass Bottle", neckThreadSize: "17-415", applicator: "Plastic Roller Ball", capStyle: "Tall", color: "Clear" },
    ]);
    assert.equal(rows.length, 2);
  });

  it("assigns every physical type to one detailed plate", () => {
    const rows = buildCylinderPhysicalTypes(require("../../public/data/best-bottles-catalog-lite.json").products);
    assert.equal(rows.length, 75);
    assert.deepEqual(
      Object.fromEntries([...new Set(rows.map((row) => row.plateId))].map((plateId) => [plateId, rows.filter((row) => row.plateId === plateId).length])),
      { "01": 10, "02": 12, "03": 11, "04": 11, "05": 7, "06": 9, "07": 7, "08": 8 },
    );
  });
});
```

- [ ] **Step 2: Run the test and confirm RED**

Run: `npx tsx --test src/lib/bestBottlesCylinderPhysicalTypes.test.ts`  
Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement stable keys and explicit plate routing**

Define `physicalTypeKey` as normalized `capacityMl|category|neckThreadSize|applicator|capStyle`. Prefer a representative with clear body color, reconciled measurements, an exact PSD filename match, and simple cap state. Route 1–4 ml to plate 01; cap-only and 118/227/454 ml rows to 02; metal roll-ons to 03; plastic roll-ons to 04; sprayers to 05; lotion pumps to 06; reducers/decorative/glass-rod rows to 07; vintage bulbs with or without tassels to 08. Throw when a row resolves to no plate.

- [ ] **Step 4: Run tests and confirm GREEN**

Run: `npx tsx --test src/lib/bestBottlesCylinderPhysicalTypes.test.ts`  
Expected: 2 passing tests with the exact 75-row and plate-count contract.

- [ ] **Step 5: Commit**

```bash
git add src/lib/bestBottlesCylinderPhysicalTypes.ts src/lib/bestBottlesCylinderPhysicalTypes.test.ts
git commit -m "feat(best-bottles): resolve 75 Cylinder physical types"
```

### Task 3: Build the Identity and Measurement Manifest

**Files:**
- Create: `scripts/best-bottles/build-cylinder-75-type-manifest.ts`
- Create: `scripts/best-bottles/build-cylinder-75-type-manifest.test.ts`
- Modify: `package.json`
- Generate: `public/data/best-bottles-cylinder-75-type-lineup-manifest.json`

**Interfaces:**
- Consumes: catalog, generation readiness, PSD coverage CSV, authoritative PSD root, and Tasks 1–2.
- Produces: `buildCylinder75TypeManifest(input): Cylinder75TypeManifest`.

- [ ] **Step 1: Write failing manifest tests**

Test that the builder rejects missing measurements, rejects fuzzy/sibling references, retains exact PSD or exact-SKU catalog provenance, emits 75 unique coverage rows, includes curve version and primary source checksum, and designates `PbClear8ozFlpWh` as 227 ml plastic plus `Alu500` as a supplemental master endpoint outside the 75-row Cylinder count.

- [ ] **Step 2: Run the test and confirm RED**

Run: `npx tsx --test scripts/best-bottles/build-cylinder-75-type-manifest.test.ts`  
Expected: FAIL because the builder does not exist.

- [ ] **Step 3: Implement pure joins and fail-closed evidence**

The builder must join by normalized website SKU first, Grace SKU second. Each row receives `identityStatus`, `measurementStatus`, `referenceStatus`, and `topologyStatus`; only rows with all required states confirmed enter `eligibleRows`. Other rows remain in `blockers` with exact reasons. Hash local source bytes with SHA-256. Sort each plate by `assembledTargetPct`, then capacity, then website SKU.

- [ ] **Step 4: Add scripts and run the read-only build**

Add:

```json
"bestbottles:cylinder:75-manifest": "tsx scripts/best-bottles/build-cylinder-75-type-manifest.ts"
```

Run: `npm run bestbottles:cylinder:75-manifest`  
Expected: JSON containing 75 physical types, eligible count, explicit blockers, and no external writes.

- [ ] **Step 5: Run tests and commit**

```bash
npx tsx --test scripts/best-bottles/build-cylinder-75-type-manifest.test.ts
git add package.json scripts/best-bottles/build-cylinder-75-type-manifest.ts scripts/best-bottles/build-cylinder-75-type-manifest.test.ts public/data/best-bottles-cylinder-75-type-lineup-manifest.json
git commit -m "feat(best-bottles): build Cylinder 75-type lineup manifest"
```

### Task 4: Prepare Primary Product Layers and Bounds

**Files:**
- Create: `src/lib/bestBottlesLineupProductLayer.ts`
- Create: `src/lib/bestBottlesLineupProductLayer.test.ts`
- Create: `scripts/best-bottles/prepare-cylinder-75-type-layers.ts`

**Interfaces:**
- Consumes: eligible manifest rows and exact source images.
- Produces: `prepareLineupProductLayer(input): ProductLayerResult` and `tmp/best-bottles-cylinder-75/layers.json`.

- [ ] **Step 1: Write failing layer tests**

Tests must prove that opaque white-background sources become review layers, primary bounds exclude detached sidecars, an unresolved primary bottle fails closed, source checksum is retained, and measured source aspect is compared with `heightWithCapMm / diameterMm`.

- [ ] **Step 2: Run the test and confirm RED**

Run: `npx tsx --test src/lib/bestBottlesLineupProductLayer.test.ts`  
Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement bounded segmentation**

Use Sharp to downsample for foreground/component analysis, identify the component intersecting the expected primary lane, retain full-resolution primary bounds, and export a non-destructive PNG under `tmp/best-bottles-cylinder-75/layers/`. Do not use the retired paper-doll pipeline. Mark multi-component rows `topology-review` until the primary lane and every sidecar are recorded.

- [ ] **Step 4: Run focused tests and prepare layers**

```bash
npx tsx --test src/lib/bestBottlesLineupProductLayer.test.ts
npx tsx scripts/best-bottles/prepare-cylinder-75-type-layers.ts
```

Expected: all tests pass; every eligible row has source hash, primary bounds, and a review layer; unresolved rows appear in `layer-blockers.json`.

- [ ] **Step 5: Commit code only**

```bash
git add src/lib/bestBottlesLineupProductLayer.ts src/lib/bestBottlesLineupProductLayer.test.ts scripts/best-bottles/prepare-cylinder-75-type-layers.ts
git commit -m "feat(best-bottles): prepare identity-locked lineup layers"
```

### Task 5: Render Eight Deterministic Coverage Plates

**Files:**
- Create: `scripts/best-bottles/render-cylinder-75-type-plates.ts`
- Create: `scripts/best-bottles/render-cylinder-75-type-plates.test.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes: manifest and product layers.
- Produces: eight clean source plates, eight annotated source plates, and `plate-render-manifest.json`.

- [ ] **Step 1: Write failing render-plan tests**

Assert exact plate counts `10,12,11,11,7,9,7,8`, one occurrence per physical key, identical product order in clean and annotated plans, one shared baseline, scale from `bodyTargetPx`, and no width/sidecar-driven height reduction.

- [ ] **Step 2: Run the test and confirm RED**

Run: `npx tsx --test scripts/best-bottles/render-cylinder-75-type-plates.test.ts`  
Expected: FAIL because the renderer does not exist.

- [ ] **Step 3: Implement Sharp composition**

Render `3840x2160` plate canvases on `#F5F3EF`. Place products by primary bounds at resolved measured scale, center each primary body in its slot, seat every primary body on the common baseline, and reserve explicit sidecar lanes. Annotated plates show capacity, website SKU, assembled/body/diameter measurements, source status, and target percentage.

- [ ] **Step 4: Add the package script and render**

Add:

```json
"bestbottles:cylinder:75-plates": "tsx scripts/best-bottles/render-cylinder-75-type-plates.ts"
```

Run: `npm run bestbottles:cylinder:75-plates`  
Expected: 16 source PNGs and one render manifest under `tmp/best-bottles-cylinder-75/source-plates/`.

- [ ] **Step 5: Run tests and commit**

```bash
npx tsx --test scripts/best-bottles/render-cylinder-75-type-plates.test.ts
git add package.json scripts/best-bottles/render-cylinder-75-type-plates.ts scripts/best-bottles/render-cylinder-75-type-plates.test.ts
git commit -m "feat(best-bottles): render Cylinder coverage plates"
```

### Task 6: GPT Image 2 Plate Polish

**Files:**
- Create: `docs/best-bottles-cylinder-75-type-gpt2-prompts.md`
- Generate: `tmp/best-bottles-cylinder-75/polished-plates/01.png` through `08.png`

**Interfaces:**
- Consumes: eight clean source plates.
- Produces: eight polished plates preserving manifest geometry.

- [ ] **Step 1: Write the locked edit prompt**

Use this invariant block for every plate:

```text
The supplied plate is the identity, order, geometry, scale, baseline, and spacing authority.
Preserve every exact product, silhouette, closure, component, material, relative height, and left-to-right position.
Improve only material realism, studio lighting, #F5F3EF background integration, and subtle v6.1 contact/drop shadows.
Do not add, remove, merge, duplicate, resize, reorder, relabel, recolor, or redesign any product.
No text, logos, props, liquid, hands, packaging, watermark, or horizon.
```

- [ ] **Step 2: Run one GPT Image 2 edit per clean source plate**

Use the built-in image generation edit workflow with exactly one source plate per call. Save each selected result non-destructively under `tmp/best-bottles-cylinder-75/polished-plates/` using its two-digit plate ID.

- [ ] **Step 3: Reject identity or geometry drift**

For each output, compare the count, order, primary bounds, body heights, baseline, and sidecar topology against `plate-render-manifest.json`. Regenerate only the failed plate with one targeted prompt correction.

- [ ] **Step 4: Commit the prompt contract**

```bash
git add docs/best-bottles-cylinder-75-type-gpt2-prompts.md
git commit -m "docs(best-bottles): lock GPT2 Cylinder plate polish"
```

### Task 7: Automated Plate QA

**Files:**
- Create: `src/lib/bestBottlesCylinderLineupQa.ts`
- Create: `src/lib/bestBottlesCylinderLineupQa.test.ts`
- Create: `scripts/best-bottles/qa-cylinder-75-type-plates.ts`

**Interfaces:**
- Consumes: source plates, polished plates, manifest, and product bounds.
- Produces: `CylinderPlateQaReport` and `tmp/best-bottles-cylinder-75/plate-qa.json`.

- [ ] **Step 1: Write failing QA tests**

Tests cover product-count mismatch, order drift, body-target reversal, baseline beyond 6 px, height deviation beyond 2%, missing sidecar, background deviation, and a passing identity-preserved plate.

- [ ] **Step 2: Run the test and confirm RED**

Run: `npx tsx --test src/lib/bestBottlesCylinderLineupQa.test.ts`  
Expected: FAIL because the QA module does not exist.

- [ ] **Step 3: Implement fail-closed QA**

Return separate `identity`, `geometry`, `scale`, `topology`, `background`, and `shadow` axes. A plate is approved only when every axis passes. Store expected and observed bounds for every physical key.

- [ ] **Step 4: Run QA**

```bash
npx tsx --test src/lib/bestBottlesCylinderLineupQa.test.ts
npx tsx scripts/best-bottles/qa-cylinder-75-type-plates.ts
```

Expected: test suite passes; each plate receives an explicit verdict and failed plates remain excluded from master assembly.

- [ ] **Step 5: Commit**

```bash
git add src/lib/bestBottlesCylinderLineupQa.ts src/lib/bestBottlesCylinderLineupQa.test.ts scripts/best-bottles/qa-cylinder-75-type-plates.ts
git commit -m "feat(best-bottles): validate Cylinder lineup plates"
```

### Task 8: Assemble Clean and Annotated Panoramic Masters

**Files:**
- Create: `scripts/best-bottles/stitch-cylinder-75-type-master.ts`
- Create: `scripts/best-bottles/stitch-cylinder-75-type-master.test.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes: eight approved plate manifests and approved polished layers.
- Produces: clean master, annotated master, presentation derivative, and master manifest.

- [ ] **Step 1: Write failing master tests**

Assert exactly 75 Cylinder physical keys, no duplicates, one supplemental 500 ml aluminum endpoint, 76 visible master objects, identical order and geometry between clean and annotated variants, 227 ml plastic presence, and refusal to stitch any unapproved plate.

- [ ] **Step 2: Run the test and confirm RED**

Run: `npx tsx --test scripts/best-bottles/stitch-cylinder-75-type-master.test.ts`  
Expected: FAIL because the stitcher does not exist.

- [ ] **Step 3: Implement deterministic master assembly**

Build one ultra-wide native canvas from the global manifest, not by asking GPT Image 2 to redraw 76 products. Use the approved identity-locked source layers with deterministic v6.1 grounding, preserve exact measured targets and one baseline, and generate the annotated variant from the same positions. Do not attempt to extract products from GPT-polished plate backgrounds. Add a downscaled presentation derivative that is explicitly marked non-authoritative for measurement review.

- [ ] **Step 4: Add script and assemble**

Add:

```json
"bestbottles:cylinder:75-master": "tsx scripts/best-bottles/stitch-cylinder-75-type-master.ts"
```

Run: `npm run bestbottles:cylinder:75-master`  
Expected: `09-cylinder-75-master-clean.png`, `09-cylinder-75-master-annotated.png`, presentation derivative, and `master-manifest.json` under `tmp/best-bottles-cylinder-75/master/`.

- [ ] **Step 5: Run tests and commit**

```bash
npx tsx --test scripts/best-bottles/stitch-cylinder-75-type-master.test.ts
git add package.json scripts/best-bottles/stitch-cylinder-75-type-master.ts scripts/best-bottles/stitch-cylinder-75-type-master.test.ts
git commit -m "feat(best-bottles): assemble 75-product Cylinder master"
```

### Task 9: Full Verification and Stakeholder Handoff

**Files:**
- Create: `docs/best-bottles-cylinder-75-type-lineup-runbook.md`
- Create: `docs/best-bottles-cylinder-75-type-lineup-verification.md`

**Interfaces:**
- Consumes: all manifests, QA reports, and final images.
- Produces: reproducible verification and stakeholder file index.

- [ ] **Step 1: Run focused tests**

```bash
npx tsx --test \
  src/lib/bestBottlesCylinderDisplayCurve.test.ts \
  src/lib/bestBottlesCylinderPhysicalTypes.test.ts \
  scripts/best-bottles/build-cylinder-75-type-manifest.test.ts \
  src/lib/bestBottlesLineupProductLayer.test.ts \
  scripts/best-bottles/render-cylinder-75-type-plates.test.ts \
  src/lib/bestBottlesCylinderLineupQa.test.ts \
  scripts/best-bottles/stitch-cylinder-75-type-master.test.ts
```

Expected: all focused tests pass.

- [ ] **Step 2: Run existing Best Bottles regressions and TypeScript**

```bash
npm run test:bestbottles:image-coverage
npx tsc --noEmit
```

Expected: both commands exit 0.

- [ ] **Step 3: Verify artifact integrity**

Record SHA-256, dimensions, file size, plate membership, product count, curve version, prompt version, and QA verdict for every deliverable. Confirm detailed plate counts total 75, the supplemental endpoint occurs once, and clean/annotated master keys are identical.

- [ ] **Step 4: Write the runbook and verification report**

Document the exact build commands, authoritative source path, blocked-source procedure, GPT edit prompt, regeneration procedure, final file index, and the statement that no image is storefront-approved or published.

- [ ] **Step 5: Review scope and commit**

```bash
git diff --check
git status --short
git add docs/best-bottles-cylinder-75-type-lineup-runbook.md docs/best-bottles-cylinder-75-type-lineup-verification.md
git commit -m "docs(best-bottles): verify Cylinder 75-type lineup set"
```

Expected: unrelated pre-existing working-tree changes remain untouched; no secrets, cloud mutation, paid batch generation outside the eight approved GPT edits, or storefront publication occurred.
