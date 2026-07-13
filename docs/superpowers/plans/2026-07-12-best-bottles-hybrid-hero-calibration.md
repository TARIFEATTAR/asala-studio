# Best Bottles Hybrid Hero Calibration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and validate an isolated deterministic compositor that converts approved Best Bottles flattened/PSD product pixels into three geometry-locked Cylinder stone-studio calibration images, ready for human approval before the twelve-image batch.

**Architecture:** A new Node 20/TypeScript command-line lane under `scripts/best-bottles/hybrid-hero/` reads an explicit calibration selection, resolves and hashes read-only product sources, snapshots them into a content-addressed run folder, derives mask-constrained glass passes with Sharp, and composites them onto one locked 2080 × 2288 stage at Y=1990. A separate QA module validates geometry masks, source hashes, product truth, and output metadata; a review module writes the shared Creative Production review manifest without touching the Shopify/PDP pipeline, Library, Sanity, Convex, or application UI.

**Tech Stack:** Node.js 20, TypeScript 5.8, `tsx`, `node:test`, Sharp 0.35, existing `bestBottlesCylinderDisplayCurve` resolver, JSON/CSV canonical truth files, Creative Production shared review renderer.

## Global Constraints

- Source directory is read-only: `/Users/jordanrichter/Projects/Clients/Nemat-International/Best-Bottles-Website-02-20-2026/pipeline/aios-shopify-pdp-images/00-input/reference-flattened`.
- Original PSD archive is read-only: `/Users/jordanrichter/Projects/Clients/Nemat-International/Best-Bottles-Original-Photoshop-Sources`.
- Write only under `outputs/imagegen/generative-polish/best-bottles-cylinder-hero-hybrid-v1/` plus the new implementation/test files named in this plan.
- Canvas is exactly 2080 × 2288, sRGB; bottle contact baseline is Y=1990 ±4 px.
- Body, assembled height, and width tolerances are ±2%; silhouette boundary tolerance is two pixels.
- Scaling is uniform. Never stretch width and height independently.
- Image generation owns only the empty stone stage. Product pixels, silhouettes, topology, fitments, and components remain deterministic.
- Working transparency is local to the hero run and must never be promoted as `flattened-product-truth`.
- Detached sidecars share baseline and pixels-per-millimeter scale with the primary bottle and never control primary scale.
- No writes to Shopify/PDP pipeline, Library, Sanity, Convex, Supabase, or product records.
- Calibration order is `GB1mlVBlk`, `GBCyl5Gl`, then `GBTallCyl9Gl`; all three must pass before twelve-item production.
- Do not modify the currently dirty pipeline/reference files. All production modules in this plan are new files.

---

## File Structure

Create these focused files:

```text
scripts/best-bottles/hybrid-hero/
  contract.ts                 # constants, types, target calculation, fail-closed assertions
  contract.test.ts
  source-manifest.ts          # read-only resolution, SHA-256, snapshots, PSD-page extraction
  source-manifest.test.ts
  glass-passes.ts             # white-canvas matte/density/specular/transmission passes
  glass-passes.test.ts
  placement.ts                # uniform scale, baseline, centerline, sidecar placement
  placement.test.ts
  composite.ts                # Sharp stage/layer composition, shadows, geometry mask
  composite.test.ts
  qa.ts                       # metadata, geometry, provenance, truth, and manual gates
  qa.test.ts
  review.ts                   # review manifest, diagnostic overlay, Darkroom staging manifest
  review.test.ts
scripts/best-bottles/build-hybrid-hero-calibration.ts
data/best-bottles-hybrid-hero-calibration-v1.json
```

No application component is required for calibration. Madison Library ingestion remains out of scope until the review board is approved.

---

### Task 1: Lock the canvas, target, and manifest contract

**Files:**
- Create: `scripts/best-bottles/hybrid-hero/contract.ts`
- Create: `scripts/best-bottles/hybrid-hero/contract.test.ts`

**Interfaces:**
- Consumes: `resolveCylinderDisplayScale(input: CylinderDisplayScaleInput)` from `src/lib/bestBottlesCylinderDisplayCurve.ts`.
- Produces: `resolveHeroTarget(row: CanonicalHeroRow): HeroTarget`, constants `HERO_CANVAS`, `HERO_TOLERANCE`, and shared manifest/source types.

- [ ] **Step 1: Write the failing contract tests**

```ts
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { HERO_CANVAS, resolveHeroTarget } from "./contract";

describe("hybrid hero contract", () => {
  it("locks the Madison canvas and baseline", () => {
    assert.deepEqual(HERO_CANVAS, { width: 2080, height: 2288, baselineY: 1990, colorSpace: "srgb" });
  });

  it("reproduces the approved 1 mL target", () => {
    assert.deepEqual(resolveHeroTarget({
      websiteSku: "GB1mlVBlk",
      graceSku: "GB-VIA-CLR-1ML-BLK-T",
      family: "Vial",
      capacityMl: 1,
      canonBodyHeightMm: 35,
      canonHeightWithCapMm: 44,
      canonWidthAxisMm: 8,
      axisSemantics: "round",
    }), {
      curveVersion: "cylinder-measured-display-v1",
      assembledTargetPx: 1241,
      bodyTargetPx: 987,
      expectedWidthPx: 226,
      pixelsPerMm: 28.21,
    });
  });

  it("rejects unreconciled measurements", () => {
    assert.throws(() => resolveHeroTarget({
      websiteSku: "bad",
      graceSku: "bad",
      family: "Cylinder",
      capacityMl: 9,
      canonBodyHeightMm: 0,
      canonHeightWithCapMm: 111,
      canonWidthAxisMm: 18,
      axisSemantics: "round",
    }), /positive reconciled measurements/);
  });
});
```

