# CYL-9ML Ten-Cap Blender Family Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build one calibrated 17-415 roll-on over-cap Blender master, review it as a shiny-silver cap on the locked clear 9 ml bottle, then render and release ten pixel-identical cap finishes.

**Architecture:** A versioned JSON recipe owns cap identity, nominal dimensions, the 362 px calibrated placement, and ten stable variant keys. Blender 5.2 renders one revolved mesh, one camera, one studio, one mask pass, and ten material/decor variants; a TypeScript postprocessor clamps every render to the shared mask, proves exact alpha identity, composes review images, and supplies immutable release assets. Current Release and Sanity remain unchanged until named pixel, fit, and placement approvals create a later append-only release cut.

**Tech Stack:** Blender 5.2 LTS / Cycles / Python, TypeScript, Node 20, `tsx`, `sharp`, `zod`, Node test runner, Madison Paper-Doll release contracts.

## Global Constraints

- Preserve the five frozen `2080 × 2288` body plates and their registry SHA-256 values.
- Preserve the approved plastic and metal roller assets and placement history.
- Use `#F5F3EF` as the studio environment/background contract.
- Treat the approved shiny-silver photograph as silhouette and camera authority.
- Use one Blender mesh, camera, mask, placement, and lighting recipe for all ten variants.
- Calibrate the current family width from 363 px to a versioned 362 px candidate; keep `centerX = 1041` and `bottomY = 1002`.
- Use uniform placement scale; do not stretch one axis or nudge exported PNGs independently.
- Do not describe caps as aluminium, anodised, brushed, machined, or metal; they are moulded phenolic plastic with finish treatments.
- Only mask-and-clamp verification may earn the label `geometry locked`.
- Require pairwise alpha IoU `1.0000` and zero mismatched occupied pixels after clamp.
- Keep rhinestone transforms deterministic and shared across the three dotted variants.
- Do not modify Current Release, write to Sanity, or publish storefront content during rendering and review.
- Preserve all existing untracked files under `assets/paper-doll/components/`; they are user-owned working assets.

---

## File structure

### Create

- `docs/paper-doll-rig/cyl9-cap-family-recipe.json` — versioned geometry, placement, variant, material, and rhinestone contract.
- `src/lib/paperDoll/cyl9CapFamily.ts` — typed recipe parsing, stable variant lookup, placement solving, and manifest validation.
- `src/lib/paperDoll/cyl9CapFamily.test.ts` — unit tests for recipe, placement, exact variant set, and provenance rules.
- `scripts/paper-doll/render_cyl9_cap_family.py` — deterministic Blender scene, revolved master mesh, materials, rhinestones, camera, lighting, and mask render.
- `scripts/paper-doll/render-cyl9-cap-family.ts` — renderer orchestration, mask clamp, QA, clear-bottle composite, contact sheets, and review manifest.
- `scripts/paper-doll/render-cyl9-cap-family.test.ts` — postprocess and manifest tests using synthetic RGBA fixtures.
- `docs/paper-doll-rig/CYL9-TEN-CAP-REVIEW.md` — generated-evidence summary and named approval checklist.

### Modify

- `package.json` — add render and focused-test commands.
- `src/lib/paperDoll/cyl9FamilyRelease.node.ts` — accept the ten-cap review manifest and export approved variants without changing existing releases in place.
- `src/lib/paperDoll/cyl9FamilyRelease.test.ts` — prove all ten cap keys, one geometry mask, and explicit release mappings.
- `scripts/paper-doll/build-cyl9-family-release.ts` — select the ten-cap manifest only when the user explicitly requests a new draft release directory.
- `scripts/paper-doll/verify-family-release.test.ts` — reject mixed mesh, camera, mask, or placement provenance.
- `src/components/paper-doll/releaseWorkbenchState.test.ts` — prove ten cap variants surface from the manifest without UI-specific fallback data.

### Reuse unchanged

- `assets/paper-doll/components/closure__17-415__roll-on-over-cap__shiny-silver.png` — photographic authority.
- `assets/paper-doll/body-plates/body__cylinder__9ml__clear__70.0x20.0mm.png` — first assembly-review body.
- `docs/paper-doll-rig/closure-placement-recipe.json` — active legacy placement stays unchanged until named placement approval.
- `src/lib/paperDoll/closureMaterialPilot.ts` — existing silhouette/placement helpers remain available to legacy pilot tests.

