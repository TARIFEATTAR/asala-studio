# Best Bottles Paper-Doll Component Factory — design

**Date:** 2026-08-03

**Status:** approved architecture; written review gate before implementation

**Pilot family:** `CYL-9ML`

**Skill:** `.agents/skills/best-bottles-paper-doll-production`

## Purpose

Create a repeatable, full-lifecycle production system for every physical component
used by a Best Bottles paper-doll family. Each component receives an explicit
geometry authority, bounding boxes, material candidates, assembly evidence,
approvals, immutable release history, and Sanity draft projection.

The first execution completes the remaining `CYL-9ML` inventory. The same engine
then applies to future bottle families without copying family-specific scripts.

## Decisions

1. Use one manifest-driven component factory. Do not create a separate production
   pipeline for each bottle family.
2. Keep geometry authority separate from material authority. Blender, CAD, or an
   approved photographed silhouette may establish geometry; GPT Image 2.0 may
   author material pixels but never geometry.
3. Call a component geometry locked only after the candidate is clamped to the
   approved authority mask and exact alpha identity passes.
4. Version every crop, bounding box, transform, approval, and release mutation.
   Never apply silent production nudges.
5. Keep candidate generation reversible. Current Release, Sanity drafts, and public
   documents remain untouched until their named lifecycle actions.
6. Sync named release cuts to Sanity drafts. Public publication requires a second,
   separate named action.
7. Calibrate every non-exact QA threshold on representative real files. Exact alpha,
   hashes, canvas dimensions, and explicit bounds may use deterministic equality.
8. Upgrade the existing Madison Production Candidate Bench rather than replacing
   its proven application shell.

## CYL-9ML scope

Five body plates are already locked and remain unchanged: Amber, Cobalt, Clear,
Frosted, and Swirl.

The component factory tracks 23 unique component plates serving 29 catalog
variants:

| Component class | Unique plates | Catalog rows served | Geometry policy |
|---|---:|---:|---|
| Roll-on over-caps | 10 | 20 roll-on rows: ten cap appearances × two roller types | One approved cap silhouette; finish pixels vary; rhinestones are deterministic decoration |
| Roller fitments | 2 | Included in the 20 roll-on rows | Share a mask only after exact silhouette verification; only the ball material changes |
| Fine-mist sprayers | 6 | 6 | Group only physically identical sprayers into one geometry family |
| Lotion pumps | 3 | 3 | Group only physically identical pumps into one geometry family |
| Translucent overcaps | 2 | Secondary layers inside spray/lotion rows | Distinct geometry authorities unless real-file verification proves identity |

The 29 catalog variants are not 29 unrelated geometry masters. Inventory maps each
variant to a verified physical component plate and assembly recipe.

## Authority hierarchy

Each physical component has four independent authorities:

1. **Geometry authority:** one binary alpha mask with a frozen SHA-256.
2. **Material authority:** an approved photograph, deterministic derivation, or GPT
   Image 2.0 candidate describing only RGB appearance.
3. **Placement authority:** a versioned full-canvas transform specifying scale,
   centerline, seat/anchor, and compatible plates.
4. **Release authority:** the append-only release cut selecting immutable component
   versions and placement versions.

The hierarchy is strict. Material pixels cannot rewrite the geometry mask;
individual plate adjustments cannot silently rewrite shared placement; and Sanity
cannot select a candidate that is absent from a named release cut.

## Bounding-box contract

Every component plate records four boxes with distinct meanings:

| Box | Meaning | Source |
|---|---|---|
| `sourceBoundsPx` | Explicit crop inside an uploaded or generated source image | Stored with original filename and source SHA |
| `authorityBoundsPx` | Exact occupied bounds of the binary geometry mask | Derived from alpha, never luminance |
| `placementBoundsPx` | Component bounds after the approved full-canvas transform | Derived from the placement version |
| `editBoundsPx` | Operator-selected area supplied to generation or inpainting | Candidate metadata only; never geometry authority |

All boxes use integer pixel coordinates and explicit canvas dimensions. A crop must
be inside its source image. A mask must be non-empty, must not touch its frame, and
must contain the calibrated number of connected regions. Components with intentional
detached decoration must declare those regions rather than weakening the global
single-component rule.

## Component-plate manifest

The generic family manifest contains:

```text
family identity and canvas contract
locked body-plate versions
component inventory
  component key and slot
  geometry family and authority-mask version
  material variants and reference assets
  compatible body plates
  assembly recipe membership
  required approvals
placement versions and optional explicit plate overrides
release target and Sanity projection target
```

Each immutable component candidate records:

```text
source filename, source SHA, and source bounds
provider, model, prompt hash, and estimated cost
authority-mask path and SHA
normalized candidate and full-canvas layer SHAs
all four bounding boxes
placement version
exact-alpha QA
material-specific evidence
five-body assembly evidence
approval events
mutation policy and lifecycle state
```

Original filenames remain immutable provenance. Canonical storage keys may be
sanitized, but they never replace the recorded original filename.

## Production lifecycle

The reusable loop is:

```text
Inventory
  -> Geometry Authority
  -> Bounding-Box Calibration
  -> Material Candidate
  -> Mask Clamp
  -> Component QA
  -> Assembly Matrix
  -> Approve Pixels
  -> Family Fit
  -> Lock Shared Placement
  -> Immutable Component Version
  -> Named Release Cut
  -> Sanity Draft Sync
  -> Separate Named Public Publication
```

### Inventory

Reconcile the catalog, PSD estate, existing component registry, and Current Release.
Fail on duplicate keys, missing expected variants, or conflicting component-to-SKU
mappings. Inventory may identify unresolved records without blocking unrelated,
approved components from entering a later incremental release cut.

### Geometry authority

Prefer an approved photographic silhouette when it already matches the catalog
view. Use parametric Blender or CAD for simple rotational components and future 3D/
AR assets. Calibrate the model to the approved paper-doll appearance and known
physical measurements, recording visual fit and millimetre accuracy separately.

Do not generate independent geometry for material colourways. Do not call a
reference-anchored generation geometry locked.

### Material candidates

GPT Image 2.0 receives the geometry/reference image and a real material reference.
Prompts identify the physical substrate and coating accurately. Generated framing
and alpha are untrusted.

Normalize the explicit source crop into `authorityBoundsPx`, then replace generated
alpha with the exact authority mask. Deterministic tinting remains preferred for
mirror colourways when it preserves the approved reflection structure. Matte,
glossy, translucent, and decorated variants receive their own material treatments.

Rhinestone layouts use stable stone IDs and normalized deterministic positions.
Generation may improve stone RGB appearance but cannot choose stone placement or
expand the family silhouette.

### Assembly and approvals

Render each candidate over every compatible locked body plate. The UI provides:

- one large reference assembly;
- optional comparison overlay;
- five-body or family lineup;
- material/source/candidate/difference inspection;
- exact geometry evidence;
- versioned shared placement controls;
- explicit per-plate override controls with a required reason.

The required named actions remain:

1. **Approve Pixels** — accepts material appearance inside the authority mask.
2. **Family Fit** — accepts all explicit compatible assemblies.
3. **Lock Shared Placement** — creates an immutable placement version.

These actions are independent. Approving pixels does not publish, and moving a
component does not change its material version.

## Madison UI states

The existing Production Candidate Bench gains six lifecycle views:

1. **Inventory Matrix:** every required component, variant, geometry family,
   candidate, approval, and release status.
2. **Component Plate:** source, mask, four bounding boxes, component metadata, and
   generation/upload controls.
3. **Candidate Review:** release source, candidate, difference, provenance, and QA.
4. **Family Fit:** compatible body lineup, shared transform, explicit overrides,
   and named fit approval.
5. **Release Cut:** selected immutable component versions, validation, approver,
   and append-only cut creation.
6. **Sanity Projection:** dry-run diff, draft sync result, editorial readiness, and
   a separately guarded public publication action.

The UI reads persisted manifests and lifecycle records. React state may preview
edits but cannot become production truth.

## Error handling and recovery

Every stage is resumable and append-only:

- invalid uploads retain their provenance and failure reason;
- workers claim idempotent jobs by candidate ID;
- retries create attempts under the same candidate request without overwriting
  successful history;
- rejected candidates remain audit-only;
- obsolete or defective ancestors appear as quarantine notices, not current-candidate
  errors;
- a failed release cut leaves Current Release unchanged;
- a failed Sanity sync may be retried from the same immutable release cut;
- public publication never occurs as a side effect of draft sync.

Reject or quarantine:

- masks that measure the frame, are empty, touch the frame, or contain undeclared
  islands;
