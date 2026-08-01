# CYL-9ML Paper-Doll Family Release v1 — design

**Date:** 2026-08-01

**Status:** approved direction; written review gate before implementation

**Pilot family:** `CYL-9ML`, 17-415, 9 ml Cylinder

**Parent design:** `docs/superpowers/specs/2026-07-30-paper-doll-rig-design.md`

## Purpose

Prove one production-shaped path from frozen Blender/body assets through Madison
validation, an immutable Supabase family release, a Best Bottles-specific Sanity
dry run, and a storefront preview. The pilot must expose contract failures before
anything is written to production Sanity or shown to customers.

This design preserves the five locked body plates and the proven deterministic rig.
It does not regenerate the bodies.

## Decisions superseded for this vertical slice

The parent design remains authoritative except for these two publication details:

1. **Canonical component canvas:** `2080 × 2288`, Bone `#F5F3EF`. Legacy
   `1000 × 1300` and local `2000 × 2200` assets are migration inputs, not release
   outputs. Delivery resizing may happen after publication but must not create a
   second composition coordinate system.
2. **Sanity destination:** one versioned `paperDollFamily` document containing
   `layerAssets[]`, assembly recipes, release metadata, and QA provenance. The
   generic standalone `paperDollComponent.image` destination is not used by Best
   Bottles family releases.

## Authority boundaries

| System | Authority |
|---|---|
| Blender/CAD | Physical mesh, camera, material, object mask, lighting recipe |
| Madison | Candidate intake, assembly preview, validation, approval, release creation |
| Supabase | Working assets, jobs, QA evidence, immutable release ledger, publish log |
| Convex | SKU/product identity and explicit assembly-selection keys |
| Sanity | Approved web-delivery family manifest and image assets |
| Shopify | Price, inventory, checkout, and static-media fallback |
| Best Bottles frontend | Runtime assembly and swatch layer swapping |

The storefront does not query Supabase. Supabase does not decide which SKU or swatch
is commercially available. Sanity does not infer product assembly from names.

## Pilot asset scope

### Included

- The five SHA-frozen body plates: clear, amber, cobalt, frosted, and swirl.
- One 17-415 roll-on over-cap geometry family.
- Opaque material variants proven by the Blender pilot: mirror chrome, matte white,
  and glossy black.
- The closure's dedicated Blender object-mask pass.
- The frozen closure placement recipe.
- Explicit CYL-9ML 17-415 catalog assembly mappings needed for the preview set.
- Madison visual assembly preview and release-readiness summary.
- Supabase schema and local contract tests.
- Best Bottles `paperDollFamily` dry-run projection.

### Included as blocked evidence, not as an approved isolated layer

- Translucent plastic. It must render and be judged in body/fitment context because
  isolated RGBA cannot reproduce physically correct transmission through the bottle
  assembly. The release validator must report it as `assembly-context-required` and
  prevent an isolated translucent asset from being marked production-ready.

### Excluded from Release v1

- Production Sanity publication.
- Live PDP activation.
- Full catalog backfill.
- Rhinestone production assets. Their contract is reserved now, but stone placement
  implementation follows after the opaque closure vertical slice passes.
- Sprayer and lotion-pump completion beyond the schema's ability to represent them.
- Hyper3D as a geometry authority.

## Stable identity model

No production key is derived from a display name.

```text
familyKey            CYL-9ML
geometryFamilyId     closure__17-415__rollon-overcap__v1
componentVersionId   immutable UUID
slot                  body | cap | roller | sprayer | overcap | pump
variantKey            stable catalog-facing code such as SHN-SL or WHT
materialVariant       mirror-chrome | matte-white | glossy-black | translucent
bodyVariantKey        CLR | AMB | BLU | FRS | SWL
```

Convex product rows select `familyKey`, `bodyVariantKey`, `fitmentVariantKey`,
`closureVariantKey`, and optional `overcapVariantKey`. Missing or unknown keys fail
closed; the renderer never substitutes the first asset in a slot.

