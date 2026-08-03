# CYL-5ML body authority review

**Status:** review candidate only

**Family:** `CYL-5ML-13-415`

**Geometry:** `body__cylinder__5ml__53x17x17.0__f94a16652c`

## Decision

The available cap-off clear image is useful visual evidence, but it is not a clean physical geometry authority. It contains a detached cap, has an opaque studio background, and its transparent glass signal breaks into multiple optical components. The detached cap is excluded with an explicit edit region, but the bottle is not promoted to `geometry locked`.

Run the local review build with:

```bash
npm run paperdoll:cyl5-body-authority-review
```

The review output is written to:

`outputs/paper-doll-body-authority-reviews/CYL-5ML-13-415/53x17-clear-v1/`

## Two scale stages

The paper-doll system must not confuse component registration with storefront presentation.

1. **Workbench registration.** The candidate inherits the locked cylinder workbench coordinates: 2080×2288 canvas, x=1040 centerline, y=2082 baseline, and the CYL-9ML 70 mm / 58.5% body-height calibration. At that workbench scale, the 53 mm body occupies 1013 px (44.29% of canvas). Every compatible component is built and fitted in this shared coordinate space.
2. **Catalog presentation.** After all paper-doll layers are assembled, the complete product receives one uniform export transform from `best-bottles-catalog-scale-v1`. The current 5 mL global target is 61% assembled height. The exact transform remains recipe-specific because a roll-on, sprayer, pump, or cap changes verified assembled height. Individual layers are never independently resized to hit the hero target.

The existing compressed catalog curve keeps small bottles commercially visible while preserving the size hierarchy: 3 mL = 56%, 5 mL = 61%, 9 mL = 69% globally, and 100 mL = 79% assembled canvas height. Height-split roll-on zones may override the global capacity target under the existing versioned rules.

## Source calibration

- Source: `tmp/inspect-GBCyl5WhtSht-master_rigged.png`
- Explicit source bounds: x=219, y=89, 340×1019 px
- Edit bounds: x=139, y=9, 500×1150 px
- Calibration ROI: x=200, y=60, 380×1050 px
- Per-file adaptive threshold: 64
- Measured optical components: 129 total; 22 selected
- Observed source aspect: 0.333660
- Nominal dimension aspect: 17/53 = 0.320755
- Difference: 4.024%

These numbers are diagnostic evidence, not an automated approval threshold. Transparent glass fragmentation is why the source cannot become an authority mask without named physical review.

## Required next gate

Before this family can be locked:

1. Register a verified CAD/Blender profile or approve a clean photographic silhouette against the 53×17 mm physical body.
2. Review the neck and thread profile against real 13-415 evidence.
3. Approve the physical profile by name.
4. Create exact authority pixels and run family fit with the required 13-415 components.
5. Resolve the separate 53×18 and 54×17 catalog measurement rows; do not collapse them into this authority by filename similarity.

No remote database, Current Release, Sanity draft, or public catalog state is changed by this review build.

The next review-only assembly checkpoint is documented in `CYL5-ROLLON-CAP-FAMILY-FIT-REVIEW.md`.
