# Boston Round 20-400 Roller Parametric Review

Status: local geometry review candidate; not production approved

Scope: 30 mL and 60 mL Boston Round roll-on families

Remote writes: none

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
npm run test:paperdoll:parametric-roller-render
```

The first command renders two material references and one shared object mask. The second clamps both references to the mask, verifies exact pairwise alpha, creates a contact sheet, and emits a no-spend GPT Image 2 material plan.

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
