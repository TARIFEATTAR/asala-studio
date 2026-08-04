# 18-415 reducer component kit

**State:** source truth decomposed; visible-flange authority mask and assembly placement still require review; no production, release, or Sanity mutation

## Physical responsibility

The 18-415 reducer is one translucent dispensing insert. Its full source silhouette includes a long plug body that seats inside the bottle neck, but that hidden body is not a paper-doll overlay.

The production plate is limited to the exposed top flange visible above the neck seat. The full insert remains immutable source evidence for shape and material review.

On the real 114 × 128 px standalone insert scene, the flange-to-plug transition occurs between source rows 25 and 26: rows 0–25 include the raised top and lateral flange, while row 26 begins the narrower 99 px plug body. A review-only 0–25 slice is therefore staged under `outputs/paper-doll-component-kit-reviews/18-415-reducer/visible-flange-mask-review-v1/`; this measurement is a candidate boundary, not an approved mask or production plate.

| Layer responsibility | Treatment |
|---|---|
| exposed top flange | reusable full-canvas plate after a reviewed selection mask |
| lower plug body | excluded from the production plate; hidden inside the neck |
| bottle neck and threads | body pixels; never part of the reducer plate |
| outer cap | separate 18-415 cap-family responsibility |
| cap/neck contact or occlusion | assembly-context QA; never used to conceal placement errors |

## Reuse boundary

The reducer itself must not be multiplied by cap finish. Shiny gold, shiny silver, matte silver, tall black, faux-leather, and white cap choices are separate closure variants layered over the same reducer responsibility.

Existing cap-family recipes already cover:

- `docs/paper-doll-rig/short-cap-18-415-family-recipe.json`
- `docs/paper-doll-rig/tall-cap-18-415-family-recipe.json`
- `docs/paper-doll-rig/faux-leather-cap-18-415-family-recipe.json`

The white reducer cap remains a separate cap-source review item; it is not evidence for a different reducer insert.

## Source evidence

The standalone `18-415Reducer.psd` is SHA-pinned. Scene 3 is the full translucent insert; scene 2 is a black cap and is intentionally registered as cap reference only.

The 50 mL and 100 mL Cylinder white-cap assemblies are registered for fit review. An archived `30 mL` assembly is retained as evidence only because the current catalog intake does not establish it as the current 25 mL Cylinder reducer product. That identity conflict must not be guessed away.

Recipe and review command:

- `docs/paper-doll-rig/reducer-18-415-component-kit-decomposition.json`
- `npm run paperdoll:reducer-18-415-kit-review`

## Promotion gates

1. Draw and review a selection mask containing only the exposed top flange.
2. Confirm the mask over white, black, gray, bone, and checkerboard backgrounds.
3. Register the neck-seat anchor without including glass/thread pixels.
4. Validate the flange at the locked family scale on every compatible body geometry.
5. Verify exact alpha identity after any material enhancement.
6. Record named pixel, geometry, placement, and assembly-context approval.
7. Cut a release only after those approvals.

Until then:

- `productionEligible: false`
- `geometryLocked: false`
- `currentReleaseChanged: false`
- `sanityChanged: false`
