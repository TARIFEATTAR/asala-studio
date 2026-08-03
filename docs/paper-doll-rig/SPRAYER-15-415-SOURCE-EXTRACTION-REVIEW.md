# 15-415 sprayer source-extraction review

Status: source extraction complete; geometry and production approval not claimed.

## Result

The ten SHA-pinned Photoshop sources defined by
`sprayer-15-415-component-kit-decomposition.json` were decoded by explicit
scene selector and separated into fifteen review assets:

- five exposed sprayer heads;
- five independent protective overcaps;
- five matching dip-tube sources.

The extraction preserves the native source pixels. Non-transparent bounds are
trimmed only to create a source cutout, then placed at scale `1` on the
2080 × 2288 canonical canvas for isolated review. This centering is not a
production placement claim.

## Visual review

- All five head scenes contain one intact exterior sprayer responsibility.
- All five overcap scenes contain one intact secondary overcap responsibility.
- All five tube scenes contain the inserted dip tube and upper plug source.
- The expected black, shiny gold, shiny silver, matte silver, and matte gold
  appearance set is present for the head and overcap responsibilities.
- No extracted source is geometry locked or production eligible.

Local review artifacts:

- `outputs/paper-doll-component-kit-reviews/15-415-sprayer/source-extraction-v1/manifest.json`
- `outputs/paper-doll-component-kit-reviews/15-415-sprayer/source-extraction-v1/sprayer-head/contact-sheet.png`
- `outputs/paper-doll-component-kit-reviews/15-415-sprayer/source-extraction-v1/protective-overcap/contact-sheet.png`
- `outputs/paper-doll-component-kit-reviews/15-415-sprayer/source-extraction-v1/dip-tube/contact-sheet.png`

The manifest records the original filename, archive-relative source path,
expected source SHA-256, Photoshop scene index, layer name, source page bounds,
alpha bounds, review placement, and output hashes for every asset. A source SHA
mismatch stops the run before any derived review asset is written.

## Production routing

| Responsibility | Production route | Next gate |
|---|---|---|
| Exposed sprayer head | reusable full-canvas plate | calibrate one physical geometry authority, clamp all approved appearances, inspect assembled family fit |
| Protective overcap | separate reusable full-canvas plate | calibrate its own authority and seat; require translucent assembly-context QA where applicable |
| Dip tube and upper plug | body-contextual weld or physical render | verify target-body interior depth, visible tube length, occlusion, and refraction |

The source composite never becomes a production plate. Production placement
uses the physical mount axis and verified seats rather than review-centering
coordinates.

## Reusable warning

This decomposition gate also applies to pumps, droppers, roller assemblies,
bulb atomizers, hoses, tassels, decorative overcaps, and any other source that
contains more than one independently selectable or body-dependent physical
responsibility. A Photoshop layer count is not a plate count; fragments are
recomposed by responsibility before the reusable plate count is finalized.
