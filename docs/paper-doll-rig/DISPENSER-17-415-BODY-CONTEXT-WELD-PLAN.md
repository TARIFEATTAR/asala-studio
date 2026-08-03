# CYL-9ML 17-415 body-context weld plan

**Status:** dry-run contract only

**Scope:** fine-mist sprayer and lotion-pump dip tubes plus inserted-plug interaction on the five locked CYL-9ML body plates

**Mutation state:** no masks written, no candidates generated, no Current Release change, no Sanity write

## Architecture decision

The exposed dispenser and the closed dispenser-plus-translucent-overcap are reusable swatches. The dip tube, inserted plug, interior occlusion, and refraction are not reusable global plates. They are five explicit body-context jobs tied to immutable body SHAs.

The 93.8 mm sprayer value is the catalog stock-tube length. It is not the visible rendered reach. A stock tube longer than this 70 mm bottle must be trimmed to the verified interior depth for each target body.

## Calibration gate

- Thread-crest proxy: 15.8235 px/mm.
- Neck-top-to-baseline body-height proxy: 18.9914 px/mm.
- Divergence: 20.02%.
- State: **ambiguous-review-required**.

The proxies do not describe the same physical span and cannot be silently substituted for an approved tube-width conversion. The inherited 4.4 mm weld default is therefore not accepted as 17-415 evidence.

## Locked body registrations

| Body | Immutable SHA | Center X | Neck Y | Baseline Y | Maximum untrimmed tube path Y |
|---|---|---:|---:|---:|---:|
| clear | `97cfe967a4ab…` | 1041 | 760–968 | 2086 | 1003–2085 |
| frosted | `c844fb9f3a6f…` | 1041 | 760–968 | 2092 | 1003–2091 |
| swirl | `c2b67ee9151d…` | 1041 | 760–968 | 2091 | 1003–2090 |
| amber | `c84db213449d…` | 1041 | 760–968 | 2089 | 1003–2088 |
| cobalt | `87804d45a242…` | 1041 | 760–968 | 2089 | 1003–2088 |

## Lane gates

| Lane | Stock length mm | Diameter mm | Interior margin mm | State | Open blockers |
|---|---:|---:|---:|---|---|
| sprayer | 93.8 | unverified | unverified | dimension-review-required | tube-diameter-unverified, interior-bottom-margin-unverified, pixel-scale-ambiguous, inserted-plug-horizontal-bounds-unverified |
| pump | unverified | unverified | unverified | blocked-missing-tube-dimensions | stock-tube-length-unverified, tube-diameter-unverified, interior-bottom-margin-unverified, pixel-scale-ambiguous, inserted-plug-horizontal-bounds-unverified |

## Required evidence before mask creation

1. Measure the real tube outside diameter for each physical dispenser lane.
2. Measure or document the CYL-9ML target-body interior bottom clearance.
3. Verify the pump stock tube length and trim rule.
4. Calibrate a reviewed pixel conversion against the actual mounted assembly rather than selecting one of the conflicting proxies.
5. Define the inserted-plug horizontal profile from the real part or layered source.
6. Generate one body-specific mask per immutable body SHA; then run the masked weld, deterministic clamp, and five-body visual QA.

Until those gates pass, all ten jobs remain pre-generation and no geometry-lock claim is allowed.
