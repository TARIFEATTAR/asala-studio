# Paper-Doll Shared Placement and Release Lifecycle

**Status:** Approved design

**Date:** 2026-08-02

**Scope:** CYL-9ML locked body plates, the 17-415 plastic/metal roller pair, placement locking, Current Release, and gated Sanity publication

## Decision

The production workflow is:

1. **Approve Pixels** in Edit Lab.
2. **Family Fit** an approved fitment against the locked body family.
3. **Lock Shared Placement** as an immutable, named decision.
4. Inspect the resulting **Current Release**.
5. Optionally **Publish to Sanity** after dry-run validation and named approval.

The placement source of truth belongs to a shared geometry fingerprint, not to a bottle color or surface material. For CYL-9ML rollers, that fingerprint binds:

- fitment geometry key `17-415-roll-on`;
- exact authority-mask SHA-256;
- canvas contract `2080×2288`;
- shared mount axis and contact-seat contract.

Natural plastic and metal-ball rollers inherit one placement when they have the same authority-mask identity. Amber is the calibration view, not the owner of the transform. The identical transform applies to Amber, Cobalt, Clear, Frosted, and Swirl plates.

## Current State and Gap

The workbench already supports temporary Family Fit movement with X, Y, and uniform scale. It also previews the same in-memory transform across all five locked body plates. However:

- refreshing loses the transform;
- the transform is not stored in the private release ledger;
- there is no named placement-approval event;
- the current `Release Lock` label describes a read-only mode but sounds like an action;
- a candidate can currently appear in Family Fit before pixel approval;
- Current Release cannot distinguish approved pixels from a locked family placement;
- Sanity publication does not yet have an explicit dry-run and approval gate in this workflow.

## Approaches Considered

### Shared geometry placement version — selected

Store one immutable placement version per geometry fingerprint. Every approved material variant and compatible body plate resolves that placement. This prevents colorway drift, keeps one source of truth, and permits reuse without duplicating coordinates.

### Placement stored on each component version — rejected

Copying X/Y/scale onto plastic and metal component versions would allow the two materials to diverge even when their silhouettes are identical. Every new finish would duplicate placement data and create unnecessary review work.

### Per-body placement overrides — rejected for this family

Five independent bottle adjustments would defeat the locked-body geometry contract and create silent catalog drift. If a future bottle genuinely requires a different placement, it must declare a different body/fitment geometry family rather than masquerade as an exception inside CYL-9ML.

## Workflow and UI

### 1. Approve Pixels — Edit Lab

Edit Lab remains the only place to upload, generate, inspect, reject, or approve candidate pixels.

Approval requires:

- exact mask-and-clamp geometry verification;
- passing calibrated blocking QA;
- an immutable candidate image SHA;
- an immutable authority-mask SHA;
- a named authenticated approver;
- preserved original-source provenance.

The operator approves the plastic and metal candidates independently. Pixel approval creates approved component versions but does not change placement, release membership, or Sanity.

Family Fit is disabled for an unapproved candidate. After at least one approved component exists for the geometry fingerprint, Family Fit becomes available. Any later approved component with the same fingerprint inherits the existing placement lock. A different mask SHA requires a new Family Fit decision.

### 2. Family Fit

Family Fit loads an approved component and the latest applicable placement version, if one exists. The operator may:

- drag the complete fitment layer;
- nudge X or Y in one-pixel release-canvas increments;
- enter exact X and Y values;
- change uniform scale around the declared contact point;
- reset to the measured calibration;
- switch among all five body plates without losing the fitment selection;
- compare plastic and metal variants when both are approved.

The five body plates remain immutable. Non-uniform scaling, rotation, warping, cropping, per-body offsets, and body movement are prohibited.

The lineup always renders the proposed transform across all five plates. The UI must distinguish `Unfitted`, `Draft placement`, and `Placement locked` states. Temporary movement never claims persistence.

### 3. Lock Shared Placement

`Lock Shared Placement` is an explicit action, not an automatic side effect of dragging. It opens a confirmation showing:

- geometry fingerprint and authority-mask SHA;
- component version used for calibration;
- X, Y, uniform scale, mount axis, and contact seat;
- all five affected body variants;
- every currently approved material variant that will inherit the placement;
- QA results and any blockers;
- the named approver.

The server validates the request and atomically creates an immutable placement version plus an approval event. Existing placement versions remain audit history and cannot be updated or deleted. Locking placement does not silently mutate the active release.

If the same geometry fingerprint already has an identical locked transform, the operation is idempotent. If the transform differs, a new version is created and the prior version remains intact.