- [ ] **Step 2: Run the tests and verify the expected failure**

Run:

```bash
npx tsx --test scripts/best-bottles/hybrid-hero/contract.test.ts
```

Expected: FAIL with `Cannot find module './contract'`.

- [ ] **Step 3: Implement the contract**

```ts
import { resolveCylinderDisplayScale } from "../../../src/lib/bestBottlesCylinderDisplayCurve";

export const HERO_CANVAS = Object.freeze({ width: 2080, height: 2288, baselineY: 1990, colorSpace: "srgb" as const });
export const HERO_TOLERANCE = Object.freeze({ baselinePx: 4, geometryPct: 2, silhouettePx: 2 });

export interface CanonicalHeroRow {
  websiteSku: string;
  graceSku: string;
  family: string;
  capacityMl: number;
  canonBodyHeightMm: number;
  canonHeightWithCapMm: number;
  canonWidthAxisMm: number;
  axisSemantics: string;
}

export interface HeroTarget {
  curveVersion: "cylinder-measured-display-v1";
  assembledTargetPx: number;
  bodyTargetPx: number;
  expectedWidthPx: number;
  pixelsPerMm: number;
}

export type HeroSourceKind = "flattened" | "psd-page" | "component-assembly";
export type HeroCapState = "cap-on" | "detached-sidecar" | "component-layout";
export type HeroGateStatus = "pass" | "fail" | "manual-review";

export interface HeroSourcePartSpec {
  role: "primary" | "sidecar";
  kind: "flattened" | "psd-page";
  path: string;
  page?: number;
  componentWebsiteSku?: string;
  primaryBounds?: { left: number; top: number; width: number; height: number };
}

export interface HeroSelection {
  websiteSku: string;
  graceSku: string;
  capState: HeroCapState;
  layoutMode: "single-primary" | "rightmost-primary-with-left-sidecar" | "separate-parts";
  centerOffsetPx: number;
  sourceParts: HeroSourcePartSpec[];
  expectedApplicator: string;
  expectedFinish: string;
  expectedRoundness: "round" | "not-applicable";
}

export function resolveHeroTarget(row: CanonicalHeroRow): HeroTarget {
  const scale = resolveCylinderDisplayScale({
    canvasHeightPx: HERO_CANVAS.height,
    heightWithCapMm: row.canonHeightWithCapMm,
    heightWithoutCapMm: row.canonBodyHeightMm,
    diameterMm: row.canonWidthAxisMm,
  });
  return {
    curveVersion: scale.version,
    assembledTargetPx: Math.round(scale.assembledTargetPx),
    bodyTargetPx: Math.round(scale.bodyTargetPx),
    expectedWidthPx: Math.round(scale.expectedWidthPx),
    pixelsPerMm: Number((scale.assembledTargetPx / row.canonHeightWithCapMm).toFixed(8)),
  };
}
```

- [ ] **Step 4: Run the contract tests**

Run: `npx tsx --test scripts/best-bottles/hybrid-hero/contract.test.ts`

Expected: 3 passing tests, 0 failures.

- [ ] **Step 5: Commit the contract**

```bash
git add scripts/best-bottles/hybrid-hero/contract.ts scripts/best-bottles/hybrid-hero/contract.test.ts
git commit -m "feat(best-bottles): define hybrid hero contract"
```

---

### Task 2: Resolve and snapshot immutable product sources

**Files:**
- Create: `scripts/best-bottles/hybrid-hero/source-manifest.ts`
- Create: `scripts/best-bottles/hybrid-hero/source-manifest.test.ts`

**Interfaces:**
- Consumes: `HeroSelection`, allowed source roots, run root.
- Produces: `snapshotHeroSources(input): Promise<HeroSourceSnapshot[]>` and `extractPsdPage(snapshot): Promise<Buffer>`.

- [ ] **Step 1: Write tests for hashing, path confinement, and PSD-page extraction**

```ts
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import sharp from "sharp";
import { snapshotHeroSources } from "./source-manifest";

describe("hero source snapshots", () => {
  it("copies approved bytes by SHA-256 without changing the source", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "hero-source-"));
    const sourceRoot = path.join(root, "read-only");
    const runRoot = path.join(root, "run");
    await writeFile(path.join(root, "seed"), "seed");
    await sharp({ create: { width: 20, height: 30, channels: 3, background: "white" } })
      .png().toFile(path.join(root, "source.png"));
    const before = await readFile(path.join(root, "source.png"));
    await import("node:fs/promises").then(({ mkdir, copyFile }) => mkdir(sourceRoot).then(() => copyFile(path.join(root, "source.png"), path.join(sourceRoot, "source.png"))));

    const snapshots = await snapshotHeroSources({
      selection: {
        websiteSku: "Fixture",
        graceSku: "FIXTURE",
        capState: "cap-on",
        layoutMode: "single-primary",
        centerOffsetPx: 0,
        expectedApplicator: "closure",
        expectedFinish: "clear",
        expectedRoundness: "round",
        sourceParts: [{ role: "primary", kind: "flattened", path: path.join(sourceRoot, "source.png") }],
      },
      allowedRoots: [sourceRoot],
      runRoot,
    });
    assert.match(snapshots[0].sha256, /^[a-f0-9]{64}$/);
    assert.deepEqual(await readFile(path.join(sourceRoot, "source.png")), before);
    assert.equal((await readFile(snapshots[0].snapshotPath)).length, before.length);
  });

  it("rejects a source outside approved roots", async () => {
    await assert.rejects(() => snapshotHeroSources({
      selection: { websiteSku: "X", graceSku: "X", capState: "cap-on", layoutMode: "single-primary", centerOffsetPx: 0,
        expectedApplicator: "", expectedFinish: "", expectedRoundness: "round",
        sourceParts: [{ role: "primary", kind: "flattened", path: "/tmp/outside.png" }] },
      allowedRoots: ["/approved"], runRoot: "/tmp/run",
    }), /outside approved source roots/);
  });
});
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `npx tsx --test scripts/best-bottles/hybrid-hero/source-manifest.test.ts`

Expected: FAIL because `snapshotHeroSources` is missing.

- [ ] **Step 3: Implement fail-closed source resolution**

Implement `source-manifest.ts` with these exact exported shapes:

```ts
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import type { HeroSelection, HeroSourcePartSpec } from "./contract";

