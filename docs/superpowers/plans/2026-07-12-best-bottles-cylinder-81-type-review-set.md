# Best Bottles Cylinder 81-Type Review Set Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build one versioned, local-only Cylinder review set containing 81 canonical body-aware types: 41 types represented by exact approved PSD-derived opaque PNG previews, 40 visibly blocked type positions, all 216 blocked canonical identities, and six non-operative collapse candidates for human review.

**Architecture:** A pure TypeScript builder consumes the existing 377-row approved-coverage manifest, the canonical master CSV records, and the reviewed PSD manifest. It joins only on the exact normalized Website-SKU + Grace-SKU pair and groups identities by canonical body axes plus neck/applicator/cap topology. A thin CLI records versioned JSON artifacts under `tmp/best-bottles-reference-production/cylinder-81-type-review-v1/`; a separate Sharp renderer creates opaque review PNGs and a local HTML index without altering source images or existing legacy 75 artifacts.

**Tech Stack:** TypeScript, Node test runner, `sharp`, canonical CSV/JSON evidence, local HTML/PNG artifacts.

## Global Constraints

- Work only in `/Users/jordanrichter/Projects/Madison Studio/madison-app` on `codex/best-bottles-product-hub-pipeline`; do not switch branches, reset, discard, stage, commit, push, or overwrite unrelated work.
- Consume only `canon_*` measurement columns from `docs/best-bottles-canonical-truth/best-bottles-master-truth.csv`; never use raw `diameter`, Convex `widthMm`, or Convex `depthMm`.
- Geometry keys on the body. The canonical type key is normalized `family × capacityMl × canon_bodyHeightMm × canon_widthAxisMm × canon_secondAxisMm × neckThreadSize × applicator × capStyle`.
- Exact identity requires both Website SKU and Grace SKU. Never use Grace-only fallback, Website-only fallback, sibling products, catalog-image fallback, fuzzy filenames, or generated substitutes.
- A type is reference-ready only when at least one member is `referenceReady: true` in the approved coverage manifest and its selected `primaryReference` resolves to the same reviewed unit as an approved `assembled-cap-on` opaque PSD preview.
- Preserve all alternate approved PSD source paths and hashes as provenance; render only the coverage manifest's deterministic `primaryReference` once per type.
- Keep all 216 identity blockers and their original blocker codes. Blocked type slots render as labeled placeholders, never blank and never with a substituted bottle.
- Collapse candidates are suggestions only. Exactly six pairings may be displayed, but they must have `decision: "pending-human-review"` and cannot change the 81 types or any count.
- The six review pairs are fixed and differ only in `capStyle` while family, capacity, canonical body axes, neck, and applicator remain identical: (1) 9 ml Cylinder, 74×21×21 mm, 17-415, Metal Roller Ball, `Dot Cap` ↔ `Roll-On`; (2) 50 ml Lotion Pump `Pump` ↔ `Screw Cap`; (3) 100 ml Lotion Pump `Pump` ↔ `Screw Cap`; (4) 50 ml Vintage Bulb Sprayer with Tassel `Spray` ↔ `Screw Cap`; (5) 100 ml Vintage Bulb Sprayer with Tassel `Spray` ↔ `Screw Cap`; (6) 100 ml Vintage Bulb Sprayer `Spray` ↔ `Screw Cap`.
- `GB09BlackCapApp` remains reference-visible but scale-blocked while `canon_heightWithCapMm` (50) is below the canonical body height (79.4). Do not correct, infer, or substitute either value.
- Use `best-bottles-catalog-scale-v1` only with canonical capacity/body/with-cap values. If canonical assembled height is below body height, omit scale placement and render a visible `SCALE BLOCKED` annotation.
- Preserve PSD-preview pixels as opaque. Do not remove white backgrounds, synthesize transparency, reconstruct glass, repaint, or apply v6.1 prompt/shadow treatment in this phase. The PSD audit extractor computes `foregroundBounds` on the resized preview pixels (not the full PSD composite canvas), so renderer crops must consume those bounds directly in actual preview coordinates.
- Write only beneath `tmp/best-bottles-reference-production/cylinder-81-type-review-v1/`. Do not overwrite `public/data/best-bottles-cylinder-75-type-lineup-manifest.json` or `tmp/best-bottles-cylinder-75/`.
- No Convex, Supabase, Shopify, Sanity, network upload, model generation, or publishing writes.