### 4. Current Release

The UI label `Release Lock` becomes **Current Release**. Internally, `release-lock` may remain the route/mode identifier to avoid unnecessary code churn.

Current Release is read-only and shows only the exact active ledger snapshot:

- body component versions;
- approved fitment component versions;
- locked placement version;
- release manifest SHA;
- QA and named approvals;
- publication state.

No dragging, scaling, generation, pixel approval, or placement writing is allowed in Current Release. Approved candidates and placement drafts do not appear as released assets until a separate release cut includes them.

### 5. Publish to Sanity

The workbench exposes a **Publish to Sanity** option only when the release candidate contains:

- all required approved component versions;
- a compatible locked placement version;
- five-body assembly QA evidence;
- a stable release manifest SHA;
- no blocking catalog or material issue;
- a successful Sanity dry run;
- a named publication approval.

The first action is always `Dry Run`. It displays the exact Sanity documents, asset references, swatch mappings, and manifest SHA that would change. `Publish to Sanity` remains disabled until the dry run matches the current release candidate and a named approver confirms it.

Publication records the Sanity transaction/result identifiers and timestamp in an append-only publication event. A failed or partial publication is visible and retryable; it must never be reported as released.

## Data Model

Add immutable ledger entities equivalent to:

### `paper_doll_placement_versions`

- `id`
- `organization_id`
- `family_key`
- `fitment_geometry_key`
- `authority_mask_sha256`
- `canvas_width_px`
- `canvas_height_px`
- `translate_x_px`
- `translate_y_px`
- `uniform_scale`
- `mount_axis_x_px`
- `contact_y_px`
- `calibration_component_version_id`
- `created_by`
- `created_at`

The database enforces finite coordinates, positive uniform scale, immutable rows, organization scoping, and uniqueness/idempotency for an identical geometry fingerprint plus transform.

### `paper_doll_placement_approvals`

- placement-version identity;
- approver identity and displayed name;
- decision timestamp;
- five-body QA evidence identifiers;
- approval note.

Browser clients receive organization-scoped reads only. Placement writes occur through a server function that verifies approval, mask identity, release-canvas compatibility, and QA evidence.

### Release membership

The release manifest references a placement-version ID in addition to component-version IDs. A release cannot become ready when its fitment components lack a compatible locked placement.

### Publication events

The publish ledger binds organization, release ID, manifest SHA, dry-run hash, named approver, Sanity result, and timestamps. Publication history is append-only.

## State Rules

| State | Pixels approved | Placement locked | In Current Release | Sanity eligible |
|---|---:|---:|---:|---:|
| Candidate | No | No | No | No |
| Approved component | Yes | No | No | No |
| Placement draft | Yes | No | No | No |
| Placement locked | Yes | Yes | No | No |
| Release candidate | Yes | Yes | No | Dry run only |
| Current Release | Yes | Yes | Yes | Yes, after dry run and named approval |

## Failure and Invalidation Rules

- A candidate without pixel approval cannot enter Family Fit.
- A placement draft cannot enter Current Release.
- A new authority-mask SHA does not inherit a placement lock, even when its bounding box looks identical.
- A material-only change with the same exact mask SHA inherits the shared placement.
- Any non-uniform scale or body-specific offset fails closed.
- Missing or failed five-body assembly QA blocks placement approval and release readiness.
- A stale Sanity dry run is invalid when the manifest SHA changes.
- Current Release and the five locked body plates are never changed by Edit Lab or Family Fit actions.

## Verification

Automated tests must prove:

- Family Fit is unavailable before pixel approval;
- approved plastic and metal with one mask SHA resolve one placement;
- a placement adjustment renders identically across all five body plates;
- refresh reloads the locked transform from the ledger;
- non-uniform scale, rotation, and per-body overrides are rejected;
- changed mask SHA invalidates placement reuse;
- locking is named, immutable, idempotent, and organization-scoped;
- Current Release is read-only and contains only manifest members;
- release readiness fails without a compatible placement lock;
- Sanity publication requires an unexpired matching dry run and named approval;
- no Edit Lab, Family Fit, or dry-run action mutates the active release.

Browser verification must cover the full plastic and metal lifecycle across Amber, Cobalt, Clear, Frosted, and Swirl plates.

## Explicit Boundaries

- This design does not unlock arbitrary per-bottle nudging.
- It does not alter the five locked body plates.
- It does not describe a reference-anchored generation as geometry locked.
- It does not automatically promote approved pixels or placements into Current Release.
- It does not publish to Sanity without a matching dry run and named approval.
- It does not redesign the rest of Madison Studio.
