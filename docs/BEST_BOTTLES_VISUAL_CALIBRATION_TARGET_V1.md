# Best Bottles Visual Calibration Target v1

**Activated in code:** 2026-07-11  
**Profile:** `best-bottles-pdp-v1`  
**Status:** dry-verified; no paid generation or publishing performed

## Approved target

Jordan approved the reviewed 11-image reconciliation set as the forward visual target, specifically its warmer canvas character, premium material rendering, refined contact/drop shadow, and clean ecommerce presentation.

The 11 images remain the review evidence set. Generation uses one material-matched style reference at a time so product geometry is not averaged across unrelated bottles.

## Measured canvas

All 11 approved images were downloaded and sampled from four corner regions. The approved images are not one exact canvas color; the glass set contains more gradient variation. The deterministic v1 target is therefore the median corner RGB of the seven approved aluminum references:

- **Canvas target:** `#F6EFE8`
- **Derivation:** median corner RGB across seven approved aluminum references
- **Rig behavior:** geometry-only; no global paint-after color shift

The model renders the warm canvas in-scene. The rig uses the target color only as a deterministic fill behind repositioned/masked product pixels.

Measurements are retained locally at:

`tmp/bestbottles-visual-target-v1/measurements.json`

## Canonical style-only references

| Material profile | Image ID | Measured corner tone | Purpose |
|---|---|---:|---|
| Glass | `66bcb944-30e3-4df5-9fd0-c00d1db8aaba` | `#E5DBC8` | Glass wall definition, edge density, refraction, specular rhythm, contact shadow |
| Aluminum | `d14626f5-1a98-493d-b2c0-6d2ba9579db1` | `#EEE1D4` | Satin-metal gradient, edge glints, reflection-card rhythm, contact shadow |

These are **style-only**. The primary product reference remains the sole authority for silhouette, geometry, closure, applicator, components, color, scale, centerline, and baseline.

## Runtime behavior

Every Best Bottles Studio master and family-runner request now receives:

1. The SKU-specific **Product Reference** as image 1.
2. The material-matched **Style Reference** as image 2.
3. A versioned `VISUAL CALIBRATION TARGET — best-bottles-pdp-v1` prompt block.
4. Lineage tags:
   - `visual-target:best-bottles-pdp-v1`
   - `style-reference-image:<image-id>`
   - `material-profile:glass|aluminum`
5. The calibration tags duplicated into the precompiled prompt QA checklist.

An operator-selected style reference can override the default in Madison, but it remains style-only.

## Prompt authority

The calibration block instructs the model to match:

- approved warm canvas tone `#F6EFE8`
- material-specific highlight and reflection behavior
- premium material separation
- refined local contact shadow
- soft feathered shadow falloff
- restrained shadow spread
- no pasted-on or floating appearance

It also explicitly forbids copying the style reference's silhouette, bottle family, closure, applicator, color, scale, crop, geometry, composition, or components.

## Verification performed

- Focused calibration tests: **4 passed**
- TypeScript: **passed** (`npx tsc --noEmit`)
- Canonical glass reference: **HTTP 200 image/png**
- Canonical aluminum reference: **HTTP 200 image/png**
- Cylinder dry run: target block, glass style reference, and lineage tags **present**
- Aluminum Bottle dry run: target block, aluminum style reference, and lineage tags **present**
- Dry runs confirmed: **no generation, no rig, no Supabase writes**

## Live smoke attempt — 2026-07-11

A one-SKU aluminum smoke was attempted for `AB-ALU-CLR-100ML-SPR-BLK`.

1. The first request exposed an old live Edge Function contract that rejected any style reference.
2. The contract was updated to allow exactly one product reference plus at most one style-only calibration reference, with no background references.
3. Fourteen focused contract/calibration tests and TypeScript passed.
4. `generate-madison-image` was redeployed successfully to Supabase project `likkskifwsrvszxdvufw`.
5. The retry reached OpenAI but returned `billing_hard_limit_reached` from the live `OPENAI_API_KEY` before image creation.

The local `.env` key fingerprint matches the Supabase secret digest, so this is not a stale-key mismatch. The OpenAI project/account hard budget limit still needs to be raised or reset. No image was created, no rig ran, and nothing was published.

## Next gate

After the OpenAI project hard limit is active, rerun the same one-SKU paid smoke. Compare it against the v1 target for identity, canvas tone, material quality, shadow behavior, framing, baseline, and rig QA before any family batch.
