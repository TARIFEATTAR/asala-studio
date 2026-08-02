# Madison Paper-Doll Release Workbench Design

**Status:** Approved design  
**Date:** 2026-08-01  
**Primary trial:** Best Bottles `CYL-9ML`  
**Existing route:** `/best-bottles/studio/:groupSlug`  
**Parent designs:**

- `docs/superpowers/specs/2026-07-30-paper-doll-rig-design.md`
- `docs/superpowers/specs/2026-08-01-cyl-9ml-family-release-v1-design.md`

## Executive decision

Madison will upgrade the existing Best Bottles Studio into the operating surface
for the Paper-Doll Rig. It will not create a second disconnected studio.

The workbench has four views over one release contract:

1. **Assembly** — layered visual composition, inspection, selection, and editing.
2. **Matrix** — complete component requirements and lifecycle tracking.
3. **Lineup** — four-to-five-product catalog comparison on one locked baseline.
4. **QA & Publish** — release gates, Sanity projection, named approval, and
   guarded publication.

The first launch family uses the five frozen CYL-9ML body plates and every
catalog-required 9 ml roller, cap, sprayer, hood, lotion pump, and closure.
Completing CYL-9ML includes material qualification, metal-roller remediation,
controlled editing, release tracking, live Sanity publication, and UI readback.
It is not complete when only the current three opaque overcaps work. Once the 9 ml
release passes, the same machinery expands across the remaining Cylinder
geometries without inventing a second workflow.

## Required end state

These are committed requirements, not optional future ideas:

- Build the complete pump and sprayer catalog from master-catalog requirements.
- Repair and requalify the defective metal roller-ball asset.
- Support free-flow canvas selection, painting, movement, and controlled pixel
  adjustment while versioning every material change and transform.
- Support both Google Nano Banana 2 and OpenAI GPT Image 2 for candidate edits.
- Support live Sanity publication only after dry-run, blocking QA, and named
  visual approval pass.
- Approve translucent plastic only after assembly-context QA passes on calibrated
  real fixtures.
- Upgrade the existing Studio substantially without replacing its proven route,
  authentication, organization context, and master-generation shell.
- Use the phrase **geometry locked** only after authoritative-mask clamp and
  post-edit geometry verification pass.

## Truth already available

The workbench consumes the completed release core rather than recreating it:

- versioned Zod manifest contract and canonical hashing;
- fail-closed assembly resolver and release validator;
- five SHA-frozen CYL-9ML body plates;
- one Blender geometry authority for the roll-on overcap;
- mirror chrome, matte white, and glossy black closure variants with exact
  binary silhouette identity (`IoU 1.0000`);
- one shared opaque-closure geometry mask;
- fifteen explicit body × opaque-cap assembly mappings;
- translucent-frosted closure represented as a calibrated blocker;
- organization-scoped Supabase component, QA, release, membership, and publish
  ledger tables;
- deterministic release verification.

The current metal roller remains a known do-not-ship defect: 72.8% of the asset
is opaque pure-white junk. The workbench must surface it as blocked and cannot
inherit its historical approved flag.

## Approaches considered

### One unrestricted canvas with direct generation and publishing

Rejected. It is visually attractive but conflates experiments, approved
component identity, catalog completeness, release membership, and publication.
It makes silent pixel nudges and accidental publication too easy.

### Read-only release viewer

Rejected as the final architecture. It is the safe first surface, but it does not
provide the editing, catalog completion, remediation, or publishing controls the
operation requires.

### Versioned release-control workbench

Selected. It keeps a free visual canvas while treating every edit as a candidate
component version, every assembly as an explicit mapping, every gate as evidence,
and every publication as a recorded release event.

## Existing Studio integration

The existing `BestBottlesStudio` route and outer shell remain. Masters remains
the canonical-image lane.

For release-capable families, the current Components surface becomes the
Paper-Doll Release Workbench. The empty Compose skeleton is retired from the
release-capable path because Assembly is now a first-class workbench view.
Legacy generation and `paper_doll_approved_assets` remain isolated for families
that have not crossed into the release contract; they cannot grant Release v1
approval or silently populate the immutable release ledger.