---

### Task 1: Add the typed ten-cap recipe and 362 px calibration candidate

**Files:**
- Create: `docs/paper-doll-rig/cyl9-cap-family-recipe.json`
- Create: `src/lib/paperDoll/cyl9CapFamily.ts`
- Create: `src/lib/paperDoll/cyl9CapFamily.test.ts`
- Modify: `package.json`

**Interfaces:**
- Produces: `CYL9_CAP_VARIANT_KEYS`, `Cyl9CapFamilyRecipe`, `parseCyl9CapFamilyRecipe(value)`, `solveCyl9CapPlacement(sourceWidth, sourceHeight, recipe)`.
- Consumes: canonical canvas and anchor values from the approved design and existing placement recipe.

- [ ] **Step 1: Write failing contract tests**

```ts
import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import {
  CYL9_CAP_VARIANT_KEYS,
  parseCyl9CapFamilyRecipe,
  solveCyl9CapPlacement,
} from "./cyl9CapFamily";

test("recipe contains the exact ten catalog cap keys", async () => {
  const recipe = parseCyl9CapFamilyRecipe(JSON.parse(await readFile(
    "docs/paper-doll-rig/cyl9-cap-family-recipe.json", "utf8",
  )));
  assert.deepEqual(recipe.variants.map(({ variantKey }) => variantKey), CYL9_CAP_VARIANT_KEYS);
  assert.equal(new Set(recipe.variants.map(({ variantKey }) => variantKey)).size, 10);
});

test("silver calibration is one uniform pixel narrower with the seat unchanged", async () => {
  const recipe = parseCyl9CapFamilyRecipe(JSON.parse(await readFile(
    "docs/paper-doll-rig/cyl9-cap-family-recipe.json", "utf8",
  )));
  const placed = solveCyl9CapPlacement(1400, 2050, recipe);
  assert.equal(placed.width, 362);
  assert.equal(placed.left + placed.rightExclusive, 2082);
  assert.equal(placed.bottomExclusive, 1002);
});
```

- [ ] **Step 2: Run the test and verify the recipe/module do not exist**

Run: `npx tsx --test src/lib/paperDoll/cyl9CapFamily.test.ts`

Expected: FAIL because `cyl9CapFamily.ts` cannot be resolved.

- [ ] **Step 3: Add the recipe with exact stable values**

```json
{
  "schemaVersion": 1,
  "familyKey": "CYL-9ML",
  "geometryFamilyId": "closure__17-415__rollon-overcap__v2",
  "authorityImagePath": "assets/paper-doll/components/closure__17-415__roll-on-over-cap__shiny-silver.png",
  "nominalDimensionsMm": { "outsideDiameter": 19.5, "height": 28.5, "verified": false },
  "render": { "widthPx": 1400, "heightPx": 2050, "samples": 128, "topArcRatio": 0.02 },
  "placement": { "canvasWidthPx": 2080, "canvasHeightPx": 2288, "widthPx": 362, "centerX": 1041, "bottomY": 1002 },
  "variants": [
    { "variantKey": "SSLV", "material": "mirror-silver", "decoration": "none" },
    { "variantKey": "MSLV", "material": "matte-silver", "decoration": "none" },
    { "variantKey": "SGLD", "material": "mirror-gold", "decoration": "none" },
    { "variantKey": "MGLD", "material": "matte-gold", "decoration": "none" },
    { "variantKey": "SBLK", "material": "glossy-black", "decoration": "none" },
    { "variantKey": "MCPR", "material": "matte-copper", "decoration": "none" },
    { "variantKey": "WHT", "material": "glossy-white", "decoration": "none" },
    { "variantKey": "SLDT", "material": "mirror-silver", "decoration": "crystal-v1" },
    { "variantKey": "BKDT", "material": "glossy-black", "decoration": "crystal-v1" },
    { "variantKey": "PKDT", "material": "matte-pink", "decoration": "crystal-v1" }
  ]
}
```

