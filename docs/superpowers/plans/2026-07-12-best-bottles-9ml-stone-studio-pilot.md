# Best Bottles 9 mL Stone-Studio Pilot Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce four reviewable, SKU-faithful Cylinder 9 mL stone-studio image examples that prove the approved visual system at scale.

**Architecture:** Each image uses one SKU-matched flattened Photoshop reference as the product-identity lock and the approved Cylinder stone hero as the shared lighting and stage reference. Built-in ImageGen produces the photographic masters; ImageMagick normalizes the selected outputs to the exact 2080 × 2288 grid contract and builds a deterministic review contact sheet.

**Tech Stack:** Built-in GPT Image generation, SKU-matched Photoshop/flattened PNG references, ImageMagick, JSON provenance manifest, Creative Production review artifacts.

## Global Constraints

- Create image assets and review artifacts only; do not change website, catalog, Sanity, Convex, Shopify, route, or product code/data.
- Preserve the Cylinder 9 mL geometry: 70 mm body height, 20 mm diameter, 17-415 neck.
- Use the same warm ivory travertine slab, warm bone/plaster background, upper-left key light, eye-level camera, and common baseline for all four outputs.
- Preserve the exact SKU fitment, roller material, glass finish, and matte-gold sidecar cap from the flattened reference.
- Do not add labels, logos, liquid, text, props, extra caps, or invented components.
- Final single-product masters must be 2080 × 2288 pixels in sRGB.

---

### Task 1: Lock the four product references and output structure

**Files:**
- Create: `outputs/imagegen/generative-polish/best-bottles-9ml-stone-studio-pilot-20260712/references/`
- Create: `outputs/imagegen/generative-polish/best-bottles-9ml-stone-studio-pilot-20260712/generated/`
- Create: `outputs/imagegen/generative-polish/best-bottles-9ml-stone-studio-pilot-20260712/final/`
- Create: `outputs/imagegen/generative-polish/best-bottles-9ml-stone-studio-pilot-20260712/review/`
- Create: `outputs/imagegen/generative-polish/best-bottles-9ml-stone-studio-pilot-20260712/data/manifest.json`

**Interfaces:**
- Consumes: canonical SKU rows and the four exact flattened PNG paths from the approved design.
- Produces: stable copied references and a manifest entry for each requested asset.

- [ ] **Step 1: Create the run folders**

Run:

```bash
mkdir -p outputs/imagegen/generative-polish/best-bottles-9ml-stone-studio-pilot-20260712/{references,generated,final,review,data}
```

Expected: all five directories exist and contain no generated master yet.

- [ ] **Step 2: Copy the four exact flattened references and shared stone reference**

Copy these sources without modifying the originals:

```text
Clear metal roller:
pipeline/aios-shopify-pdp-images/06-archive/2026-07-11-pre-cap-off-clear-cylinder-9ml/cylinder-9ml-clear-17-415-rollon/GB-CYL-CLR-9ML-T-04__GBCyl9MtlRollMattGl__pdp-main__v001.png

Clear plastic roller:
pipeline/aios-shopify-pdp-images/06-archive/2026-07-11-pre-cap-off-clear-cylinder-9ml/cylinder-9ml-clear-17-415-rollon/GB-CYL-CLR-9ML-T-13__GBCyl9RollMattGl__pdp-main__v001.png

Cobalt plastic roller:
pipeline/aios-shopify-pdp-images/00-input/reference-flattened/cylinder-9ml-cobalt-blue-17-415-rollon/GB-CYL-BLU-9ML-ROL-MGLD__GBCylBlu9RollMattGl__pdp-main__v001.png

Frosted metal roller:
pipeline/aios-shopify-pdp-images/00-input/reference-flattened/cylinder-9ml-frosted-17-415-rollon/GB-CYL-FRS-9ML-MRL-MGLD__GBCylFrst9MtlRollMattGl__pdp-main__v001.png

Shared stage reference:
outputs/imagegen/generative-polish/best-bottles-cylinder-canonical-truth-hero-20260712-v6/final/best-bottles-cylinder-glass-canonical-truth-hero-v6-2400x1200.png
```

Expected: five non-zero PNG files exist in `references/` and identify as sRGB PNGs.

- [ ] **Step 3: Write the initial manifest**

The JSON must contain one object per asset with `id`, `websiteSku`, `graceSku`, `family`, `capacityMl`, `glassFinish`, `applicator`, `ballMaterial`, `capFinish`, `bodyHeightMm`, `diameterMm`, `neckThreadSize`, `referencePath`, `styleReferencePath`, `generatedPath`, `finalPath`, `status`, and `reviewNotes`.

Expected: `ruby -rjson -e 'JSON.parse(File.read(ARGV[0])); puts "valid"' <manifest>` prints `valid`.

- [ ] **Step 4: Commit the plan-only artifact if it is not already committed**

```bash
git add docs/superpowers/plans/2026-07-12-best-bottles-9ml-stone-studio-pilot.md
git commit -m "docs(best-bottles): plan 9ml stone studio pilot"
```