## Supabase data model

New tables use UUID primary keys, organization ownership, timestamps, RLS, and
immutable approved versions.

### `paper_doll_components`

Logical reusable part: body, closure, roller, sprayer, pump, or overcap.

- `organization_id`
- `component_key`
- `geometry_family_id`
- `slot`
- `neck_thread_size`
- `applicator`
- lifecycle status

### `paper_doll_component_versions`

Immutable render/intake version of a component.

- component reference and version number
- `variant_key`, `material_variant`
- working asset URL and source artifact reference
- source SHA-256, output SHA-256, Blender/model/camera recipe identifiers
- canonical canvas and Bone environment
- geometry/object-mask asset reference
- alpha bounds, mount axis, seat coordinate, baseline, centerline
- approval state, reviewer, approval timestamp

An approved row is never updated in place. A change creates a new version.

### `paper_doll_qa_results`

Append-only evidence for one component version or assembled preview.

- gate key and calibrated gate version
- measured values and units as JSON
- reference fixture IDs used for calibration
- `passed`, `failed`, `advisory`, or `blocked`
- diagnostic artifact URL and execution metadata

### `paper_doll_family_releases`

Immutable release header.

- `family_key`, semantic release version, schema version
- canonical canvas and background
- status: `draft`, `validating`, `blocked`, `ready`, `published`, `superseded`
- manifest SHA-256
- creator, approver, timestamps
- source Git commit and renderer version

### `paper_doll_family_release_assets`

Exact component versions included in one release, keyed uniquely by
`release_id × slot × variant_key`.

### `paper_doll_publish_runs`

Dry-run and live publication attempts, including target project/dataset/document,
payload hash, diff summary, result, error, and resulting Sanity revision.

No secret or Sanity write token is stored in these tables.

## Release manifest contract

The application owns a versioned TypeScript contract plus JSON Schema. A release
manifest includes:

- family identity and schema version
- canonical canvas and background
- component version records and hashes
- assembly recipes by applicator mode
- explicit product/SKU assembly mappings or their verified mapping-set hash
- geometry and material QA evidence
- completeness result
- blocked/advisory findings
- release/publisher provenance

Serialization is canonical and deterministic so identical inputs produce the same
manifest hash.

## Validation model

Every gate records evidence. Thresholds are not trusted merely because they exist;
each gate names the real fixtures on which it was calibrated.

Blocking Release v1 gates:

1. Every component PNG is exactly `2080 × 2288` RGBA.
2. Every required asset has stable source/output hashes.
3. Body plates match the five frozen registry SHAs.
4. Every closure material variant references the same geometry family and Blender
   camera recipe.
5. Opaque closure geometry is measured from the dedicated object mask, not inferred
   from tone, Bone similarity, or frame bounds.
6. Object-mask bounds, mount axis, seat coordinate, and centerline register to the
   closure placement recipe within its calibrated tolerance.
7. Every preview product resolves explicit component keys with no fallback.
8. Every required layer exists exactly once per `slot × variantKey`.
9. Assembly recipes reference only assets contained in the release.
10. The Sanity projection round-trips without losing IDs, hashes, geometry, QA, or
    assembly ordering.
11. Translucent isolated assets remain blocked until an assembly-context method and
    calibrated gate pass.
12. The known defective metal roller-ball cannot pass intake; opaque-white fraction
    is reported and calibrated against the real metal and plastic roller fixtures.

Silhouette identity remains visible as a diagnostic IoU, but common geometry is
guaranteed primarily by the shared mesh/object-mask provenance. A clean numeric pass
cannot override a detected-frame, missing-mask, or provenance failure.

## Madison UI

Release v1 upgrades the existing Components surface rather than creating another
top-level studio.

The CYL-9ML workbench contains:

- Family header: version, canvas, asset coverage, QA state, Sanity state.
- Body rail: the five frozen plates and SHA/approval evidence.
- Component matrix: rows by physical part, columns by material/variant.
- Assembly canvas: explicit body, fitment, and closure selectors using the same
  manifest resolver as the validator.