export interface HeroSourceSnapshot extends HeroSourcePartSpec {
  originalPath: string;
  snapshotPath: string;
  sha256: string;
  bytes: number;
  width: number;
  height: number;
  channels: number;
  sourceMtimeMs: number;
}

function insideRoot(file: string, root: string): boolean {
  const relative = path.relative(path.resolve(root), path.resolve(file));
  return relative !== "" && !relative.startsWith("..") && !path.isAbsolute(relative);
}

export async function snapshotHeroSources(input: {
  selection: HeroSelection;
  allowedRoots: string[];
  runRoot: string;
}): Promise<HeroSourceSnapshot[]> {
  const output = path.join(input.runRoot, "source-snapshots");
  await mkdir(output, { recursive: true });
  return Promise.all(input.selection.sourceParts.map(async (part) => {
    if (!input.allowedRoots.some((root) => insideRoot(part.path, root))) {
      throw new Error(`${part.path}: outside approved source roots`);
    }
    const bytes = await readFile(part.path);
    const sha256 = createHash("sha256").update(bytes).digest("hex");
    const metadata = await sharp(bytes, part.page == null ? {} : { page: part.page }).metadata();
    if (!metadata.width || !metadata.height || !metadata.channels) throw new Error(`${part.path}: unreadable image metadata`);
    const extension = path.extname(part.path).toLowerCase() || ".bin";
    const snapshotPath = path.join(output, `${sha256}${extension}`);
    await writeFile(snapshotPath, bytes, { flag: "wx" }).catch(async (error: NodeJS.ErrnoException) => {
      if (error.code !== "EEXIST") throw error;
      const existing = await readFile(snapshotPath);
      if (createHash("sha256").update(existing).digest("hex") !== sha256) throw new Error(`${snapshotPath}: hash collision`);
    });
    const stat = await import("node:fs/promises").then(({ stat }) => stat(part.path));
    return { ...part, originalPath: part.path, snapshotPath, sha256, bytes: bytes.length,
      width: metadata.width, height: metadata.height, channels: metadata.channels, sourceMtimeMs: stat.mtimeMs };
  }));
}

export async function extractSnapshotPixels(snapshot: HeroSourceSnapshot): Promise<Buffer> {
  return sharp(snapshot.snapshotPath, snapshot.page == null ? {} : { page: snapshot.page })
    .png().toBuffer();
}
```

- [ ] **Step 4: Run source tests**

Run: `npx tsx --test scripts/best-bottles/hybrid-hero/source-manifest.test.ts`

Expected: 2 passing tests.

- [ ] **Step 5: Commit source isolation**

```bash
git add scripts/best-bottles/hybrid-hero/source-manifest.ts scripts/best-bottles/hybrid-hero/source-manifest.test.ts
git commit -m "feat(best-bottles): snapshot hybrid hero sources"
```

---

### Task 3: Derive silhouette-locked glass passes

**Files:**
- Create: `scripts/best-bottles/hybrid-hero/glass-passes.ts`
- Create: `scripts/best-bottles/hybrid-hero/glass-passes.test.ts`

**Interfaces:**
- Consumes: a flattened/PSD-page PNG buffer and optional crop bounds.
- Produces: `deriveGlassPasses(input): Promise<HeroGlassPasses>` with `silhouette`, `density`, `specular`, `transmission`, and exact foreground bounds.

- [ ] **Step 1: Write a synthetic clear-glass fixture test**

Create a 100 × 160 white fixture with a two-pixel gray bottle boundary, black closure, transparent-looking white center, and heavy base. Assert that the outer boundary remains 30..69 × 20..139, white canvas becomes alpha zero, closure remains opaque, and every pass has identical dimensions.

```ts
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import sharp from "sharp";
import { deriveGlassPasses, measureAlphaBounds } from "./glass-passes";

describe("glass pass derivation", () => {
  it("preserves a clear bottle boundary without retaining the white canvas", async () => {
    const svg = Buffer.from(`<svg width="100" height="160" xmlns="http://www.w3.org/2000/svg">
      <rect width="100" height="160" fill="white"/>
      <rect x="30" y="20" width="40" height="120" rx="6" fill="white" stroke="#777" stroke-width="2"/>
      <rect x="30" y="20" width="40" height="24" rx="4" fill="#111"/>
      <rect x="31" y="132" width="38" height="8" fill="#aaa"/>
    </svg>`);
    const source = await sharp(svg).png().toBuffer();
    const passes = await deriveGlassPasses({ source, whitePoint: 248 });
    assert.deepEqual(await measureAlphaBounds(passes.silhouette), { left: 29, top: 19, width: 42, height: 122 });
    for (const buffer of [passes.silhouette, passes.density, passes.specular, passes.transmission]) {
      assert.deepEqual(await sharp(buffer).metadata().then(({ width, height }) => ({ width, height })), { width: 100, height: 160 });
    }
  });
});
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `npx tsx --test scripts/best-bottles/hybrid-hero/glass-passes.test.ts`