---

### Task 1: Canonical 377-to-81 review manifest

**Files:**
- Create: `src/lib/bestBottlesCylinderCanonicalTypeReview.ts`
- Create: `src/lib/bestBottlesCylinderCanonicalTypeReview.test.ts`
- Create: `scripts/best-bottles/build-cylinder-81-type-review.ts`
- Create: `scripts/best-bottles/build-cylinder-81-type-review.test.ts`
- Modify: `package.json` (add only `bestbottles:cylinder:81-review`)

**Interfaces:**
- Consumes: `CylinderApprovedCoverageManifest`, canonical master CSV records, and reviewed PSD units.
- Produces: `buildCylinderCanonicalTypeReview(input): CylinderCanonicalTypeReviewManifest` with `types`, `blockedIdentities`, `collapseCandidates`, provenance, and exact summary counts.
- CLI writes `cylinder-81-type-review-manifest.json`, `cylinder-216-blocker-report.json`, and `cylinder-six-collapse-candidates.json` under the versioned local root.

- [x] **Step 1: Write failing pure-builder tests**

```ts
const result = buildCylinderCanonicalTypeReview(fixture);
assert.equal(result.summary.canonicalIdentityCount, 377);
assert.equal(result.summary.typeCount, 81);
assert.equal(result.summary.readyTypeCount, 41);
assert.equal(result.summary.blockedTypeCount, 40);
assert.equal(result.summary.blockedIdentityCount, 216);
assert.equal(result.collapseCandidates.length, 6);
assert.ok(result.collapseCandidates.every((pair) =>
  pair.decision === "pending-human-review" && pair.applied === false
));
```

Also test that exact dual-SKU conflicts fail, every blocked identity appears once, a blocked-only type has no representative image, alternate sources remain provenance only, and `GB09BlackCapApp` receives `canonical-with-cap-below-body` without losing its exact preview.

- [x] **Step 2: Run RED**

Run:

```bash
npx tsx --test src/lib/bestBottlesCylinderCanonicalTypeReview.test.ts
```

Expected: fail because the module does not exist.

- [x] **Step 3: Implement the pure grouping and review-only candidate logic**

The type key must be constructed from the eight canonical/topology fields in Global Constraints. Representative choice is deterministic among ready identities and never changes canonical identity. Candidate pairs must resolve the six fixed signatures in Global Constraints, share family, capacity, canonical body axes, neck, and applicator, and differ only in cap-style taxonomy; missing or non-unique pair resolution fails closed.

- [x] **Step 4: Run GREEN and focused regression tests**

```bash
npx tsx --test \
  src/lib/bestBottlesCylinderApprovedCoverageManifest.test.ts \
  src/lib/bestBottlesCylinderCanonicalTypeReview.test.ts
```

Expected: all pass with no warnings.

- [x] **Step 5: Write failing CLI tests and implement the local artifact writer**

The CLI test supplies temporary fixtures and asserts exactly three JSON files are written, all three contain input SHA-256 provenance, source bytes remain unchanged, and an identity mismatch fails before the output directory is created.

- [x] **Step 6: Run the Task 1 suite**

```bash
npx tsx --test \
  src/lib/bestBottlesCylinderCanonicalTypeReview.test.ts \
  scripts/best-bottles/build-cylinder-81-type-review.test.ts
npx tsc --noEmit
npx eslint \
  src/lib/bestBottlesCylinderCanonicalTypeReview.ts \
  src/lib/bestBottlesCylinderCanonicalTypeReview.test.ts \
  scripts/best-bottles/build-cylinder-81-type-review.ts \
  scripts/best-bottles/build-cylinder-81-type-review.test.ts
```