Add a deterministic `crystalLayout` array containing explicit stable IDs and normalized cylindrical coordinates; do not generate the layout with runtime randomness.

- [ ] **Step 4: Implement strict parsing and placement**

Use `zod` to reject missing/duplicate variant keys, a non-362 placement, a non-canonical canvas, or a geometry family other than `closure__17-415__rollon-overcap__v2`. Implement `solveCyl9CapPlacement` by delegating to `solveLockedPixelPlacement` so width and height use one uniform scale.

- [ ] **Step 5: Add focused scripts and run tests**

Add:

```json
"paperdoll:render-cyl9-caps": "tsx scripts/paper-doll/render-cyl9-cap-family.ts",
"test:paperdoll:cyl9-caps": "tsx --test src/lib/paperDoll/cyl9CapFamily.test.ts scripts/paper-doll/render-cyl9-cap-family.test.ts"
```

Run: `npx tsx --test src/lib/paperDoll/cyl9CapFamily.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit the recipe contract**

```bash
git add package.json docs/paper-doll-rig/cyl9-cap-family-recipe.json src/lib/paperDoll/cyl9CapFamily.ts src/lib/paperDoll/cyl9CapFamily.test.ts
git commit -m "feat(paper-doll): define CYL-9ML ten-cap family contract"
```

---

### Task 2: Build the calibrated Blender master and dedicated mask pass

**Files:**
- Create: `scripts/paper-doll/render_cyl9_cap_family.py`
- Test: `src/lib/paperDoll/cyl9CapFamily.test.ts`

**Interfaces:**
- Consumes: `cyl9-cap-family-recipe.json` and `--variants` comma-separated stable keys.
- Produces: isolated render PNGs, `geometry-mask.png`, and `blender-manifest.json` containing mesh/camera/light hashes and numeric recipe values.

- [ ] **Step 1: Add a failing renderer-provenance test**

Add a fixture manifest to the test and assert that `parseCyl9BlenderManifest` rejects a render whose `meshRecipeHash`, `cameraRecipeHash`, or `maskRecipeHash` differs from `SSLV`.

- [ ] **Step 2: Run the focused test and verify failure**

Run: `npx tsx --test --test-name-pattern="renderer provenance" src/lib/paperDoll/cyl9CapFamily.test.ts`

Expected: FAIL because `parseCyl9BlenderManifest` is not implemented.

- [ ] **Step 3: Implement one revolved half-profile**

In Python, read the JSON recipe and construct a profile with explicit normalized radius/height points. Revolve it 360 degrees with 256 segments, keep the bottom open, and apply smooth shading without changing the profile per variant. Put mesh creation in:

```py
def build_cap_mesh(recipe: dict) -> bpy.types.Object:
    """Return the single v2 over-cap geometry authority."""
```

Use the authority image to tune only these profile values: side taper, top-corner radius, top-face depth, lower rim, wall thickness. The first rendered contour must be narrower and flatter at the top than the existing prototype.

- [ ] **Step 4: Implement one fixed orthographic camera and studio**

Create:

```py
def build_camera(recipe: dict) -> bpy.types.Object:
    ...

def build_studio(recipe: dict) -> dict[str, bpy.types.Object]:
    ...
```

The camera elevation comes from `topArcRatio`; the studio contains camera-right key, camera-left fill, top skim, and narrow edge panels. Do not add a floor, shadow catcher, horizon, or opaque world background.

- [ ] **Step 5: Render shiny silver and an object mask**

Support:

```bash
/Applications/Blender.app/Contents/MacOS/Blender --background \
  --python scripts/paper-doll/render_cyl9_cap_family.py -- \
  --recipe docs/paper-doll-rig/cyl9-cap-family-recipe.json \
  --out outputs/paper-doll-cyl9-cap-family/candidate-v2 \
  --variants SSLV --samples 32
