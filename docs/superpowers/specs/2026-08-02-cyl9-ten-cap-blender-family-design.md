# CYL-9ML Ten-Cap Blender Family — design

**Date:** 2026-08-02

**Status:** approved direction; written review gate before implementation

**Family:** `CYL-9ML`, 17-415 roll-on over-cap

**Parent designs:**

- `docs/superpowers/specs/2026-07-30-paper-doll-rig-design.md`
- `docs/superpowers/specs/2026-08-01-cyl-9ml-family-release-v1-design.md`

## Purpose

Create ten catalog-ready roll-on over-cap variants from one calibrated Blender
geometry so every variant is pixel-identical in silhouette and can be swapped over
the five locked 9 ml Cylinder body plates without changing the bottle beneath it.

The first review artifact is one assembled clear bottle with the shiny-silver cap.
That artifact is approved for geometry, fit, camera, and lighting before the other
nine finishes are rendered.

This work does not regenerate or modify the five locked body plates, the approved
plastic and metal roller fitments, Current Release, or any active Sanity document.

## Decisions

1. The existing approved-looking shiny-silver cap photograph is the visual
   silhouette and camera authority.
2. One rotationally symmetric Blender mesh is the geometry authority for all ten
   variants. Independently generated cap geometry is prohibited.
3. Paper-doll pixel fit and physical millimetre accuracy are recorded separately.
   Pixel fit can be approved now; verified supplier or caliper measurements can
   replace provisional dimension metadata later without silently moving an approved
   paper-doll placement.
4. The current generic Blender cylinder is a prototype, not an approved master. Its
   top corners are too round and it exposes too much top surface compared with the
   shiny-silver authority image.
5. Geometry is called locked only after the rendered layer is clamped to the shared
   authority mask and exact alpha identity passes.
6. Lighting approval is a named review step. It follows geometry and fit review and
   precedes the nine-variant batch.

## Ten-variant scope

| Variant key | Catalog finish | Blender treatment |
|---|---|---|
| `SSLV` | Shiny Silver | vacuum-metallized mirror chrome |
| `MSLV` | Matte Silver | smooth low-gloss silver coating |
| `SGLD` | Shiny Gold | vacuum-metallized warm gold mirror |
| `MGLD` | Matte Gold | smooth low-gloss warm gold coating |
| `SBLK` | Shiny Black | deep glossy black phenolic plastic |
| `MCPR` | Matte Copper | smooth low-gloss warm copper coating |
| `WHT` | White | smooth glossy white phenolic plastic |
| `SLDT` | Silver Dotted | shiny silver plus deterministic clear crystals |
| `BKDT` | Black Dotted | glossy black plus the same crystal layout |
| `PKDT` | Pink Dotted | smooth matte pink plus the same crystal layout |

The caps are moulded phenolic plastic. The words aluminium, anodised, brushed,
machined, and metal must not appear in renderer material labels or AI prompts. Only
the roller ball may be steel; it is outside this cap-family mesh.

## Authority hierarchy

### Visual silhouette authority

`assets/paper-doll/components/closure__17-415__roll-on-over-cap__shiny-silver.png`

Its alpha contour, width-to-height ratio, side taper, bottom edge, top-corner radius,
and visible top-face proportion define the target appearance. The small photograph
is a calibration reference, not a production output.

### Parametric geometry authority

Blender creates the cap from a versioned half-profile revolved around the vertical
axis. Profile parameters describe:

- outside diameter;
- overall height;
- side taper;
- top-corner radius;
- top-face depth;
- bottom lip and opening;
- wall thickness.

The initial physical scale is nominally 19.5 mm outside diameter with height solved
from the approved silhouette, approximately 28.5 mm. The existing 21 mm registry
height is treated as unverified legacy metadata because it contradicts the approved
image's aspect. A later verified measurement creates a new geometry-metadata
version; it does not rewrite history.

### Paper-doll placement authority

The full-canvas release layer uses the canonical `2080 × 2288` coordinate system.
Madison stores one versioned family transform containing uniform scale, centreline,
and cap seat. The transform is calibrated on the clear bottle review artifact and
then applied identically to Amber, Cobalt, Clear, Frosted, and Swirl.

If a plate ever requires an exception, it must be an explicit, versioned plate
override with a reason and named approval. Silent per-bottle nudges are prohibited.

## Calibration workflow

1. Extract and normalize the shiny-silver authority alpha contour.
2. Fit a revolved Blender half-profile to that contour using orthographic projection.
3. Adjust the camera elevation until the visible top-face proportion matches the
   authority image.
4. Render a dedicated binary object-mask pass from the same camera and mesh.
5. Place the rendered silver layer on the locked clear body using the existing
   family placement model.
6. Produce a review bundle containing the authority silhouette, Blender silhouette,
   difference image, isolated cap, clear-bottle assembly, and five-body lineup.