Expected: FAIL because the module is missing.

- [ ] **Step 3: Implement deterministic pass derivation**

Use Sharp raw pixels. For each pixel calculate `backgroundDelta = 255 - min(r,g,b)`, then:

```ts
const silhouetteAlpha = clamp(Math.round((backgroundDelta - 3) * 5.5), 0, sourceAlpha);
const densityAlpha = clamp(Math.round((backgroundDelta - 5) * 4.5), 0, sourceAlpha);
const specularAlpha = silhouetteAlpha === 0 ? 0 : clamp(Math.round((Math.max(r, g, b) - whitePoint) * 5), 0, 150);
const transmissionAlpha = clamp(Math.round(silhouetteAlpha * 0.32), 0, 90);
```

Export:

```ts
export interface HeroGlassPasses {
  silhouette: Buffer;
  density: Buffer;
  specular: Buffer;
  transmission: Buffer;
  bounds: { left: number; top: number; width: number; height: number };
}

export async function deriveGlassPasses(input: { source: Buffer; whitePoint?: number }): Promise<HeroGlassPasses>;
export async function measureAlphaBounds(png: Buffer): Promise<{ left: number; top: number; width: number; height: number }>;
export async function splitLayoutComponents(png: Buffer): Promise<Array<{ bounds: { left: number; top: number; width: number; height: number }; png: Buffer }>>;
```

`measureAlphaBounds` must scan alpha values ≥8. `splitLayoutComponents` must group occupied alpha columns separated by at least eight empty columns, crop each group, and return groups ordered left-to-right. For `rightmost-primary-with-left-sidecar`, the runner selects the rightmost group as primary and the left group as sidecar; it must require exactly two groups. Reject an empty or ambiguous foreground. Preserve RGB values for density; render specular RGB as white; render transmission RGB as source RGB. Never resize in this module.

- [ ] **Step 4: Run the glass-pass tests**

Run: `npx tsx --test scripts/best-bottles/hybrid-hero/glass-passes.test.ts`

Expected: 1 passing test.

- [ ] **Step 5: Commit the pass extractor**

```bash
git add scripts/best-bottles/hybrid-hero/glass-passes.ts scripts/best-bottles/hybrid-hero/glass-passes.test.ts
git commit -m "feat(best-bottles): derive silhouette locked glass passes"
```

---

### Task 4: Compute uniform bottle and sidecar placement

**Files:**
- Create: `scripts/best-bottles/hybrid-hero/placement.ts`
- Create: `scripts/best-bottles/hybrid-hero/placement.test.ts`

**Interfaces:**
- Consumes: source bounds, `HeroTarget`, cap state, optional sidecar bounds and center offset.
- Produces: `buildHeroPlacement(input): HeroPlacementPlan` or a geometry blocker.

- [ ] **Step 1: Write placement tests**

```ts
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildHeroPlacement } from "./placement";

describe("hero placement", () => {
  it("places a cap-off 5 mL body at target height and Y=1990", () => {
    const plan = buildHeroPlacement({
      capState: "detached-sidecar",
      primaryBounds: { left: 10, top: 20, width: 193, height: 601 },
      sidecarBounds: { left: 0, top: 0, width: 130, height: 184 },
      sidecarScaleMode: { kind: "canonical-component", heightMm: 24, widthMm: 17 },
      target: { curveVersion: "cylinder-measured-display-v1", assembledTargetPx: 1476,
        bodyTargetPx: 1203, expectedWidthPx: 386, pixelsPerMm: 22.70461538 },
      centerOffsetPx: -110,
    });
    assert.equal(plan.primary.height, 1203);
    assert.equal(plan.primary.top + plan.primary.height, 1990);
    assert.equal(plan.primary.scaleX, plan.primary.scaleY);
    assert.equal(plan.sidecar?.top! + plan.sidecar?.height!, 1990);
    assert.equal(plan.sidecar?.height, 545);
    assert.equal(plan.sidecar?.width, 386);
  });

  it("blocks width drift instead of stretching", () => {
    assert.throws(() => buildHeroPlacement({
      capState: "detached-sidecar",
      primaryBounds: { left: 0, top: 0, width: 90, height: 600 },
      target: { curveVersion: "cylinder-measured-display-v1", assembledTargetPx: 1766,
        bodyTargetPx: 1686, expectedWidthPx: 286, pixelsPerMm: 15.90990991 },
      centerOffsetPx: 0,
    }), /width drift/);
  });
});
```

- [ ] **Step 2: Run and verify failure**

Run: `npx tsx --test scripts/best-bottles/hybrid-hero/placement.test.ts`

Expected: FAIL because `placement.ts` is missing.

- [ ] **Step 3: Implement uniform placement**

