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