The workbench itself is split into focused modules rather than added to the
already-large page component:

- release source adapter;
- workbench state and URL view selection;
- family inventory and compatibility rail;
- assembly canvas and layer stack;
- edit lab;
- lifecycle matrix;
- catalog lineup;
- evidence inspector;
- release QA summary;
- Sanity projection and publication controller.

## Visual architecture

The selected direction is **Precision Bench**.

### Persistent family header

Shows:

- family and physical geometry identity;
- release and schema versions;
- canonical manifest hash;
- required/generated/approved/released/published counts;
- blockers and advisories;
- target Sanity state;
- explicit read-only, candidate-edit, or publish-authorized mode.

Counts always include a denominator derived from the catalog requirements. A
label such as “8 approved” without “of 10 required” is prohibited.

### Family inventory rail

Bodies and component systems remain separate.

- Body material rail: clear, amber, cobalt, frosted, swirl.
- Compatible systems: roll-on, fine-mist spray, lotion pump, closure/reducer,
  and any later catalog-authorized applicator system.
- Each system expands into physical parts, then material/finish variants.
- Status belongs to a component version, never to a loose image URL.

Selecting a body filters compatible systems through explicit catalog truth such
as family, dimensions, neck thread, applicator, and component family. It does not
parse arbitrary product names or select the first available asset.

### Assembly canvas

The canvas provides:

- pan and zoom;
- canonical centerline, baseline, alpha bounds, geometry mask, and seat overlays;
- top-to-bottom layer stack;
- component selection by clicking the layer or its pixels;
- target rectangle, brush mask, and whole-layer selection;
- before/after and difference views;
- inspection probes for target regions such as neck junction, cap surface, or
  glass body;
- temporary drag/transform exploration;
- catalog-scale preview using the release canvas.

The canvas has two explicit modes:

1. **Release lock** — manifest coordinates are authoritative and cannot be
   modified.
2. **Edit lab** — selections, painting, candidate material edits, and temporary
   transforms are available.

A canvas drag never modifies an approved component or current release. Saving a
transform creates a candidate recipe/component version with the exact affine
delta and source version recorded.

## Controlled edit engine

### Selection contract

Every provider or manual edit carries:

- source component-version ID and SHA;
- full release canvas dimensions;
- authoritative component alpha;
- authoritative geometry mask where present;
- selected target mask from layer, rectangle, or brush;
- assembly context image when material judgment requires it;
- requested material/color change;
- provider and exact model;
- prompt text and hash;
- parent candidate or approved version;
- initiating user and organization.

### Provider selection

The operator can choose:

- **OpenAI GPT Image 2** for high-fidelity masked edits; or
- **Google Nano Banana 2** for fast comparative material edits.

The UI names exact models, expected cost, and provider limitations. Provider
fallback cannot occur silently. A fallback is a new recorded attempt requiring
operator confirmation.

### Mask-and-clamp contract

Reference anchoring is not geometry authority. Every model output follows this
deterministic postprocess:

1. Normalize the returned raster to the release canvas without asymmetric
   stretching.
2. Restore every pixel outside the selected edit mask from the exact source.
3. Reapply the authoritative component alpha/geometry mask.
4. Restore every pixel outside the component mask from the original assembly.
5. Recompute bounds, centerline, seat, mask equality, and asset hashes.
6. Compare against the parent version and record all changed pixels.
7. Create a candidate version; never overwrite the parent.

Only a result with exact required mask identity and passing post-edit gates may
display **geometry locked**. “Reference locked,” “reference anchored,” or a clean
bounding box is not sufficient.

### Manual pixel and transform edits

Controlled manual adjustments are supported. They must remain:

- explicit;
- reversible;
- attributed;
- diffable against a parent;
- isolated to a candidate version;
- subject to the same geometry and material QA as provider outputs.

The UI does not contain a hidden production nudge or direct overwrite path.

## Complete catalog requirements

The Matrix denominator is generated from the Best Bottles master catalog, not a
hand-maintained UI list.

Each requirement contains stable keys for:

- family and physical body geometry;
- capacity and dimensions;
- neck thread;
- assembly system/applicator;
- component role and physical component family;
- material/finish variant;
- matching products/SKUs;
- whether the part is required for the current family release or later catalog
  coverage;