7. Obtain named geometry-and-fit approval.
8. Tune the studio reflection rig and obtain named lighting approval on the clear
   bottle plus isolated cap.
9. Freeze mesh, camera, object mask, placement, render settings, and lighting recipe
   by hashes and version identifiers.
10. Render the remaining nine variants without changing geometry, camera, placement,
    resolution, or object mask.

The user-facing order is deliberate: first approve the finished clear bottle with
the silver cap; then discuss and adjust lighting; then expand to all ten.

## Material and lighting model

Blender Cycles renders transparent RGBA with a fixed camera and studio environment.
The light contract is one large soft key from camera-right, gentle fill from the
left, and a warm cream environment matching `#F5F3EF`. The transparent film prevents
the studio background from becoming part of the cap alpha.

Mirror finishes use crisp reflected vertical bands produced by emissive studio
panels. Matte coatings use the same studio with increased microsurface roughness and
a broad diffuse sheen. Glossy black and white remain dielectric phenolic plastic,
not metallic materials. Color-management and exposure are frozen after the silver
lighting review.

AI image generation is not a geometry authority. It may be used later to propose
material references or internal RGB detail, but any accepted pixels must remain
inside the approved mask and pass the same release workflow.

## Rhinestone variants

One deterministic crystal layout is authored once in normalized cylindrical
coordinates and instanced for all three dotted variants. Each stone has a stable ID,
row, angular position, vertical position, scale, and orientation. Silver Dotted,
Black Dotted, and Pink Dotted reuse those exact transforms.

Stones may change RGB appearance and reflections but may not expand the family
silhouette. Final dotted renders are clamped to the same cap authority mask. This
preserves per-stone placement while guaranteeing the paper-doll layer boundary is
identical to every plain finish.

## Geometry lock and QA

The QA system measures real alpha and mask files, never brightness against the frame.
No material-dependent intensity threshold is allowed to define geometry.

Blocking checks:

1. Production layers are exactly `2080 × 2288` RGBA.
2. Every variant references the same mesh, camera, object-mask, placement, lighting,
   and renderer recipe versions.
3. The Blender mask is a single intended cap region and is not the image frame.
4. The calibrated Blender silhouette agrees with the photographic authority at the
   documented calibration tolerance, with the difference image retained as evidence.
5. After mask-and-clamp, pairwise alpha occupancy across all ten variants is exact:
   IoU `1.0000` and zero mismatched occupied pixels.
6. No output clips the canvas, contains a background, cast shadow, detached island,
   or contact shadow in alpha.
7. Mirror, matte, glossy, white, and dotted fixtures each pass calibrated tone and
   material checks based on real approved files.
8. All five assembled previews resolve the same family placement version and remain
   centred and seated.
9. Existing body and roller hashes remain unchanged.

An output can be visually reviewed while a gate is pending, but it cannot be labeled
geometry locked or enter a release cut until every blocking geometry check passes.

## Madison workflow

The existing Production Candidate Bench remains the shell. It gains a ten-cap family
candidate rather than a new standalone Studio.

The cap family progresses through these states:

```text
Calibrating Master
  -> Silver Geometry Review
  -> Silver Lighting Review
  -> Ten-Variant Render
  -> Ten-Variant Pixel Review
  -> Five-Body Family Fit
  -> Lock Shared Placement
  -> Release-Cut Eligible
```

The first milestone surfaces only the clear body with silver cap, plus comparison
evidence. Later screens show the ten finish tiles and the five-body lineup. Named
actions remain: Approve Pixels, Family Fit, and Lock Shared Placement.

## Release and Sanity boundary

Approved cap assets create immutable component versions. Adding them to Current
Release requires a named append-only release cut. Madison may then sync the release
to a Sanity draft. Public publication remains a separate named action and is not part
of this rendering milestone.

No prototype render, legacy cap, or unapproved material replaces Current Release.
The four existing pilot cap layers remain historical evidence until the ten-cap
family passes this workflow.

## Testing and evidence

Automated tests cover:

- deterministic profile and camera recipe serialization;
- repeatable object-mask generation;
- exact alpha identity after mask-and-clamp;
- stable rhinestone transforms across dotted variants;
- canonical full-canvas placement;
- unchanged frozen body and roller hashes;
- variant-key completeness and uniqueness;
- release validator rejection of mixed geometry, camera, mask, or placement versions.

The review bundle records Blender version, renderer settings, Git commit, input and
output hashes, calibration metrics, and all approval names and timestamps.

## Completion criteria

This milestone is complete when:

1. the clear 9 ml bottle with shiny-silver cap is approved for geometry, fit, and
   lighting;
2. all ten cap layers are rendered from one frozen Blender mesh;
3. every pair has exact alpha identity after mask-and-clamp;
4. the ten caps pass visual material review;
5. all five locked body assemblies pass Family Fit using one shared placement;
6. a named placement lock is written; and
7. the cap family is eligible for an append-only release cut and Sanity draft sync.