Expected: pass; no staging or commit.

---

### Task 2: Opaque annotated review renderer

**Files:**
- Create: `scripts/best-bottles/render-cylinder-81-type-review.ts`
- Create: `scripts/best-bottles/render-cylinder-81-type-review.test.ts`
- Modify: `package.json` (add only `bestbottles:cylinder:render-81-review`)

**Interfaces:**
- Consumes: `cylinder-81-type-review-manifest.json`, `cylinder-216-blocker-report.json`, and `cylinder-six-collapse-candidates.json` from Task 1.
- Produces: `cylinder-81-annotated-review.png`, `cylinder-41-ready-long.png`, `cylinder-216-blocker-report.png`, `cylinder-six-collapse-review.png`, `render-manifest.json`, and `index.html` in the same versioned root.

- [x] **Step 1: Write failing render-plan tests**

```ts
const plan = buildCylinder81ReviewRenderPlan(manifest);
assert.equal(plan.slots.length, 81);
assert.equal(plan.slots.filter((slot) => slot.status === "ready").length, 41);
assert.equal(plan.slots.filter((slot) => slot.status === "blocked").length, 40);
assert.ok(plan.slots.filter((slot) => slot.status === "blocked")
  .every((slot) => slot.placeholderLabel.startsWith("BLOCKED")));
```

Test that all 216 blocker cards exist, six candidate pairs are present without an applied merge, output widths/heights stay under Sharp's pixel limits, opaque preview extraction does not alter source files, and scale-blocked rows receive no computed placement.

- [x] **Step 2: Run RED**

```bash
npx tsx --test scripts/best-bottles/render-cylinder-81-type-review.test.ts
```

Expected: fail because the renderer does not exist.

- [x] **Step 3: Implement the renderer**

Render a 9×9 annotated overview with a shared canonical scale contract, a long 41-ready comparison image, a text-only 216-identity blocker sheet, and a six-pair collapse-review sheet. Approved images are cropped only to the recorded PSD audit foreground bounds, which are already expressed in preview coordinates by `psd-cap-state-evidence.ts`; the white opaque background remains. Blocked slots contain text and status colors only.

- [x] **Step 4: Render the real local artifacts**

```bash
npm run bestbottles:cylinder:81-review
npm run bestbottles:cylinder:render-81-review
```

Expected summary: 377 identities, 81 types, 41 ready types, 40 blocked types, 216 blocked identities, six pending collapse candidates, zero applied collapses, zero external writes.

- [x] **Step 5: Verify tests, TypeScript, lint, checksums, and image dimensions**

```bash
npx tsx --test \
  src/lib/bestBottlesCylinderApprovedCoverageManifest.test.ts \
  scripts/best-bottles/build-cylinder-approved-coverage-manifest.test.ts \
  src/lib/bestBottlesCylinderCanonicalTypeReview.test.ts \
  scripts/best-bottles/build-cylinder-81-type-review.test.ts \
  scripts/best-bottles/render-cylinder-81-type-review.test.ts
npx tsc --noEmit
npx eslint \
  src/lib/bestBottlesCylinderCanonicalTypeReview.ts \
  src/lib/bestBottlesCylinderCanonicalTypeReview.test.ts \
  scripts/best-bottles/build-cylinder-81-type-review.ts \
  scripts/best-bottles/build-cylinder-81-type-review.test.ts \
  scripts/best-bottles/render-cylinder-81-type-review.ts \
  scripts/best-bottles/render-cylinder-81-type-review.test.ts
```

Expected: all pass; source canonical/coverage/review-manifest hashes match pre-build values; no output exists outside the versioned local root.

- [x] **Step 6: Visually inspect every generated PNG**

Open all four PNGs at original detail and verify actual PSD-derived products are visible, blocked slots are never blank, annotations are readable, no product is cropped, the glass-rod scale conflict is visible, and no collapse is shown as approved.

No staging, commit, push, upload, generation, or publication action is part of this plan.