Expected: only the plan document is committed; generated image outputs remain review artifacts.

### Task 2: Generate the clear metal-roller stage master

**Files:**
- Create: `outputs/imagegen/generative-polish/best-bottles-9ml-stone-studio-pilot-20260712/generated/01-clear-metal-roller.png`
- Create: `outputs/imagegen/generative-polish/best-bottles-9ml-stone-studio-pilot-20260712/final/01-clear-metal-roller-2080x2288.png`

**Interfaces:**
- Consumes: clear metal-roller flattened reference and shared stone reference.
- Produces: the first approved photographic master and the stage/alignment target for later examples.

- [ ] **Step 1: Generate one referenced product image**

Use built-in ImageGen with the clear metal-roller reference as the strict product-identity reference and the existing Cylinder hero as the stage-style reference. Require the exact exposed metal roller, clear 9 mL body, and matte-gold sidecar cap.

Expected: one photorealistic product image with one bottle and one sidecar cap on the locked stone stage.

- [ ] **Step 2: Inspect product truth**

Verify visually that the roller is metallic, the 17-415 neck remains visible, the body remains straight-sided and proportionate, the cap is matte gold, and no additional component appears.

Expected: all checks pass; otherwise regenerate with one targeted correction.

- [ ] **Step 3: Normalize the final master**

```bash
magick generated/01-clear-metal-roller.png -filter Lanczos -resize '2080x2288^' -gravity center -extent 2080x2288 final/01-clear-metal-roller-2080x2288.png
```

Expected: `identify` reports exactly `2080x2288 sRGB`.

### Task 3: Generate the remaining three matched examples

**Files:**
- Create: `generated/02-clear-plastic-roller.png`
- Create: `generated/03-cobalt-plastic-roller.png`
- Create: `generated/04-frosted-metal-roller.png`
- Create: `final/02-clear-plastic-roller-2080x2288.png`
- Create: `final/03-cobalt-plastic-roller-2080x2288.png`
- Create: `final/04-frosted-metal-roller-2080x2288.png`

**Interfaces:**
- Consumes: each exact flattened reference, the shared stage reference, and the approved first master as a placement/lighting reference.
- Produces: three matched final masters with identical stage, camera, baseline, and object scale.

- [ ] **Step 1: Generate the clear plastic-roller example**

Require a translucent white plastic roller ball and plastic housing. Explicitly prohibit metallic ball reflections.

Expected: the plastic roller is visibly distinct from the metal-roller example while body size and placement match.

- [ ] **Step 2: Generate the cobalt plastic-roller example**

Require true saturated cobalt glass, visible transmitted blue light, plastic roller fitment, and the exact matte-gold sidecar cap from the source.

Expected: the cobalt finish remains glass rather than opaque paint or plastic.

- [ ] **Step 3: Generate the frosted metal-roller example**

Require translucent frosted glass with visible edge density and a clearly metallic roller ball. Preserve the matte-gold sidecar cap.

Expected: the bottle reads as frosted glass rather than white plastic and the roller reads as metal.

- [ ] **Step 4: Normalize all three finals**

Use the same ImageMagick resize and center-extent command as Task 2 for each generated image.

Expected: all three finals report exactly `2080x2288 sRGB`.

### Task 4: Build the review pack and validate the pilot

**Files:**
- Create: `review/best-bottles-9ml-stone-studio-pilot-contact-sheet.png`
- Create: `review/review-manifest.json`
- Create: `review/review-board.html`
- Modify: `data/manifest.json`

**Interfaces:**
- Consumes: four exact final masters and their provenance metadata.
- Produces: one durable four-image review surface and a completed manifest.

- [ ] **Step 1: Build a deterministic two-by-two contact sheet**

Use ImageMagick montage with a neutral inspection background and concise SKU labels outside the image areas.

Expected: a two-by-two contact sheet contains each final exactly once with no cropping of the bottle or sidecar cap.

- [ ] **Step 2: Render the standard Creative Production review board**

Use the shared Creative Production review renderer with the `image-wall` preset, four individual image items, and captions enabled for SKU and material identity.

Expected: `review-board.html` loads four non-zero image tiles; the contact sheet remains supplemental.

- [ ] **Step 3: Complete the provenance manifest**

Set each item to `generated_for_review`, record the exact reference path, built-in ImageGen usage, final pixel dimensions, SHA-256 digest, and any remaining review risk.

Expected: the manifest parses as JSON and contains four unique IDs, four unique final paths, and four hashes.

- [ ] **Step 4: Run final validation**

```bash
identify final/*.png
shasum -a 256 final/*.png
```

Expected: four 2080 × 2288 sRGB PNGs, four non-empty unique hashes, a visible common baseline, correct roller material, correct glass finish, one matte-gold sidecar cap per roll-on image, and no invented components.

- [ ] **Step 5: Present the pilot for review**

Show the four individual outputs and the contact sheet. State that they are review examples and have not been integrated into the website or product data.