```ts
import { HERO_CANVAS, HERO_TOLERANCE, type HeroCapState, type HeroTarget } from "./contract";

export interface Bounds { left: number; top: number; width: number; height: number }
export interface PlacedLayer extends Bounds { scaleX: number; scaleY: number }
export interface HeroPlacementPlan { primary: PlacedLayer; sidecar: PlacedLayer | null; predictedWidthPx: number; widthErrorPct: number }
export type SidecarScaleMode =
  | { kind: "shared-source-scale" }
  | { kind: "canonical-component"; heightMm: number; widthMm: number };

export function buildHeroPlacement(input: {
  capState: HeroCapState;
  primaryBounds: Bounds;
  sidecarBounds?: Bounds;
  sidecarScaleMode?: SidecarScaleMode;
  target: HeroTarget;
  centerOffsetPx: number;
}): HeroPlacementPlan {
  const targetHeight = input.capState === "cap-on" ? input.target.assembledTargetPx : input.target.bodyTargetPx;
  const scale = targetHeight / input.primaryBounds.height;
  const predictedWidthPx = input.primaryBounds.width * scale;
  const widthErrorPct = Math.abs(predictedWidthPx - input.target.expectedWidthPx) / input.target.expectedWidthPx * 100;
  if (widthErrorPct > HERO_TOLERANCE.geometryPct) throw new Error(`width drift ${widthErrorPct.toFixed(2)}% exceeds tolerance`);
  const primaryWidth = Math.round(predictedWidthPx);
  const primaryHeight = Math.round(input.primaryBounds.height * scale);
  const centerX = HERO_CANVAS.width / 2 + input.centerOffsetPx;
  const primary = { left: Math.round(centerX - primaryWidth / 2), top: HERO_CANVAS.baselineY - primaryHeight,
    width: primaryWidth, height: primaryHeight, scaleX: scale, scaleY: scale };
  let sidecar: PlacedLayer | null = null;
  if (input.sidecarBounds) {
    const mode = input.sidecarScaleMode ?? { kind: "shared-source-scale" as const };
    const targetSidecarHeight = mode.kind === "shared-source-scale"
      ? input.sidecarBounds.height * scale
      : mode.heightMm * input.target.pixelsPerMm;
    const sidecarScale = targetSidecarHeight / input.sidecarBounds.height;
    const targetSidecarWidth = input.sidecarBounds.width * sidecarScale;
    if (mode.kind === "canonical-component") {
      const expectedSidecarWidth = mode.widthMm * input.target.pixelsPerMm;
      const error = Math.abs(targetSidecarWidth - expectedSidecarWidth) / expectedSidecarWidth * 100;
      if (error > HERO_TOLERANCE.geometryPct) throw new Error(`sidecar width drift ${error.toFixed(2)}% exceeds tolerance`);
    }
    sidecar = {
      left: Math.round(primary.left + primary.width + 80),
      top: HERO_CANVAS.baselineY - Math.round(targetSidecarHeight),
      width: Math.round(targetSidecarWidth), height: Math.round(targetSidecarHeight),
      scaleX: sidecarScale, scaleY: sidecarScale,
    };
  }
  return { primary, sidecar, predictedWidthPx, widthErrorPct };
}
```

- [ ] **Step 4: Run placement tests**

Run: `npx tsx --test scripts/best-bottles/hybrid-hero/placement.test.ts`

Expected: 2 passing tests.

- [ ] **Step 5: Commit placement**

```bash
git add scripts/best-bottles/hybrid-hero/placement.ts scripts/best-bottles/hybrid-hero/placement.test.ts
git commit -m "feat(best-bottles): place hybrid hero products deterministically"
```

---

### Task 5: Composite the product passes onto the locked stage

**Files:**
- Create: `scripts/best-bottles/hybrid-hero/composite.ts`
- Create: `scripts/best-bottles/hybrid-hero/composite.test.ts`

**Interfaces:**
- Consumes: stage PNG, product passes, `HeroPlacementPlan`.
- Produces: clean 2080 × 2288 composite, geometry mask, placed-pass files, and composition metadata.

- [ ] **Step 1: Write the compositor test**

Generate a synthetic 2080 × 2288 stone-colored stage and a 100 × 400 test bottle. Assert exact output size, sRGB metadata, geometry-mask bottom 1990, uniform resized dimensions, and a non-empty deterministic shadow below the bottle without changing the geometry mask.

- [ ] **Step 2: Run and verify the expected failure**

Run: `npx tsx --test scripts/best-bottles/hybrid-hero/composite.test.ts`

Expected: FAIL because `renderHeroComposite` is missing.

- [ ] **Step 3: Implement `renderHeroComposite`**

Export:

```ts
export interface RenderHeroCompositeInput {
  stagePath: string;
  outputDirectory: string;
  websiteSku: string;
  passes: HeroGlassPasses;
  placement: HeroPlacementPlan;
  sidecarPasses?: HeroGlassPasses;
}

export interface RenderHeroCompositeResult {
  finalPath: string;
  geometryMaskPath: string;
  placedPassPaths: { silhouette: string; density: string; specular: string; transmission: string };
  outputSha256: string;
}

export async function renderHeroComposite(input: RenderHeroCompositeInput): Promise<RenderHeroCompositeResult>;
```

Implementation requirements:

1. Validate stage metadata is 2080 × 2288 and sRGB-compatible before composing.
2. Resize every pass with the exact primary width/height from `HeroPlacementPlan`; use `fit: "fill"` only because width and height were produced from the same uniform scale.
3. Create one geometry mask by placing the resized silhouette alpha at the plan coordinates.
4. Create contact-shadow SVGs from primary and sidecar bounds. Use a dark warm ellipse at 18% opacity, horizontal blur 18 px, vertical blur 7 px, and keep its top at baseline −2.
5. Composite in this order: stage, deterministic shadow, transmission (`over`), density (`multiply`), specular (`screen`).
6. Clip all product passes to the geometry mask. Do not apply blur or affine transforms to product layers.
7. Save the final image and geometry mask under `composites/` and `qa/geometry-masks/`.
8. Hash the final PNG with SHA-256.

- [ ] **Step 4: Run compositor tests**

