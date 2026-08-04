# Boston Round 20-400 Roller Parametric Review

Status: exact-alpha material candidates created; material and family-fit review remain open

Scope: 30 mL and 60 mL Boston Round roll-on families

Remote writes: generation-attempt ledger only; no approval, placement, release, or Sanity writes

## Decision

Plastic and metal rollers use one shared fitment geometry. The housing remains natural molded plastic in both variants. Only the ball material changes:

- `PLASTIC`: natural molded-plastic housing and ball;
- `METAL`: the same housing with a mirror-chrome ball.

GPT Image 2 may regenerate material pixels after explicit paid authorization. It cannot change the silhouette, authority mask, component placement, or lifecycle state.

## Geometry evidence

No supplier CAD or standalone physical roller measurements are present in the repository. The review profile is therefore calibrated from the verified 30 mL Boston Round assembly rather than mislabeled as measured product CAD.

- verified bottle diameter: 33 ±0.5 mm;
- measured usable bottle width in the amber assembly: 386 px;
- calibrated scale: 11.696969696969697 px/mm;
- cleaned roller flange width: 210 px → 17.953 mm;
- cleaned roller visible height: 166 px → 14.192 mm;
- measurement tolerance for this review profile: ±0.6 mm.

The flange, housing, shoulder, and ball are separate Blender objects driven by one recipe. Their mesh, camera, studio, and mask recipes are SHA-pinned in the Blender manifest.

## Commands

```bash
npm run paperdoll:render-boston-round-roller
npm run paperdoll:build-boston-round-roller
npm run paperdoll:materialize-boston-round-roller
npm run test:paperdoll:parametric-roller-render
```

The first command renders two material references and one shared object mask. The second clamps both references to the mask, verifies exact pairwise alpha, creates a contact sheet, and emits a no-spend GPT Image 2 material plan. After the two authorized provider calls, the third command calibrates each real provider file, normalizes its detected foreground bounds into the registered authority bounds, copies the exact authority alpha, and writes the material review manifest.

## Material pass v1 — 2026-08-03

Two explicitly authorized high-quality `gpt-image-2` edits completed:

- `PLASTIC` raw SHA-256: `b2d12c07f9f39910076c4d33af9dc4355380c7b62555657f9580e7701ff37b10`;
- `METAL` raw SHA-256: `6c8c4e7a8ea92bc33d6f4fcdf5e336503191ddc4e64079551f48de6ddb6ccfda`.

Real-file foreground calibration was stable from maximum-RGB thresholds 8 through 32. Threshold 16 was selected independently for each provider output before normalization. After the exact-alpha clamp:

- pairwise alpha mismatch: `0` pixels;
- geometry match to the registered review mask: pass;
- production eligibility: false until material review, named geometry approval, and 30/60 mL family fit;
- Current Release and Sanity: unchanged.

Visual disposition:

- `METAL`: strong mirror-chrome ball candidate; positive operator review, but no persisted Approve Pixels action yet;
- `PLASTIC`: usable v1 evidence, but it reads too opaque/white and remains a refinement candidate rather than the recommended production material.

Material artifacts remain under the ignored local path `outputs/paper-doll-parametric-fitments/20-400-roller-fitment/material-v1/`.

## Plastic material pass v2 — 2026-08-03

One separately authorized plastic-only retry used an opaque canonical Bone conditioning canvas instead of the transparent-on-black input used by v1. Its prompt reduces broad white fill and asks for visibly translucent natural molded plastic with denser edges and restrained dielectric highlights.

- conditioning SHA-256: `5b0f85b30e2ce7d4fb26a2736b799673a1bc787d6b5ec7873e8886b4837cb163`;
- raw provider SHA-256: `d49fae0dde00f27955e9ff4bc16432ef9eb89b2c908834a7fbb3278bebed9a34`;
- exact-alpha clamped SHA-256: `85269e247cb1cb1da55207844fec525db44f52136bf1d8a6bcff5d52d6aa3b39`;
- calibrated source bounds at Bone-distance threshold 16: `left 752, top 916, width 590, height 471`;
- authority-alpha mismatch: `0` pixels;
- pairwise mismatch against the metal candidate alpha: `0` pixels.

Plastic v2 is the approved material/pixel candidate. Jordan Richter explicitly accepted this revision on 2026-08-03 after reviewing the three-way v1/v2/metal contact sheet. Plastic v1 is retained as immutable history and superseded for visual review.

This named material decision does not approve the assembly-derived geometry profile and does not constitute Family Fit, shared-placement lock, release, or Sanity publication. A persisted production `Approve Pixels` record may reference only the exact clamped SHA-256 above after the geometry authority is named; it must not silently substitute a later file.

V2 artifacts remain under the ignored local path `outputs/paper-doll-parametric-fitments/20-400-roller-fitment/material-v2/`.

## Approval gates

1. Review the parametric profile against the 30 mL Photoshop assembly.
2. Name the geometry approver and record the approval note.
3. Run GPT Image 2 material edits only after explicit paid authorization.
4. Clamp provider outputs to the approved mask; require zero alpha mismatches.
5. Review placement separately on 30 mL and 60 mL bodies.
6. Approve Pixels, Family Fit, and Lock Shared Placement as separate persisted actions.
7. Keep Current Release and Sanity unchanged until a named release cut.

## Current interpretation

The deterministic mask solves the silhouette-drift problem, but it is still a review candidate because its dimensions are assembly-derived estimates. The system must not display `geometryLocked=true` until named authority approval and exact server-side clamp verification both pass.