- crops outside the source image;
- layers with non-canonical canvas dimensions;
- candidates whose clamped alpha differs from the authority mask;
- placement records with missing compatible plates or unnamed approval;
- release cuts referencing mutable candidates;
- Sanity projections that would overwrite unrelated applicator modes.

## QA policy

Blocking deterministic checks include:

1. authority-mask and output dimensions;
2. mask SHA and placement-version identity;
3. exact binary alpha IoU `1.0000` with zero mismatched pixels;
4. declared connected-region topology;
5. bounds containment and non-clipping;
6. unchanged locked body SHAs;
7. explicit assembly coverage for every compatible plate;
8. immutable source, output, approval, and release provenance.

Material review uses fixtures calibrated on real approved files for each material
class. No shared brightness threshold approves mirror, matte, glossy, white,
translucent, and rhinestone finishes. Translucent components require assembly-
context review. The roller intake includes an opaque-white-junk measurement calibrated
against the clean plastic and metal candidates.

## Release and Sanity writes

Candidate work is the default mode. External writes require named lifecycle actions:

- `Lock Shared Placement` writes placement truth only.
- `Create Release Cut` appends a release cut and advances the release head only
  after server-side validation.
- `Sync Sanity Draft` projects that release cut into a deterministic draft ID and
  records the returned revision.
- `Publish Publicly` requires a second named approver action and confirms that the
  downstream catalog supports the included applicator scope.

All operations are idempotent by family, release-cut ID, and content hash. Secrets
remain in the approved environment and never enter manifests, prompts, skills, or
Git history.

## Repository skill

Create `.agents/skills/best-bottles-paper-doll-production` containing:

```text
SKILL.md
agents/openai.yaml
references/component-contract.md
references/material-doctrine.md
references/release-and-sanity.md
scripts/validate_family_manifest.ts
scripts/summarize_family_status.ts
```

The skill instructs future agents to use the generic repository commands and
manifests. Deterministic validation belongs in scripts and tests rather than prose.
The skill must not contain credentials, volatile database state, or duplicated
catalog records.

## Testing

Automated tests cover:

- typed family-manifest parsing and inventory completeness;
- exact source/authority/placement/edit bounding-box semantics;
- crop containment and original-filename preservation;
- authority-mask topology and frame rejection;
- GPT material normalization and exact mask clamp;
- deterministic rhinestone placement;
- body/component assembly coverage;
- shared placement and explicit override versioning;
- immutable candidate and approval events;
- append-only release cuts and idempotent release-head advancement;
- Sanity dry-run and draft projection without implicit publication;
- rejection of unrelated-mode overwrites;
- skill validation and a forward test on one non-CYL-9ML family fixture.

Real-file calibration fixtures include mirror, matte, glossy black, white,
translucent plastic, rhinestone, plastic roller, and metal roller assets. Synthetic
fixtures alone cannot approve a QA threshold.

## Implementation sequence

1. Generalize the current CYL-9ML cap mask/clamp code into component-plate modules.
2. Define and validate the generic family manifest and four-box contract.
3. Register all 23 CYL-9ML component plates without creating release writes.
4. Add the material-candidate and assembly-matrix loop.
5. Wire the six lifecycle views into the existing workbench.
6. Add immutable approvals and shared-placement locking.
7. Add append-only release cut and release-head operations.
8. Add Sanity dry-run and draft projection.
9. Add the separately guarded public publication action.
10. Create, validate, and forward-test the repository skill.

## Out of scope

- regenerating the five locked CYL-9ML body plates;
- independently generating geometry for each finish;
- silent production pixel nudges;
- automatic public publication;
- claiming a reference image or bounding box is a geometry lock;
- replacing the existing Madison Studio shell;
- assuming all sprayers or pumps share geometry without real-file proof.

## Completion criteria

The component factory is complete when:

1. all 23 CYL-9ML component plates are represented by validated manifests;
2. every plate has an authority mask and all four bounding boxes;
3. all 29 catalog variants resolve to explicit assembly recipes;
4. accepted material candidates pass exact mask clamp and material review;
5. every compatible five-body assembly is visible and reviewable;
6. approvals and placement locks are immutable and named;
7. a validated append-only release cut can become Current Release;
8. the release can sync idempotently to a Sanity draft;
9. public publication remains a separate named action; and
10. the repository skill successfully guides a fresh agent through a different
    bottle family without inventing geometry or bypassing gates.