Run: `npx tsx --test scripts/best-bottles/hybrid-hero/composite.test.ts`

Expected: compositor test passes with exact dimensions and baseline.

- [ ] **Step 5: Commit the compositor**

```bash
git add scripts/best-bottles/hybrid-hero/composite.ts scripts/best-bottles/hybrid-hero/composite.test.ts
git commit -m "feat(best-bottles): composite hybrid hero glass on stone"
```

---

### Task 6: Enforce automated QA and manual product-truth gates

**Files:**
- Create: `scripts/best-bottles/hybrid-hero/qa.ts`
- Create: `scripts/best-bottles/hybrid-hero/qa.test.ts`

**Interfaces:**
- Consumes: final PNG, geometry mask, source manifest, target, placement, product-truth expectations.
- Produces: `runHeroQa(input): Promise<HeroQaReport>` and batch pass/fail summary.

- [ ] **Step 1: Write fail-closed QA tests**

Cover these cases with generated fixtures:

```ts
it("passes an exact 2080x2288 mask at baseline 1990");
it("fails a 1196x1315 output");
it("fails baseline 1980");
it("fails body height drift above two percent");
it("fails source hash mismatch");
it("keeps roundness and fitment manual-review gates from auto-passing");
```

- [ ] **Step 2: Run QA tests and verify failure**

Run: `npx tsx --test scripts/best-bottles/hybrid-hero/qa.test.ts`

Expected: FAIL because `qa.ts` is missing.

- [ ] **Step 3: Implement the QA report**

```ts
export interface HeroQaCheck { id: string; status: "pass" | "fail" | "manual-review"; expected: unknown; actual: unknown; detail: string }
export interface HeroQaReport {
  version: "best-bottles-hybrid-hero-qa-v1";
  websiteSku: string;
  overall: "pass" | "fail" | "manual-review";
  checks: HeroQaCheck[];
  measuredBounds: { left: number; top: number; width: number; height: number };
}
```

`runHeroQa` must:

- read final metadata and require 2080 × 2288;
- measure geometry-mask alpha bounds;
- require bottom edge 1990 ±4;
- compare height/width to target at ±2%;
- compare placed mask against the uniformly resized source silhouette and require boundary drift ≤2 px;
- recompute each original source hash and compare it with the source manifest;
- emit explicit checks for SKU, applicator, finish, component count, cap state, and circular optics;
- set `overall: "manual-review"` while any product-truth or roundness check remains unreviewed;
- set `overall: "fail"` if any automated check fails, regardless of manual decisions.

- [ ] **Step 4: Run QA tests**

Run: `npx tsx --test scripts/best-bottles/hybrid-hero/qa.test.ts`

Expected: all six cases pass.

- [ ] **Step 5: Commit QA**

```bash
git add scripts/best-bottles/hybrid-hero/qa.ts scripts/best-bottles/hybrid-hero/qa.test.ts
git commit -m "feat(best-bottles): gate hybrid hero geometry and truth"
```

---

### Task 7: Build review and Darkroom staging artifacts

**Files:**
- Create: `scripts/best-bottles/hybrid-hero/review.ts`
- Create: `scripts/best-bottles/hybrid-hero/review.test.ts`

**Interfaces:**
- Consumes: completed item manifests and QA reports.
- Produces: diagnostic PNG overlays, `review/review-manifest.json`, `data/library-staging-manifest.json`, and Creative Production stream data through the shared renderer.

- [ ] **Step 1: Write review-manifest tests**

Assert that:

- every calibration SKU produces one clean review item;
- clean review items point at final PNGs, not contact sheets;
- captions include target/actual height, width, baseline, source hash prefix, and QA status;
- staging tags include `source:reference-flattened`, `workflow:hybrid-deterministic-hero`, `lane:darkroom-cylinder-studio`, `asset-status:concept`, and `push-blocked:true`;
- no staging record is marked approved or ready-to-push.

- [ ] **Step 2: Run and verify failure**

Run: `npx tsx --test scripts/best-bottles/hybrid-hero/review.test.ts`

Expected: FAIL because `review.ts` is missing.

- [ ] **Step 3: Implement review artifacts**

Export:

```ts
export function buildHeroReviewManifest(items: Array<{ selection: HeroSelection; finalPath: string; qa: HeroQaReport; sourceHash: string }>): unknown[];
export function buildHeroLibraryStagingManifest(items: Array<{ selection: HeroSelection; finalPath: string; qa: HeroQaReport }>): unknown;
export async function renderHeroDiagnosticOverlay(input: { finalPath: string; geometryMaskPath: string; qa: HeroQaReport; outputPath: string }): Promise<void>;
```

The overlay uses magenta target bounds/baseline, yellow measured bounds/baseline, and textual SKU/measurement metadata below the 2080 × 2288 image. It never changes the clean final.

- [ ] **Step 4: Run review tests**

Run: `npx tsx --test scripts/best-bottles/hybrid-hero/review.test.ts`

Expected: all review tests pass.

- [ ] **Step 5: Commit review support**

```bash
git add scripts/best-bottles/hybrid-hero/review.ts scripts/best-bottles/hybrid-hero/review.test.ts
git commit -m "feat(best-bottles): prepare hybrid hero review artifacts"
```

---

### Task 8: Add the explicit three-SKU calibration selection and CLI

**Files:**
- Create: `data/best-bottles-hybrid-hero-calibration-v1.json`
- Create: `scripts/best-bottles/build-hybrid-hero-calibration.ts`
- Create: `scripts/best-bottles/build-hybrid-hero-calibration.test.ts`

