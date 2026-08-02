# Best Bottles Cylinder 75-Type Lineup Design

**Date:** 2026-07-12  
**Status:** Approved for implementation planning  
**Prompt contract:** `best-bottles-reference-locked-v6.1`  
**Scale contract successor:** measurement-driven Cylinder display curve

## Objective

Create a stakeholder-ready image set showing every unique Cylinder physical combination exactly once. The set must preserve real catalog identity, expose the corrected comparative-size curve, and remain readable at both presentation and technical-review scales.

The deliverable contains eight detailed coverage plates plus one panoramic master. The master has a clean stakeholder version and an annotated verification derivative generated from the same manifest.

## Source authority

1. The authoritative Photoshop archive is read-only:
   `/Users/jordanrichter/Projects/Clients/Nemat-International/Best-Bottles-Original-Photoshop-Sources`.
2. Exact approved PSD composites are preferred for identity and topology.
3. When the PSD archive lacks an exact product, an exact-SKU Shopify or legacy catalog asset may be used only with recorded provenance and a human identity decision.
4. A sibling SKU, generated bottle, fuzzy filename match, or invented closure may not fill a source gap.
5. The 227 ml / 8 oz plastic Cylinder is the large plastic representative in the master overview. The endpoint is the distinct 500 ml aluminum bottle.

## Coverage manifest

The catalog currently resolves to 75 unique physical combinations after cosmetic color and finish duplicates are collapsed by capacity, body category, neck finish, applicator, and cap style.

Each manifest row records:

- canonical Grace SKU and website SKU;
- capacity and family;
- body category and material;
- neck finish;
- applicator and cap style;
- assembled height, body height, and diameter;
- measurement source and reconciliation status;
- PSD or catalog-reference path and checksum;
- identity, cap-state, and topology review status;
- plate number and position;
- resolved display-height target and primary-bottle bounds;
- v6.1 prompt and shadow lineage.

Every one of the 75 rows appears on exactly one detailed plate. No detailed plate substitutes or duplicates a physical type.

## Nine-image structure

1. **Vials and samples, 1–4 ml:** 10 types.
2. **Caps and large formats:** 12 types.
3. **Metal roll-ons:** 11 types.
4. **Plastic roll-ons:** 11 types.
5. **Fine-mist and perfume sprayers:** 7 types.
6. **Lotion pumps:** 9 types.
7. **Reducers, decorative caps, and glass-rod special:** 7 types.
8. **Vintage bulb sprayers, with and without tassels:** 8 types.
9. **Panoramic master:** all 75 detailed-plate products in one continuous measured row, followed by the supplemental 500 ml aluminum scale endpoint. The master therefore displays 76 objects: 75 Cylinder physical types plus one clearly identified cross-family endpoint.

Plate 9 produces two files from the same placement manifest:

- a clean stakeholder master with no labels;
- an annotated verification master with capacity, SKU/type, measurements, and resolved target beneath every bottle.

## Measurement-driven display curve

Capacity alone cannot determine display height. Verified assembled height is the primary vertical-scale input; verified body height preserves cap-on/cap-off body consistency; diameter validates the resulting width and perceived mass.

The first calibration draft uses monotonic, piecewise-linear measured-height knots:

```text
assembled height (mm): 35, 47, 54, 55, 75, 100, 128, 159, 180, 186, 250
display height (%):    52, 55, 57.5, 58, 71, 76, 79, 84, 88, 90, 92
```

Values between knots use monotonic linear interpolation. Values below 35 mm clamp to 52%; values above 250 mm clamp to 92%.

This draft intentionally produces visible but compressed transitions. For the reviewed anchors it yields approximately:

- 5 ml, 55 mm: 58%;
- 9 ml, 75 mm: 71%;
- 28 ml, 100 mm: 76%;
- 50 ml, 128 mm: 79%;
- 100 ml, 180 mm: 88%;
- 227 ml plastic, 159 mm: 84%;
- 500 ml aluminum, 186 mm: 90%, with its 74 mm diameter preserving greater visual mass.

After closure contribution is removed, these knots keep the 9 ml body approximately 6.8% taller than the 5 ml body and the 100 ml body approximately 4.3% taller than the 50 ml body.

The transform is a calibration proposal, not storefront approval. The annotated master must expose the measurements and resolved percentages for stakeholder review before the curve version is locked.

Automated validation must reject:

- a larger measured body rendering shorter than a smaller equivalent body;
- a 9 ml body at or below the 5 ml body target;
- a 28 ml body at or below the 9 ml body target;
- a 100 ml body at or below the 50 ml body target;
- width or sidecar constraints changing primary-bottle height;
- unresolved or disputed measurements entering the master.

## Composition and visual contract

All plates use:

- a warm bone `#F5F3EF` background;
- one shared shelf baseline;
- forward-facing real product geometry;
- complete uncropped primary products;
- deterministic spacing and ordering;
- v6.1 soft neutral-gray contact and drop shadows;
- empty, colorless clear glass;
- no labels, logos, props, liquid, hands, or invented components.

Detached caps, bulbs, tassels, droppers, and other sidecars occupy reserved lanes. They never participate in primary-bottle scale, centerline, or baseline calculations.

## GPT Image 2 role

The governing rule remains: **the model paints; code places**.

Code owns source selection, identity, scale, primary bounds, ordering, baseline, spacing, panel membership, and stitching. GPT Image 2 receives locked, deterministic plate compositions and may improve only:

- material realism;
- bone-background integration;
- studio lighting;
- highlight restraint;
- v6.1 grounding shadows.

GPT Image 2 may not add, remove, merge, duplicate, resize, reorder, relabel, recolor, or redesign a product.

## Master construction

Generating all 75 products in one model call is prohibited because identity retention becomes unreliable. Each detailed plate is polished independently from its locked composition. Deterministic code then assembles the approved product layers into the panoramic master using the global manifest.

The master is an ultra-wide native-resolution artifact intended for zooming, horizontal scrolling, and large-format stakeholder display. It is assembled from the approved identity-locked product layers with deterministic v6.1 grounding; it does not extract products back out of GPT-polished plate backgrounds. A presentation-sized derivative may be produced, but it cannot replace the native master or become scale evidence.

## Review gates

1. **Identity review:** exact product, material, neck, closure, and topology.
2. **Measurement review:** assembled height, body height, diameter, and source status.
3. **Scale review:** monotonic body targets and visibly credible transitions.
4. **Plate review:** shared baseline, spacing, shadow, crop, and no sidecar-driven shrink.
5. **Master review:** all 75 manifest rows present once, correct order, and identical scale lineage in clean and annotated variants.

No output is approved storefront media until a separate publication decision. This project performs no Shopify, Convex, or Supabase mutation.

## Deliverables

- one versioned 75-row selection manifest;
- eight clean detailed plates;
- one clean 75-bottle panoramic master;
- one annotated derivative of the same master;
- one QA report containing identity, measurement, scale, and render evidence;
- one missing or disputed source report with no fabricated substitutions.
