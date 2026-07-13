# Best Bottles Hybrid Deterministic Hero Composite Design

**Date:** 2026-07-12

**Status:** Approved direction; pending written-spec review

**Initial family:** Cylinder merchandising curve

**Destination:** Madison Darkroom review lane, then Library and Sanity only after approval

## Objective

Produce premium Best Bottles stone-studio hero images while preserving exact bottle geometry, fitment, cap state, finish, scale, and SKU identity. The approved flattened PNGs supply the product pixels. Deterministic composition owns canvas dimensions, product scale, baseline, sidecar placement, and release metadata. Image generation owns only the stone environment and non-structural polish.

This design replaces the failed method in which a generative model redrew the complete bottle and produced inconsistent dimensions, width, baseline, and circular form.

## Non-negotiable boundaries

1. The flattened-reference directory is read-only:

   `/Users/jordanrichter/Projects/Clients/Nemat-International/Best-Bottles-Website-02-20-2026/pipeline/aios-shopify-pdp-images/00-input/reference-flattened`

2. The hero-image lane must not write into, rename, reorganize, or promote anything inside the existing Shopify/PDP pipeline.
3. The lane must not modify Best Bottles catalog data, Convex, Shopify, Sanity, or pipeline state.
4. Product geometry must come from flattened PNG or reviewed Photoshop pixels. Image generation may not redraw the bottle, neck, thread, fitment, closure, roller, pump, sprayer, dropper, or detached components.
5. Working masks may exist only inside the isolated hero-production output. They are intermediate composition artifacts, not transparent catalog references, and must never be promoted as `flattened-product-truth`.
6. Uniform scaling is allowed. Non-uniform scaling, silhouette warping, generative inpainting across product edges, or geometry-changing retouching is prohibited.
7. A failed or ambiguous source remains blocked. The system must not silently substitute a sibling SKU.

## Source resolution

Each hero item receives a source manifest before composition. Resolution proceeds in this order:

1. Exact website-SKU flattened PNG.
2. Reviewed component assembly when an exact complete PNG is missing. The bottle body and closure must share the same canonical body geometry, neck/fitment standard, capacity, and intended cap state. Every component path and SHA-256 is recorded.
3. Exact reviewed Photoshop source when the flattened directory lacks an adequate body or component.
4. Blocked with an explicit reason when none of the above can prove the requested product.

Component assembly is deterministic. It may combine a verified bottle body with a verified closure or sidecar cap, but it may not borrow a merely similar bottle, infer missing fitments, or use generated product pieces.

The source manifest records:

- website SKU and Grace SKU;
- family, capacity, body material, finish, applicator, closure, neck/fitment, and cap state;
- source path, source type, file dimensions, color space, and SHA-256;
- component lineage when more than one source is used;
- canonical body height, assembled height, and width/diameter;
- target body, assembled, and width pixels;
- baseline, canvas, scale-contract version, and approval state;
- any taxonomy or truth conflict that must remain visible to the reviewer.

## Isolated artifact layout

The first production run uses a new durable folder:

```text
outputs/imagegen/generative-polish/best-bottles-cylinder-hero-hybrid-v1/
  source-manifest/
  source-snapshots/
  working-mattes/
  stage/
  composites/
  qa/
  review/
```

`source-snapshots/` contains content-addressed copies of selected inputs. The original pipeline folder remains untouched. The manifest records both original and snapshot hashes so later source changes cannot silently alter an approved hero.

Madison classification remains separate from the product-image pipeline:

- `source:reference-flattened`
- `workflow:hybrid-deterministic-hero`
- `lane:darkroom-cylinder-studio`
- `asset-status:concept` until QA and human approval
- `push-blocked:true` until explicit promotion

## Locked studio stage

The Cylinder family uses one generated stone-stage master at exactly 2080 × 2288 pixels in sRGB:

- crisp pale ivory porous limestone or travertine floor;
- warm bone/plaster backdrop with restrained contrast;
- soft upper-left key light;
- controlled negative fill suitable for clear glass;
- fixed eye-level product camera and lens character;
- no bottle, label, text, logo, prop, cap, shadow placeholder, or generated product component;
- product contact plane at Y=1990.

The stage is generated and approved once, then reused unchanged across the family. Later families may select a related stone material, but they receive a separate versioned stage master.

## Product isolation and glass treatment

Flattened PNGs use an opaque white presentation canvas. Clear glass cannot be handled as an ordinary hard cutout because white interior pixels represent both background transmission and real specular information. The working composite therefore separates the product into deterministic passes:

1. **Silhouette matte:** establishes the immutable outer boundary and component topology.
2. **Density/edge pass:** preserves dark glass edges, wall thickness, base mass, threads, and closure detail over the stone.
3. **Specular pass:** preserves or rebuilds source-faithful highlights only inside the locked silhouette.
4. **Color/material pass:** retains amber, cobalt, green, frosted, swirl, black, gold, silver, plastic, and metal appearance without changing geometry.
5. **Transmission pass:** allows the approved stone and backdrop to show through clear glass while maintaining realistic contrast.

Working mattes and passes are derived from the approved source pixels. Their boundaries are alpha-locked to the scaled source silhouette. Retouching may remove white-canvas contamination, balance tone, or restore source-faithful highlight contrast, but it may not move an edge, alter the shoulder, change wall thickness, flatten a circular body into a prism, or invent internal hardware.

## Scale and placement

The hero lane consumes pre-resolved per-SKU `assembledTargetPx`, `bodyTargetPx`, and `expectedWidthPx` values from a versioned target manifest produced by the current Cylinder display-scale resolver. It does not introduce, select between, or modify scale curves. Current sources are:

- `docs/best-bottles-canonical-truth/best-bottles-master-truth.csv`;
- `docs/best-bottles-canonical-truth/best-bottles-body-geometry.csv`;
- `src/lib/bestBottlesCylinderDisplayCurve.ts` or its versioned resolved target manifest.

Composition rules:

1. Canvas is exactly 2080 × 2288.
2. Primary bottle contact baseline is exactly Y=1990.
3. Cap-on imagery scales uniformly to the resolved assembled target, then verifies the resulting body height and width.
4. Cap-off or detached-sidecar imagery scales uniformly from the primary bottle body target. Removing or detaching the cap must not enlarge the body.
5. A detached cap shares the Y=1990 contact baseline and uses the same pixels-per-millimeter scale as the primary bottle.
6. Sidecars do not participate in the primary bottle scale calculation.
7. The primary bottle remains centered on the family centerline unless a reviewed sidecar composition defines a bounded horizontal offset.
8. If uniform height scaling causes width to miss its canonical target by more than tolerance, the source is blocked for geometry review. The compositor must not stretch it to force a pass.

This contract prevents a 1 mL bottle from becoming visually larger than a 3 mL bottle and prevents the tall 9 mL Cylinder from becoming too narrow or optically square.

## Shadows, reflections, and generative polish

Shadows and reflections are deterministic derivatives of the locked product silhouette and the approved stage lighting:

- short contact shadow anchors every bottle at Y=1990;
- soft rightward cast shadow matches the upper-left key;
- reflection or caustic treatment is clipped to the floor and remains subordinate to the product;
- detached caps receive their own contact shadow at the same baseline;
- no shadow may conceal the bottle base used by baseline QA.

Image generation may create the empty stage and optional non-structural texture or lighting layers. Product polish must remain mask-constrained. A generated edit that changes any product pixel boundary is rejected rather than repaired by visual judgment.

## Calibration and batch sequence

The first implementation uses three representative calibration cases before the full batch:

1. `GB1mlVBlk`: very small clear vial with black plug/closure; proves small-object scale and glass transmission.
2. `GBCyl5Gl`: clear 5 mL Cylinder with verified shiny-gold sidecar cap; proves deterministic component assembly.
3. `GBTallCyl9Gl`: tall clear 9 mL Cylinder with verified gold sidecar cap; proves width, circular optics, and tall-body scale.

All three must pass automated pixel QA and human visual review before bulk composition. After calibration approval, the same locked stage, matte method, scale resolver, shadow treatment, and QA gate are applied to the approved first twelve hero targets. A failure remains row-scoped and does not authorize a fallback substitution.

## Automated quality gates

Every final composite must pass all applicable checks:

- output dimensions exactly 2080 × 2288;
- sRGB color space;
- primary contact baseline Y=1990 ±4 pixels for antialiasing;
- resolved body height within ±2%;
- resolved assembled height within ±2% for cap-on imagery;
- resolved body width within ±2%;
- uniform scaling only;
- source/snapshot SHA-256 unchanged;
- final silhouette boundary within two pixels of the uniformly scaled source silhouette;
- detached cap at the same baseline and pixels-per-millimeter scale;
- correct component count, cap state, closure, fitment, material, and finish;
- circular-axis products retain the approved round-cylinder optical read;
- no white halo, hard pasted edge, floating base, clipped shadow, duplicated component, label, text, watermark, or invented hardware;
- review manifest contains complete source and scale lineage.

The 9 mL circular-form gate compares the result to the exact flattened reference and rejects faceted or prismatic relighting even if its silhouette measurements pass.

## Review and promotion

The review surface shows the clean composite and a diagnostic overlay for each SKU. The overlay includes target and measured body bounds, assembled bounds where applicable, width, baseline, source identity, scale-contract version, and truth conflicts.

Review states are:

```text
source-resolved
  -> composited
  -> automated-qa-passed
  -> human-approved
  -> library-candidate
  -> sanity-candidate
```

Any failed gate moves the item to `blocked` with a reason. No item enters the Madison Library merely because its batch completed. Sanity push remains a separate explicit human action after Library approval.

## Error handling

- Missing exact source: attempt only a manifest-approved component assembly or exact PSD fallback; otherwise block.
- Ambiguous SKU or taxonomy: preserve the conflict in review metadata and block publication.
- White-background extraction damages glass: reject the matte and refine the deterministic passes; do not ask ImageGen to reconstruct the bottle.
- Width/height mismatch after uniform scaling: block the source or measurement for review; never stretch.
- Generated stage contains product-like objects or shadows: reject and regenerate the empty stage.
- Source hash changes: invalidate the snapshot lineage and require a new review version.
- QA script cannot measure a transparent edge confidently: route to manual geometry review with the source overlay; do not auto-pass.

## Testing strategy

1. Verify the flattened source directory hashes before and after the run to prove read-only behavior.
2. Unit-test uniform scaling, body/assembled target selection, sidecar exclusion, and baseline placement.
3. Golden-test the three calibration composites against their scaled source silhouettes.
4. Verify canvas, color space, target dimensions, measured bounds, and manifest completeness.
5. Visually inspect full-resolution clear-glass edges, shoulder and base geometry, closure fit, circular highlights, contact shadows, and sidecar scale.
6. Rebuild a calibration asset from its manifest and require identical deterministic geometry and placement.
7. Confirm no files were written under the Shopify/PDP pipeline directory.

## Success criteria

The hybrid method is ready for twelve-item production when the three calibration assets:

- use the exact approved product or reviewed component sources;
- retain their source silhouette and fitment topology;
- land at the resolved height, width, and Y=1990 baseline;
- appear integrated into the locked stone setting rather than pasted on top;
- pass all automated gates;
- receive human approval in the separate Madison Darkroom lane.

The first twelve are ready for Library review only when every row has complete provenance, geometry QA, product-truth QA, and a clean final composite. This design does not itself authorize Library ingestion or Sanity publication.