**Interfaces:**
- Consumes: calibration JSON, canonical truth CSV, locked stage path, output root.
- Produces: complete run directory and non-zero exit on any unresolved source or automated QA failure.

- [ ] **Step 1: Create the calibration selection**

Use these reviewed sources and component roles:

```json
{
  "version": "best-bottles-hybrid-hero-calibration-v1",
  "stagePath": "outputs/imagegen/generative-polish/best-bottles-cylinder-grid-production-20260712/stage/cylinder-stone-surface-master-2080x2288.png",
  "items": [
    {
      "websiteSku": "GB1mlVBlk",
      "graceSku": "GB-VIA-CLR-1ML-BLK-T",
      "capState": "component-layout",
      "layoutMode": "rightmost-primary-with-left-sidecar",
      "centerOffsetPx": 0,
      "expectedApplicator": "vial plug",
      "expectedFinish": "clear",
      "expectedRoundness": "round",
      "sourceParts": [
        {
          "role": "primary",
          "kind": "flattened",
          "path": "/Users/jordanrichter/Projects/Clients/Nemat-International/Best-Bottles-Website-02-20-2026/pipeline/aios-shopify-pdp-images/00-input/reference-flattened/vial-1ml-clear-Plug/GB-VIA-CLR-1ML-BLK-T__GB1mlVBlk__pdp-main__v001.png"
        }
      ]
    },
    {
      "websiteSku": "GBCyl5Gl",
      "graceSku": "GB-CYL-CLR-5ML-GLD-T",
      "capState": "detached-sidecar",
      "layoutMode": "separate-parts",
      "centerOffsetPx": -110,
      "expectedApplicator": "cap/closure",
      "expectedFinish": "clear with shiny gold cap",
      "expectedRoundness": "round",
      "sourceParts": [
        {
          "role": "primary",
          "kind": "psd-page",
          "path": "/Users/jordanrichter/Projects/Clients/Nemat-International/Best-Bottles-Original-Photoshop-Sources/5. 13-415 Bottles PSD/2. Clear 5ml Cylinder/1. GBCyl5BlkSht.psd",
          "page": 2
        },
        {
          "role": "sidecar",
          "kind": "flattened",
          "componentWebsiteSku": "CP13-415Gl",
          "path": "/Users/jordanrichter/Projects/Clients/Nemat-International/Best-Bottles-Website-02-20-2026/pipeline/aios-shopify-pdp-images/00-input/reference-flattened/cap-closure-13-415/CMP-CAP-SGLD-13-415-01__CP13-415Gl__pdp-main__v001.png"
        }
      ]
    },
    {
      "websiteSku": "GBTallCyl9Gl",
      "graceSku": "GB-CYL-CLR-9ML-GLD-T",
      "capState": "detached-sidecar",
      "layoutMode": "separate-parts",
      "centerOffsetPx": -110,
      "expectedApplicator": "cap/closure",
      "expectedFinish": "clear with gold cap",
      "expectedRoundness": "round",
      "sourceParts": [
        {
          "role": "primary",
          "kind": "psd-page",
          "path": "/Users/jordanrichter/Projects/Clients/Nemat-International/Best-Bottles-Original-Photoshop-Sources/5. 13-415 Bottles PSD/13. Tall Cylinder 9ml/1. GBTallCyl9BlkSht.psd",
          "page": 2
        },
        {
          "role": "sidecar",
          "kind": "flattened",
          "componentWebsiteSku": "CP13-415Gl",
          "path": "/Users/jordanrichter/Projects/Clients/Nemat-International/Best-Bottles-Website-02-20-2026/pipeline/aios-shopify-pdp-images/00-input/reference-flattened/cap-closure-13-415/CMP-CAP-SGLD-13-415-01__CP13-415Gl__pdp-main__v001.png"
        }
      ]
    }
  ]
}
```

- [ ] **Step 2: Write an orchestration test**

Use temporary synthetic sources and stage. Assert the CLI core creates `source-manifest`, `source-snapshots`, `working-mattes`, `composites`, `qa`, and `review`; returns `automatedStatus: "pass"`; and leaves the input hashes unchanged.

- [ ] **Step 3: Run and verify the expected failure**

Run: `npx tsx --test scripts/best-bottles/build-hybrid-hero-calibration.test.ts`

Expected: FAIL because the calibration runner is missing.

- [ ] **Step 4: Implement orchestration**

Export `runHybridHeroCalibration(options)` for tests and add a guarded CLI entry point. Required options:

```ts
export interface HybridHeroCalibrationOptions {
  selectionPath: string;
  canonicalTruthPath: string;
  outputRoot: string;
  stagePath?: string;
}
```

Execution order for each item:

1. Parse canonical CSV and require one exact website-SKU row.
2. Resolve `HeroTarget`.
3. Snapshot/hash every source part.
4. Extract requested PSD page or flattened pixels.
5. Derive primary and sidecar passes. For `rightmost-primary-with-left-sidecar`, split the single flattened layout and require exactly two groups. For `separate-parts`, resolve the sidecar component SKU and require positive canonical component height and width.
6. Measure source bounds.
7. Build uniform placement; fail on width drift.
8. Render final composite and geometry mask.
9. Run automated QA.
10. Write item manifest and diagnostic overlay.
11. After all items, write batch QA, review manifest, and Library staging manifest.
12. Re-hash all original sources and stage and fail if any changed.

The CLI must set exit code 1 when a source cannot resolve or automated QA fails. Manual review gates do not produce exit code 1; they keep the run `push-blocked:true`.

- [ ] **Step 5: Run the orchestration test**

Run: `npx tsx --test scripts/best-bottles/build-hybrid-hero-calibration.test.ts`