- source evidence and unresolved identity blockers.

The catalog must cover, at minimum for the 17-415 Cylinder family:

- plastic and metal roller balls;
- every roll-on overcap finish;
- all fine-mist sprayers;
- translucent spray hoods;
- all lotion pumps;
- translucent lotion-pump hoods;
- caps, reducers, plugs, and other catalog-authorized closures.

The requirements snapshot is versioned and hashed. A catalog change can add work
without rewriting the historical completeness result of an earlier release.

## Lifecycle Matrix

Every cell resolves one logical requirement to zero or more component versions.
The lifecycle is:

```text
missing → candidate → qa-passed → approved → in-release → published
                     ↘ blocked / rejected
```

The UI never collapses these into one “done” state.

Each cell displays:

- required variant identity;
- latest version and parent lineage;
- generation/provider attempts and cost;
- source/renderer provenance;
- QA state and calibrated fixtures;
- approval identity and timestamp;
- release membership;
- Sanity publication/revision state;
- all blockers and remediation action.

Filtering supports family, body geometry, assembly system, role, finish, provider,
status, release version, and publication state. Summary counts are computed from
requirements and ledger joins, not client-side labels.

## Catalog Lineup QA

The Lineup view renders four or five explicit assembly mappings in a horizontal
catalog sequence. It is not a contact sheet of unrelated generated images.

Controls include:

- baseline overlay;
- centerline overlay;
- alpha/geometry bounds;
- difference overlay;
- fixed physical scale and canvas framing;
- body and component swatch sequencing;
- product/SKU labels and mapping IDs;
- per-product and family-level registration verdicts.

Blocking lineup checks include:

- canvas and scale equality;
- baseline and centerline tolerances calibrated on real family files;
- selected component geometry-mask identity;
- explicit mapping resolution with no fallback;
- consistent layer order;
- material-specific assembly appearance;
- absence of clipped parts, frame detection, stray regions, or invalid shadow
  ownership.

The Lineup is the named visual-approval surface before publication.

## Final QA phases

QA proceeds in this order:

1. **Catalog identity** — requirement, product mapping, dimensions, role, finish,
   and source identity are unambiguous.
2. **Component truth** — canvas, alpha, hashes, material, source, and provenance.
3. **Geometry lock** — mask identity, bounds, axis, seat, silhouette, and clamp
   evidence.
4. **Assembly context** — junction, occlusion, shadow, tube visibility, glass and
   translucent behavior.
5. **Matrix completeness** — every release requirement resolves exactly once and
   broader catalog gaps remain visible.
6. **Catalog lineup** — family-scale baseline and visual consistency.
7. **Sanity projection round-trip** — projected payload parses back without losing
   IDs, hashes, QA evidence, geometry, mappings, or layer order.
8. **Named visual approval** — approver, release hash, lineup evidence, timestamp,
   and approval decision are recorded.
9. **Publication verification** — resulting Sanity document, asset references,
   revision, and storefront readback match the approved release.

Every blocking gate names the real fixtures on which it was calibrated. Frame
detection, missing masks, or provenance failures override plausible numeric
scores.

## Translucent-plastic qualification

Translucent plastic is a required material, not a permanent exclusion.

It cannot be approved from an isolated transparent PNG. Qualification requires:

- the component rendered/composited on every required body context;
- correct transmission, internal visibility, edge density, and color interaction;
- geometry authority independent of tone;
- assembly shadow/occlusion review;
- calibrated comparison fixtures spanning clear, amber, cobalt, frosted, and
  swirl bodies;
- passing Lineup review;
- a new component version and QA evidence.

Until those gates pass, the current translucent cap remains blocked.

## Metal roller remediation

The defective frozen metal roller is an explicit remediation workstream:

1. Re-extract or rebuild the roller from the recropped source.
2. Add calibrated opaque-white-fraction and contiguous-junk checks using the real
   metal and plastic roller fixtures.
3. Re-run alpha, region, resolution, material, and assembly-context QA.
4. Create a new component version; do not mutate the defective historical bytes.
5. Mark the defective version rejected/superseded while preserving its audit
   history.
