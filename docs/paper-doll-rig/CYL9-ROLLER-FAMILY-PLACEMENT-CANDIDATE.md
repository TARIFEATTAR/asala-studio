# CYL-9ML roller family placement candidate

Status: visual calibration only; no release-ledger or Sanity write.

## Correct layer doctrine

The plastic and metal roller insertion plug is intentionally omitted from the visible 2D layer. The cropped shell must never paint over the immutable glass threads. This is a paper-doll placement problem, not missing component geometry.

## Calibrated candidate

- Reference body: locked amber CYL-9ML plate
- Applies to: AMB, BLU, CLR, FRS and SWL plates
- Applies to: every roller material variant sharing this roller geometry family
- Registered roller alpha contact: Y 918
- Shared measured neck/mouth contact: Y 760
- Registered roller outer span: 269 px
- Visually calibrated neck-fit span: 262 px
- Candidate transform: X 27.066 px, Y -134.132 px, uniform scale 0.974
- Resulting roller alpha bounds: left 910, top 523, right 1172, bottom 760

The target contact line comes from the measured shared neck geometry in `closure-placement-recipe.json`; it is not inferred by a material-color threshold. The 262 px visible-width calibration corrects the slight flange overhang identified against the locked amber plate on 2026-08-02. The scale is uniform, and its translation is recomputed around the shared center/contact anchors so narrowing cannot pull the shell off-center or lift it from the mouth line.

## Guardrails

- One family transform only; no per-body offsets.
- Translation and uniform scale only; no asymmetric distortion or rotation.
- Body plate bytes remain unchanged.
- Roller image and authority mask move together.
- A bounding box is a placement control, not proof of geometry lock.
- Geometry lock still requires the exact mask-and-clamp gate.
- The current UI is a visual candidate. Persisting it requires a new immutable placement-recipe version plus dry-run family QA and named approval.