- Evidence drawer: geometry mask, alpha bounds, hashes, measurements, calibration
  fixtures, and failure reasons.
- Release action: creates an immutable draft, validates it, and enables only a
  Sanity dry run when the complete bundle is `ready`.

The UI does not contain a manual pixel-nudge escape hatch for production approval.
Geometry corrections happen in the source mesh/recipe and produce a new version.

## Sanity projection

The dry-run publisher produces one Best Bottles `paperDollFamily` document keyed by
`familyKey`. It upserts array members deterministically by stable asset key and
preserves unrelated fields. The payload adds:

- release and schema versions
- canonical canvas
- assembly recipes
- layer assets with stable component/variant IDs
- hashes and QA summary
- approval state and release provenance

Dry run returns the resolved target document, full validation result, deterministic
payload hash, and field-level diff. It uploads nothing and patches nothing.

Live publication is a separate explicit action and is outside this release.

## Storefront preview

A development-only preview consumes the same projected `paperDollFamily` shape and
explicit assembly mapping. It must demonstrate:

- switching all five body swatches without closure movement
- switching opaque closure finishes without silhouette movement
- cap-on/cap-off as layer subsets
- static product media fallback for blocked/missing releases
- no runtime request to Supabase
- no parsing of `itemName` or arbitrary color text

The existing production PDP remains unchanged in Release v1.

## Error handling and state transitions

- Missing asset, duplicate key, bad hash, unresolved SKU, canvas mismatch, absent
  object mask, or uncalibrated blocking gate → release becomes `blocked`.
- Sanity inspection/dry-run failure records a failed publish run; it does not alter
  release approval or retry automatically.
- A new component version never mutates an existing ready/published release.
- Any manifest change creates a new manifest hash and requires revalidation.
- A release cannot move directly from `draft` to `published`.

## Testing strategy

Implementation follows test-driven development.

1. Contract tests for manifest parsing, canonical serialization, stable hashes,
   duplicates, and invalid state transitions.
2. Validator tests using real CYL-9ML metadata plus small checked-in/synthetic image
   fixtures for dimensions, bounds, masks, frame-detection, and the defective roller.
3. Supabase migration tests for constraints, immutability, RLS ownership isolation,
   and release completeness.
4. Resolver tests proving every pilot catalog mapping resolves and unknown keys never
   fall back.
5. Sanity projection tests for deterministic array keys, full-document dry run, and
   non-destructive preservation.
6. UI tests for selector behavior, blocked evidence, readiness state, and dry-run
   enablement.
7. Existing paper-doll regression suite and TypeScript checks remain green.

## Release v1 acceptance criteria

- Five locked body plates are referenced unchanged.
- Three opaque closure finishes share one geometry/object mask and seat identically.
- Every included CYL-9ML preview assembly resolves from stable keys.
- A reproducible immutable family release exists in the local/test Supabase path.
- All blocking QA evidence is visible in Madison.
- A deterministic Sanity `paperDollFamily` dry-run payload and diff are produced.
- A development preview renders the release without Supabase access or name parsing.
- Translucent and defective roller assets are visibly blocked, not silently omitted
  or incorrectly approved.
- No production Sanity, Convex, Shopify, or storefront data is mutated.

## Implementation order

1. Shared release contract and validator core.
2. Supabase schema, RLS, constraints, and generated application types.
3. Asset/QA import adapters for the locked CYL-9ML registries and Blender pilot.
4. Explicit assembly resolver and completeness report.
5. Madison CYL-9ML workbench and assembly canvas.
6. Best Bottles-specific Sanity family projection and dry run.
7. Development storefront preview adapter.
8. Full verification and human visual review.

## Rollback

Release v1 does not alter production systems. Local schema changes remain migration
files until intentionally applied. Madison can hide the new workbench behind its
existing Best Bottles paper-doll surface. The production PDP, live Sanity family,
Convex catalog, Shopify media, and five frozen body plates remain untouched.
