# Best Bottles 9 mL Stone-Studio Pilot Design

Date: 2026-07-12
Status: Approved for planning
Scope owner: Best Bottles creative production

## Purpose

Establish a repeatable Best Bottles stone-studio image system using the Cylinder 9 mL body as the first production pilot. The pilot must demonstrate the important product differences without generating every possible glass-finish, applicator, cap-color, and trim permutation.

The result becomes the pattern for the wider family-image program: exact product truth, one shared photographic stage, curated representatives, and deterministic output formats for the website.

## Approved Curation Rule

Create another image only when it introduces at least one of these customer-visible truths:

1. A different physical bottle body or measured geometry.
2. A different glass color or finish.
3. A visibly different applicator topology, such as metal roller, plastic roller, fine-mist spray, lotion pump, dropper, plug, or glass wand.

Do not create another hero image only because the cap color, trim color, dotted finish, matte finish, or shiny finish changes. Those variations remain available through product detail imagery, swatches, or secondary media.

## Canonical Source Hierarchy

Use the following sources in order:

1. `docs/best-bottles-canonical-truth/best-bottles-master-truth.csv` for SKU identity, family, capacity, material, glass finish, applicator, cap, neck, and readiness.
2. `docs/best-bottles-canonical-truth/best-bottles-body-geometry.csv` for measured body geometry and family scale.
3. SKU-matched Photoshop files or flattened PNGs for exact bottle silhouette, roller or spray fitment, sidecar-cap shape, component relationships, and material appearance.
4. Existing approved Best Bottles stone imagery for stage mood, lighting, glass contrast, and brand continuity only.

Image generation may improve lighting and material realism, but it may not invent or replace bottle geometry, neck topology, applicator construction, cap state, or glass finish.

## Approved 9 mL Representative Set

Produce seven single-bottle stone-studio masters:

| # | Glass finish | Applicator | Sidecar or closure treatment | Canonical representative |
|---|---|---|---|---|
| 1 | Clear | Metal roller ball | Matte-gold sidecar cap | `GBCyl9MtlRollMattGl` / `GB-CYL-CLR-9ML-T-04` |
| 2 | Clear | Plastic roller ball | Matte-gold sidecar cap | `GBCyl9RollMattGl` / `GB-CYL-CLR-9ML-T-13` |
| 3 | Amber | Metal roller ball | Matte-gold sidecar cap | `GBCylAmb9MtlRollMattGl` / `GB-CYL-AMB-9ML-MRL-MGLD` |
| 4 | Cobalt Blue | Plastic roller ball | Matte-gold sidecar cap | `GBCylBlu9RollMattGl` / `GB-CYL-BLU-9ML-ROL-MGLD` |
| 5 | Frosted | Metal roller ball | Matte-gold sidecar cap | `GBCylFrst9MtlRollMattGl` / `GB-CYL-FRS-9ML-MRL-MGLD` |
| 6 | Swirl | Plastic roller ball | Matte-gold sidecar cap | `GBCylSwrl9RollMattGl` / `GB-CYL-CLR-9ML-ROL-MGLD-01` |
| 7 | Clear | Fine-mist sprayer | One representative black sprayer | `GBCyl9SpryBlk` / `GB-CYL-CLR-9ML-T-21` |

All seven canonical representatives are marked ready in the canonical truth sheet. Before generation, the production step must still confirm that the selected flattened PNG or Photoshop source visibly matches the listed applicator and cap treatment.

## Visual Stage Contract

All pilot images share one locked studio environment:

- Warm ivory or light travertine stone surface with restrained natural texture.
- Warm bone or plaster background with enough tonal contrast to define clear glass.
- Soft directional key light from upper left.
- Controlled negative fill and vertical reflection cards to create dark glass edges and bright internal highlights.
- Realistic clear-glass wall thickness, base mass, rim detail, refraction, and soft caustics.
- Eye-level frontal product camera with an 85–100 mm product-lens look.
- One common bottle baseline and constant camera distance across all seven images.
- No labels, logos, liquid, decorative props, hands, text, or invented components.

The matte-gold sidecar cap is the common roll-on styling choice because it is commercially available in the selected product set, supports the Best Bottles muted-gold palette, and remains legible against the warm stone. The cap must retain the exact SKU-matched shape and finish.

## Output Formats

### Single-product grid master

- Canvas: 2080 × 2288 pixels.
- Ratio: 10:11.
- Bottle centered on the locked stone baseline.
- Consistent camera distance, top air, side margins, and object scale.
- Sidecar cap retained only when it is present in the canonical reference and approved representative composition.

### Wide collection hero

- Canvas: 2400 × 1200 pixels.
- Ratio: 2:1.
- Uses the same stone, backdrop, lighting direction, lens character, and glass treatment as the single-product masters.
- Shows the approved seven representatives as one cohesive 9 mL collection.
- Reserves approximately the left 35–40% as calm copy-safe space for the website gradient and text.
- Keeps all products on one visual baseline with close, controlled spacing.

### Family-card derivative

- Canvas: 1200 × 1600 pixels.
- Ratio: 3:4.
- Uses three to five representatives from the approved set rather than forcing all seven into the crop.
- Keeps the central products fully visible when the website applies `object-cover`.

## Production Flow

1. Resolve and visually inspect the exact Photoshop or flattened PNG reference for each approved SKU.
2. Confirm measured 9 mL body geometry and common baseline target.
3. Generate the seven single-product masters against the locked stone stage.
4. Review each master for body identity, glass finish, applicator topology, cap state, material fidelity, and baseline.
5. Reject and regenerate any asset that invents a fitment, substitutes roller material, changes bottle geometry, or creates detached components not present in the reference.
6. Build the wide collection hero from the approved masters and the locked stage treatment.
7. Produce the portrait family-card derivative.
8. Create a review contact sheet and provenance manifest before any website or catalog integration.

## Quality Gates

Every final asset must pass:

- Exact SKU and source-reference match.
- Correct 9 mL body height-to-width relationship.
- Correct neck and applicator construction.
- Visibly distinct metal versus plastic roller material.
- Correct clear, amber, cobalt, frosted, or swirl glass treatment.
- Bottle baseline drift no greater than 12 pixels within the 2080 × 2288 master system.
- Product-height drift no greater than 2% from the approved 9 mL geometry target.
- No extra cap, duplicate bottle, false pump, flat cap substituted for a pump, or detached component invented by generation.
- Exact output dimensions and color space.
- Reopenable source, reference, generated layer, final export, and provenance files in a stable output directory.

## Pilot Boundaries

This pilot creates reviewable image assets only. It does not modify homepage code, catalog code, Sanity schemas, Convex data, Shopify media, route mappings, or product records.

Website integration and scaling from the 9 mL pilot to the remaining Cylinder bodies require a separate implementation plan after the pilot design and output set are approved.

## Scaling Rule After the Pilot

For every later capacity and family, start with one physical body master. Add curated images for available glass finishes and for each materially different applicator topology. Do not multiply the set across cap colors or trim finishes unless a merchandising decision explicitly promotes that finish as a separate visual story.