```

The dedicated mask pass must use the same evaluated mesh and camera, output transparent RGBA, and set occupied RGB/alpha to 255 without deriving occupancy from silver luminance.

- [ ] **Step 6: Write and validate Blender provenance**

Hash canonical JSON representations of the profile, camera, studio, mask recipe, Blender version, and Cycles settings. Write those hashes to `blender-manifest.json`, then parse them with `parseCyl9BlenderManifest` and run the focused test.

Expected: PASS.

- [ ] **Step 7: Commit the calibrated renderer**

```bash
git add scripts/paper-doll/render_cyl9_cap_family.py src/lib/paperDoll/cyl9CapFamily.ts src/lib/paperDoll/cyl9CapFamily.test.ts
git commit -m "feat(paper-doll): add calibrated CYL-9ML cap renderer"
```

---

### Task 3: Add mask clamp, exact-alpha QA, and the silver review bundle

**Files:**
- Create: `scripts/paper-doll/render-cyl9-cap-family.ts`
- Create: `scripts/paper-doll/render-cyl9-cap-family.test.ts`

**Interfaces:**
- Produces: `clampRenderToAuthorityMask(render, mask)`, `measureAuthorityDifference(authority, mask)`, `buildCapFamilyReviewBundle(input)`.
- Consumes: Blender render/mask manifest, locked clear body plate, 362 px placement recipe.

- [ ] **Step 1: Write failing synthetic RGBA tests**

```ts
test("clamp removes islands and copies exact binary mask alpha", async () => {
  const result = await clampRenderToAuthorityMask(renderWithDetachedIsland, authorityMask);
  assert.deepEqual(alphaBytes(result), alphaBytes(authorityMask));
});

test("all clamped variants have IoU 1 and zero mismatched pixels", async () => {
  const report = compareClampedVariantAlpha([silver, matte, dotted]);
  assert.equal(report.minIoU, 1);
  assert.ok(report.pairs.every(({ mismatchedPixels }) => mismatchedPixels === 0));
});
```

- [ ] **Step 2: Run the tests and verify failure**

Run: `npx tsx --test scripts/paper-doll/render-cyl9-cap-family.test.ts`

Expected: FAIL because the orchestration module is missing.

- [ ] **Step 3: Implement mask-and-clamp**

Decode both files with `sharp().ensureAlpha().raw()`. For every pixel, copy RGB from the render only where mask alpha is occupied; set output alpha to the mask alpha; set outside-mask RGBA to zero. Throw when dimensions differ, the mask is empty, the mask touches the frame, or connected-component analysis reports anything other than the calibrated cap region.

- [ ] **Step 4: Implement authority-difference evidence**

Resize the photographic authority alpha to the Blender mask bounds without changing aspect. Emit a black/white XOR difference PNG and record IoU, left/right/top/bottom offsets, aspect ratio, and top-arc observation. The report must identify the measured files and must never infer the object from the cream background.

- [ ] **Step 5: Compose the clear-bottle silver checkpoint**

Use the locked clear body plate and `solveCyl9CapPlacement`. Write:

```text
outputs/paper-doll-cyl9-cap-family/candidate-v2/review/
  01-authority.png
  02-blender-silver-isolated.png
  03-silhouette-difference.png
  04-clear-bottle-silver.png
  05-five-body-lineup.png
  silver-review.json