6. Include the repaired version in Lineup and release verification before approval.

## Sanity projection and publication

### Projection preview

Projection preview is always no-write. It may run on a draft or blocked release so
operators can inspect the future document, but it cannot imply publish readiness.

It displays:

- exact project, dataset, document ID, and document type;
- release and schema versions;
- canonical manifest and payload hashes;
- asset upload/reuse plan;
- stable array keys;
- field-level additions, changes, removals, and preserved unrelated fields;
- full validation and blocker summary;
- round-trip parse result;
- zero-write evidence.

### Named approval

Approval binds a named user to:

- exact release and manifest hash;
- exact Sanity payload hash and target;
- selected catalog Lineup evidence;
- blocking QA result;
- timestamp and optional review note.

A material release change, target change, payload change, or asset-byte change
invalidates prior approval.

### Live publication

Live publication is supported only when:

- release status is `ready`;
- all blocking gates pass;
- projection round-trip passes;
- named approval matches the exact hashes and target;
- an explicit server-issued, single-use authorization is valid;
- the operator confirms the target immediately before execution.

Secrets remain server-side. The client cannot construct a privileged mutation.
The publish run records request/payload hashes, uploaded/reused assets, field diff,
result, error, Sanity revision, and post-publish readback.

No bulk Shopify or storefront mutation is implied by Sanity publication.

## Tracking and ownership

- Best Bottles master catalog defines requirements and product/SKU mappings.
- Supabase owns component versions, generation attempts, QA evidence, releases,
  approvals, and publish-run history.
- The release manifest is the immutable portable contract used by Madison,
  Sanity projection, and storefront consumers.
- Sanity owns the published `paperDollFamily` document and asset references.
- The storefront reads Sanity and never queries Supabase at runtime.
- Git owns renderer, validator, schema, prompt, and migration provenance.

The UI joins these sources through stable IDs and hashes. It does not copy volatile
live status into static instruction files.

## Failure behavior

- Unknown family, requirement, component, mapping, or release key fails closed.
- Missing images show the exact path/key and remediation action.
- Provider failure preserves the parent and attempt evidence.
- Provider output with wrong dimensions is normalized only through approved,
  deterministic rules; otherwise it is rejected.
- Geometry mismatch produces a blocked candidate, never an auto-corrected approval.
- Stale named approval prevents publication.
- Sanity target or diff mismatch prevents publication.
- Partial publication records failure and supports idempotent retry from the same
  release/payload hashes.
- The UI never selects a first/default asset to hide missing data.

## Testing strategy

### Pure domain tests

- requirements-to-matrix joins;
- lifecycle derivation;
- compatibility resolution;
- assembly layer ordering;
- lineup scale/baseline computation;
- edit-mask and clamp behavior;
- candidate lineage and diff summaries;
- release and publish gate decisions;
- Sanity payload projection and round-trip parsing.

### Image tests

- outside-mask pixels remain byte-identical;
- authoritative alpha and geometry masks survive edits;
- provider dimension/crop normalization;
- transparent/material assembly fixtures;
- repaired metal vs defective metal and plastic roller calibration;
- five-body lineup registration;
- no frame, junk region, or contact-shadow contamination.

### UI tests

- view/filter state and deep links;
- keyboard and pointer canvas selection;
- bounds/mask/difference overlays;
- provider confirmation and candidate-only result state;
- matrix counts and drill-down;
- Lineup product mappings;
- blocked, dry-run, approval, and publish button states;
- target confirmation and stale-approval behavior;
- responsive layouts and reduced motion.

### Integration tests

- generation-attempt creation and completion;
- component-version and append-only QA persistence;
- release immutability;
- Sanity no-write projection;
- single-use publish authorization;
- live publish to a non-production test dataset before any production target;
- revision/readback verification.

## Delivery decomposition

The complete scope remains committed. Work is ordered by family launch rather than
by disconnected technical demos.

### Immediate launch target — complete CYL-9ML

The immediate target is one fully traced 9 ml family from catalog requirements to
published UI:

1. Derive the complete CYL-9ML requirements snapshot from the master catalog.
2. Reconcile every 9 ml product/SKU to an explicit assembly mapping.
3. Inventory all required bodies, rollers, overcaps, sprayers, spray hoods, lotion
   pumps, lotion hoods, reducers, plugs, and closure variants.
4. Repair the metal roller and create a superseding component version.
5. Generate, import, or parametrically render every missing required component.
6. Qualify opaque, glass, rhinestone, and translucent materials through their
   appropriate component and assembly-context gates.
7. Operate the complete family through Assembly, Matrix, Lineup, and QA & Publish.
8. Persist candidate, QA, approval, release, and publish evidence.
9. Publish the ready release to the confirmed Sanity target through named approval
   and single-use authorization.
10. Read the published `paperDollFamily` document back through the Best Bottles
    storefront product UI in its explicitly confirmed staging or production
    environment, and verify body/component swatches, layer order, fallback,
    hashes, and catalog baseline behavior. The Madison workbench displays the
    same readback result and Sanity revision.

“Pushed into Sanity and into the UI” means a real published document and verified
Best Bottles storefront readback from the named environment. A local mockup,
payload file, dry-run response, or Madison-only preview does not satisfy this
milestone.

The requested execution window is measured in hours, but schedule confidence does
not waive a release gate. Any unresolved identity, missing asset, failed material
gate, stale approval, or readback mismatch keeps the release blocked and produces
an exact remaining-work report rather than a false completion claim.

### Next family target — remaining Cylinder geometries

After CYL-9ML passes, expand the requirements snapshot, component library,
assembly mappings, Lineup QA, Sanity document coverage, and UI verification across
the rest of the Cylinder family. Shared components are reused by immutable version
ID and compatibility evidence; they are not regenerated per SKU or copied into
new ad hoc lanes.

The technical workstreams below remain independently testable inside those family
milestones.

### Workstream A — visual control plane

- Upgrade the existing Studio Components surface.
- Load and verify the real local CYL-9ML release bundle.
- Implement Assembly, Matrix, Lineup, Evidence, and QA/Publish preview views.
- Show real five-body and three-approved-cap assets plus current blockers.
- Keep the release source read-only.
- Produce a real no-write Sanity projection preview.

### Workstream B — controlled Edit Lab

- Rectangle, brush, layer, and target-region selections.
- GPT Image 2 and Nano Banana 2 selection.
- Attempt ledger, cost, prompts, inputs, and provider evidence.
- Mask clamp, alpha restoration, geometry verification, before/after diff.
- Candidate-version persistence and controlled manual transforms.

### Workstream C — complete 17-415 component catalog

- Master-catalog requirement snapshot.
- Rollers, overcaps, fine-mist sprayers, hoods, lotion pumps, reducers, plugs,
  caps, and all required finish variants.
- Bulk generation/import queue, family filters, progress, and cost tracking.
- Metal-roller remediation and requalification.

### Workstream D — advanced material qualification

- Translucent assembled-context pipeline and calibrated QA.
- Rhinestone deterministic instancing/UV or locked-composite method.
- Glass recoloring and finish conversion candidates through Edit Lab.
- Full family Lineup approvals.

### Workstream E — immutable approval and live Sanity publication

- Release-ledger writes from server-side actions.
- Named visual approval bound to release/payload/target hashes.
- Single-use live-publish authorization.
- Production Sanity publish, revision capture, and readback verification.

Subsequent release plans cannot remove an earlier committed requirement without a
new explicit product decision and design amendment.

## Acceptance criteria

The program is complete only when:

- the complete required 17-415 pump/sprayer/closure catalog is represented in the
  Matrix with a truthful denominator;
- every component has immutable version, provenance, QA, approval, release, and
  publication evidence;
- controlled provider and manual edits never overwrite approved parents;
- **geometry locked** appears only after mask-and-clamp verification;
- repaired metal-roller evidence supersedes the defective version;
- translucent components pass calibrated assembly-context and Lineup QA before
  approval;
- five-product sequences visibly and numerically align;
- Sanity projection round-trips deterministically;
- named approval and single-use authorization gate live publication;
- post-publish Sanity revision/readback matches the approved release;
- the existing Studio route, auth, organization context, and Masters workflow
  remain operational throughout the upgrade.