Expected: orchestration test passes.

- [ ] **Step 6: Run the complete hybrid-hero test suite**

```bash
npx tsx --test \
  scripts/best-bottles/hybrid-hero/contract.test.ts \
  scripts/best-bottles/hybrid-hero/source-manifest.test.ts \
  scripts/best-bottles/hybrid-hero/glass-passes.test.ts \
  scripts/best-bottles/hybrid-hero/placement.test.ts \
  scripts/best-bottles/hybrid-hero/composite.test.ts \
  scripts/best-bottles/hybrid-hero/qa.test.ts \
  scripts/best-bottles/hybrid-hero/review.test.ts \
  scripts/best-bottles/build-hybrid-hero-calibration.test.ts
```

Expected: all tests pass, 0 failures.

- [ ] **Step 7: Commit calibration orchestration**

```bash
git add data/best-bottles-hybrid-hero-calibration-v1.json \
  scripts/best-bottles/build-hybrid-hero-calibration.ts \
  scripts/best-bottles/build-hybrid-hero-calibration.test.ts
git commit -m "feat(best-bottles): orchestrate hybrid hero calibration"
```

---

### Task 9: Execute and review the three-image calibration

**Files:**
- Generate: `outputs/imagegen/generative-polish/best-bottles-cylinder-hero-hybrid-v1/**`
- Do not commit generated PNGs unless the user separately requests tracked fixtures.

**Interfaces:**
- Consumes: calibration CLI and selection.
- Produces: three clean composites, diagnostic overlays, QA reports, provenance manifests, and inline Creative Production review surface.

- [ ] **Step 1: Record source-tree hashes before execution**

```bash
find '/Users/jordanrichter/Projects/Clients/Nemat-International/Best-Bottles-Website-02-20-2026/pipeline/aios-shopify-pdp-images/00-input/reference-flattened' -type f -print0 \
  | sort -z | xargs -0 shasum -a 256 \
  > /tmp/best-bottles-reference-flattened-before.sha256
```

- [ ] **Step 2: Run calibration**

```bash
npx tsx scripts/best-bottles/build-hybrid-hero-calibration.ts \
  --selection data/best-bottles-hybrid-hero-calibration-v1.json \
  --canonical docs/best-bottles-canonical-truth/best-bottles-master-truth.csv \
  --output outputs/imagegen/generative-polish/best-bottles-cylinder-hero-hybrid-v1
```

Expected: three composites written; automated QA exits 0; all items remain `manual-review` and `push-blocked:true`.

- [ ] **Step 3: Prove the source tree was not modified**

```bash
find '/Users/jordanrichter/Projects/Clients/Nemat-International/Best-Bottles-Website-02-20-2026/pipeline/aios-shopify-pdp-images/00-input/reference-flattened' -type f -print0 \
  | sort -z | xargs -0 shasum -a 256 \
  > /tmp/best-bottles-reference-flattened-after.sha256
diff -u /tmp/best-bottles-reference-flattened-before.sha256 /tmp/best-bottles-reference-flattened-after.sha256
```

Expected: no diff.

- [ ] **Step 4: Render the shared review surface**

```bash
python3 /Users/jordanrichter/.codex/plugins/cache/openai-curated-remote/creative-production/0.1.24/scripts/review_renderer.py \
  --out-dir outputs/imagegen/generative-polish/best-bottles-cylinder-hero-hybrid-v1/review \
  --manifest outputs/imagegen/generative-polish/best-bottles-cylinder-hero-hybrid-v1/review/review-manifest.json \
  --preset image-wall --show-captions --contact-sheet --moodboard-widget-payload
```

Expected: `review-board.html`, contact sheet, `data/stream.json`, and widget payload are produced from the same manifest. Render the saved run inline with `render_moodboard_board_widget`.

- [ ] **Step 5: Complete the human calibration gate**

For each item, record explicit decisions for:

- source identity;
- glass realism and lack of white halo;
- fitment/component truth;
- circular form;
- baseline and scale overlay;
- shadow grounding;
- integrated studio appearance.

Any rejection stays blocked and returns to the smallest owning module: source selection, pass extraction, placement, shadow, or stage. Do not loosen numeric tolerances to approve an image.

- [ ] **Step 6: Freeze the calibration contract after approval**

Write `qa/calibration-approval.json` with the three item hashes, stage hash, source hashes, target manifest hash, QA version, reviewer, and approval timestamp. This file is the required input gate for a later twelve-item execution plan. Do not ingest Library or push Sanity in this task.

- [ ] **Step 7: Final verification**

```bash
npx tsx --test scripts/best-bottles/hybrid-hero/*.test.ts scripts/best-bottles/build-hybrid-hero-calibration.test.ts
magick identify -format '%f %wx%h %[colorspace]\n' \
  outputs/imagegen/generative-polish/best-bottles-cylinder-hero-hybrid-v1/composites/*.png
```

Expected: all tests pass; every clean composite reports `2080x2288 sRGB`; batch QA has zero automated failures; source-tree diff remains empty.

---

## Completion Gate

This plan is complete only when:

1. all new unit/integration tests pass;
2. the three calibration composites exist at 2080 × 2288 sRGB;
3. geometry and provenance QA have zero automated failures;
4. original reference and PSD source hashes are unchanged;
5. all three items receive explicit human approval;
6. the run remains separate from PDP pipeline, Library, and Sanity;
7. `qa/calibration-approval.json` freezes the approved stage, source, target, and output hashes.

The twelve-image batch begins only after this gate. It reuses the approved modules and frozen calibration contract; it does not reopen the geometry or stage rules.