```

The clear composite must use `widthPx = 362`, `centerX = 1041`, and `bottomY = 1002`. The active placement recipe remains unchanged.

- [ ] **Step 6: Run low-sample silver render and inspect the real files**

Run: `npm run paperdoll:render-cyl9-caps -- --stage silver --samples 32`

Expected: the command writes the six review artifacts, reports the real authority/mask metrics, and does not mutate any registry, release, Supabase row, or Sanity document.

- [ ] **Step 7: Run focused tests**

Run: `npm run test:paperdoll:cyl9-caps`

Expected: PASS.

- [ ] **Step 8: Commit the review pipeline**

```bash
git add scripts/paper-doll/render-cyl9-cap-family.ts scripts/paper-doll/render-cyl9-cap-family.test.ts
git commit -m "feat(paper-doll): build CYL-9ML silver cap review bundle"
```

- [ ] **Step 9: Human checkpoint — geometry, one-pixel fit, then lighting**

Show `04-clear-bottle-silver.png` to Jordan. Record one of: `geometry-fit-approved`, `revise-profile`, `revise-placement`, or `revise-lighting`. Do not render the other nine variants until geometry and placement are approved. Lighting changes may proceed only after the geometry/fit decision is recorded.

---

### Task 4: Render seven finishes and three deterministic rhinestone variants

**Files:**
- Modify: `scripts/paper-doll/render_cyl9_cap_family.py`
- Modify: `scripts/paper-doll/render-cyl9-cap-family.ts`
- Modify: `scripts/paper-doll/render-cyl9-cap-family.test.ts`

**Interfaces:**
- Consumes: approved mesh, camera, studio, mask, placement, and ten recipe variants.
- Produces: ten clamped isolated PNGs, ten full-canvas layers, material contact sheet, five-body contact sheet, and `cap-family-manifest.json`.

- [ ] **Step 1: Add failing variant-completeness and rhinestone tests**

Assert that all ten keys exist exactly once, every render has the same provenance hashes, and `SLDT`, `BKDT`, and `PKDT` contain identical sorted crystal transform records.

- [ ] **Step 2: Run the focused tests and verify failure**

Run: `npm run test:paperdoll:cyl9-caps`

Expected: FAIL because only `SSLV` exists.

- [ ] **Step 3: Implement seven physical material presets**

Create one `apply_material(material_key, material)` function. Mirror presets use sharp studio reflections and low roughness; matte silver/gold/copper use broad diffuse response; glossy black/white use dielectric phenolic plastic; matte pink is used only by `PKDT`. Keep anisotropy at zero and do not add procedural grain.

- [ ] **Step 4: Implement the deterministic crystal layout**

Read explicit `crystalLayout` entries from the recipe. Instance one faceted crystal mesh at those exact cylindrical coordinates. Emit the sorted transforms into `blender-manifest.json`. Never seed or randomize positions at render time.

- [ ] **Step 5: Render and clamp all ten variants**

Run: `npm run paperdoll:render-cyl9-caps -- --stage all --samples 128`

Expected: ten isolated and ten full-canvas layers. The TypeScript lane clamps every output to `geometry-mask.png` before QA or composition.

- [ ] **Step 6: Prove exact alpha identity and inspect material fixtures**

The manifest must report `minIoU: 1`, `exactBinarySilhouette: true`, and `mismatchedPixels: 0` for every pair. Calibrate tone reports separately for mirror, matte, glossy-white, glossy-black, and dotted fixtures; no single intensity threshold may approve all materials.

- [ ] **Step 7: Commit the ten-variant renderer**

```bash
git add docs/paper-doll-rig/cyl9-cap-family-recipe.json scripts/paper-doll/render_cyl9_cap_family.py scripts/paper-doll/render-cyl9-cap-family.ts scripts/paper-doll/render-cyl9-cap-family.test.ts
git commit -m "feat(paper-doll): render ten locked CYL-9ML cap finishes"
```

---

### Task 5: Integrate the approved cap family with draft-release generation

**Files:**
- Modify: `src/lib/paperDoll/cyl9FamilyRelease.node.ts`
- Modify: `src/lib/paperDoll/cyl9FamilyRelease.test.ts`
- Modify: `scripts/paper-doll/build-cyl9-family-release.ts`
- Modify: `scripts/paper-doll/verify-family-release.test.ts`

**Interfaces:**
- Consumes: approved `cap-family-manifest.json`, named approval evidence, and existing five body/roller component versions.
- Produces: a new draft release directory containing ten cap layers and one shared geometry mask; never overwrites `1.0.0-draft.1`.

- [ ] **Step 1: Write failing ten-cap release tests**

Assert that the builder exports exactly ten cap assets, every asset uses geometry family `closure__17-415__rollon-overcap__v2`, every asset references one identical mask SHA, and five bodies × ten caps create 50 explicit capped assembly mappings.

- [ ] **Step 2: Add provenance rejection tests**

Create fixture manifests with one changed camera hash, one changed mesh hash, and one changed placement version. Assert that each fails closed with a specific error.

- [ ] **Step 3: Run release tests and verify failure**

Run: `npx tsx --test src/lib/paperDoll/cyl9FamilyRelease.test.ts scripts/paper-doll/verify-family-release.test.ts`

Expected: FAIL because the builder still expects the four-variant pilot manifest.

- [ ] **Step 4: Replace pilot-specific cap mapping with manifest-driven ten-cap mapping**

Read stable keys/material labels from the parsed ten-cap manifest. Require named `pixelsApprovedBy`, `familyFitApprovedBy`, and `placementLockedBy` evidence before setting a cap asset to `approved`. Do not infer approvals from filenames or rendered presence.

- [ ] **Step 5: Require a new explicit release target**

Update the CLI to require `--release-version` and reject `1.0.0-draft.1`. Write the new release only beneath a new directory such as:

```text
outputs/paper-doll-family-releases/CYL-9ML/1.1.0-draft.1/
```

Do not update generated application imports in this task.

- [ ] **Step 6: Run release tests**

Run: `npx tsx --test src/lib/paperDoll/cyl9FamilyRelease.test.ts scripts/paper-doll/verify-family-release.test.ts`

Expected: PASS.

- [ ] **Step 7: Commit release integration**

```bash
git add src/lib/paperDoll/cyl9FamilyRelease.node.ts src/lib/paperDoll/cyl9FamilyRelease.test.ts scripts/paper-doll/build-cyl9-family-release.ts scripts/paper-doll/verify-family-release.test.ts
git commit -m "feat(paper-doll): prepare ten-cap family release cut"
```

---

### Task 6: Surface ten caps in Madison and capture final evidence

**Files:**
- Modify: `src/components/paper-doll/releaseWorkbenchState.test.ts`
- Create: `docs/paper-doll-rig/CYL9-TEN-CAP-REVIEW.md`
- Modify only if tests prove necessary: `src/components/paper-doll/releaseWorkbenchState.ts`

**Interfaces:**
- Consumes: parsed draft manifest with ten cap component versions.
- Produces: workbench state that lists all ten variants, current approval state, shared placement provenance, and release-cut eligibility.

- [ ] **Step 1: Add a failing workbench-state test**

Build state from a ten-cap manifest and assert ten distinct cap tiles, one geometry family, one mask SHA, one placement version, and no `geometry locked` label before named placement approval.

- [ ] **Step 2: Run the workbench test and verify the behavior**

Run: `npx tsx --test src/components/paper-doll/releaseWorkbenchState.test.ts`

Expected: either PASS with no production change required or FAIL with the exact manifest assumption that must be removed.

- [ ] **Step 3: Make the minimum state-model change if required**

Remove any hard-coded four-cap assumption. Derive tiles from manifest assets in stable variant-key order. Do not redesign the workbench or add a second cap UI.

- [ ] **Step 4: Write the evidence document**

Record the authority image SHA, Blender version, recipe hash, mesh/camera/light/mask hashes, 362 px placement, exact-alpha result, material review status, five-body lineup status, named approvers, and explicit statement that Current Release/Sanity/public publication remain unchanged.

- [ ] **Step 5: Run proportional verification**

Run:

```bash
npm run test:paperdoll:cyl9-caps
npm run test:paperdoll
npx tsx --test src/lib/paperDoll/cyl9FamilyRelease.test.ts scripts/paper-doll/verify-family-release.test.ts src/components/paper-doll/releaseWorkbenchState.test.ts
npm run build
git diff --check
```

Expected: all commands pass. Inspect the isolated silver, clear-bottle silver, ten-material sheet, and five-body lineup manually before claiming completion.

- [ ] **Step 6: Commit verified workbench evidence**

```bash
git add src/components/paper-doll/releaseWorkbenchState.ts src/components/paper-doll/releaseWorkbenchState.test.ts docs/paper-doll-rig/CYL9-TEN-CAP-REVIEW.md
git commit -m "test(paper-doll): verify CYL-9ML ten-cap release readiness"
```

---

## Execution checkpoints

1. **After Task 3:** show the clear bottle with shiny-silver cap. Confirm the 362 px fit and approve or revise lighting.
2. **After Task 4:** show the ten-cap finish sheet and five-body assembly lineup. Obtain named pixel and Family Fit approval.
3. **After Task 5:** inspect the new draft release manifest. Do not cut Current Release or sync Sanity without a separate named action.
4. **After Task 6:** report exact tests, hashes, approval state, and remaining release/publication actions.
