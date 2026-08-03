# Best Bottles paper-doll system synthesis audit

**Date:** 2026-08-03  
**Scope:** read-only repository audit  
**Decision:** preserve the existing rig and the new 2080×2288 component-factory lifecycle; do not start a third plate system.

## Executive verdict

Madison already contains the core of the correct architecture, but it does not yet contain a complete Best Bottles plate catalog.

The strongest production path is the newer `src/lib/paperDoll` + Production Candidate Bench + append-only release-cut system. It already provides full-canvas composition, exact-alpha geometry clamping, four separate bounds, versioned approvals and placements, atomic release cuts, and separate Sanity draft/public actions.

The generic steering assumption that the repository already contains a complete physical 3D bottle/component rig is not true. The repository contains a mature prompt-driven image rig and deterministic 2D framing/compositing system, plus one procedural Blender cap generator. No tracked `.blend`, CAD, STEP, STL, GLB, FBX, or OBJ bottle/pump/sprayer models were found. Geometry truth currently comes from measured catalog data, approved source silhouettes, five locked CYL-9ML body plates, authority masks, and deterministic placement—not a complete 3D digital-twin library.

The immediate production gap is not another architecture. It is completing the existing lifecycle. As of the latest local evidence pass:

- all 23 CYL-9ML component candidates exist on the canonical canvas;
- all 23 copy the registered authority alpha exactly with zero mismatched pixels;
- all 115 component/body assemblies exist in one production-candidate review matrix;
- the three rhinestone candidates now use one deterministic eight-stone registry over stone-free material bases;
- the two translucent overcaps remain explicitly marked for five-body human review;
- 0 candidates have been promoted through named Approve Pixels; the guarded private-ledger import is prepared but intentionally unexecuted;
- 0 of 13 geometry-family placements are locked;
- no new release cut exists;
- no Sanity draft has been synced from that release.

The catalog-wide reusable scope is now captured in a generated master shot list rather than estimated from SKU count. It contains **309 source-backed appearance requirements**: 161 body appearances and 148 explicit component appearances. This is an appearance-output ceiling, not 309 separate Blender meshes and not one image per SKU. Twenty-two source-backed requirements already have exact local authority coverage, leaving 287 source-backed authority/truth rows outstanding. The operational ledger contains 318 rows because it also preserves six existing pilot assets awaiting an exact source-row crosswalk and three blocked source responsibilities; those nine rows are support/review work rather than additional generation commitments.

## Steering-prompt disposition

The repository-first, smallest-complete-system, deterministic-coordinate, compatibility, provenance, versioning, and QA rules are adopted.

The following proposals are intentionally conditional rather than implementation requirements:

- liquid plates, pending a body-contextual A/B against the existing masked liquid approach;
- label and decoration plates, pending the component/release proof and an explicit label-panel contract;
- integration plates, only where correct geometry and placement still leave a reproducible optical seam;
- new 3D geometry, family-by-family where measured authority is absent and procedural construction has a clear benefit;
- any folder migration, only where the current organization demonstrably blocks the lifecycle.

The assumption that a complete physical 3D rig already exists is rejected by repository evidence. The audit therefore preserves the working 2D/prompt/compositor rig and does not invent missing CAD authority.

## Repository truth

### Catalog and measurement sources

- `public/data/best-bottles-catalog-lite.json`: 2,483 catalog rows across 39 family labels.
- `docs/best-bottles-canonical-truth/best-bottles-master-truth.csv`: 2,484 data rows plus header.
- `docs/best-bottles-canonical-truth/best-bottles-body-geometry.csv`: 118 distinct body-geometry rows plus header.
- Raw catalog metadata contains 34 neck-finish strings and 14 applicator labels. Some neck values are visibly dirty or non-standard, so they are not safe compatibility keys without normalization.
- A raw join on neck/applicator/cap fields produces 363 appearance keys. This is an upper-bound catalog signal, not a verified count of unique physical components.

### Existing rig

The current product rig is primarily:

- prompt and reference identity control;
- measured family/profile framing;
- 2080×2288 canvas routing;
- deterministic baseline, centerline, scale, and recanvas logic;
- material/presentation prompt contracts;
- post-generation QA and guarded publication;
- deterministic paper-doll composition and contextual weld masks.

It is not currently a complete parametric 3D geometry/camera/lighting asset library. Camera and lighting are largely expressed as versioned prompt and placement contracts. This distinction must remain explicit.

### Existing CYL-9ML paper-doll system

- Five approved, SHA-pinned body plates: Amber, Cobalt, Clear, Frosted, and Swirl.
- Canonical canvas: 2080×2288, Bone `#F5F3EF`.
- 23 component records and candidate plates:
  - 10 roll-on overcaps;
  - 2 roller fitments;
  - 6 fine-mist sprayers;
  - 3 lotion pumps;
  - 2 translucent secondary overcaps.
- 13 geometry families and 13 approved full-canvas authority masks.
- 145 deterministic assembly combinations are derived from the manifest.
- Exact-alpha clamp, four-box provenance, topology checks, material-class routing, rhinestone layout persistence, and translucent assembly review rules exist.
- Candidate, approval, family-fit, placement, release-head, release-cut, Sanity-draft, and public-publication persistence exists in migrations and Edge Functions.
- Current visual evidence: 23 candidate rows, 5 locked bodies, 115 exact-coordinate assemblies, 23 family lineups, and one full contact sheet under `outputs/paper-doll-component-factory/CYL-9ML/production-candidate-review/`.

## Rig-versus-plate responsibility matrix

| Responsibility | Owner | Decision |
|---|---|---|
| Physical dimensions and compatibility | catalog truth + verified geometry authority | Keep procedural/structured; never infer from filenames alone. |
| Bottle silhouette and neck/thread geometry | approved body authority; future CAD/Blender where available | Never replace with generated geometry. |
| Camera, perspective, canvas, centerline, baseline | rig contract | Never make per-SKU plate adjustments. |
| Base bottle appearance | approved body plate or future deterministic body render | Family/body-specific plate. |
| Closure, roller, pump, sprayer exterior pixels | component factory | Reusable component plate after exact-alpha clamp. |
| Mirror/matte/dielectric material changes | deterministic derivation where valid, otherwise GPT material edit | Pixels may change; authority alpha may not. |
| Rhinestones | deterministic registered decoration | Preserve stone IDs, order, size, and normalized position. |
| Dip tubes and internal bottle interaction | contextual weld or future physical render | Never a free-standing global plate. |
| Contact shadow and grounding | rig/compositor | Keep procedural; do not create a reusable SKU shadow plate. |
| Cap-to-neck and glass interaction | deterministic occlusion or body-contextual integration | Create only when a visible seam remains after correct placement. |
| Labels and printed decoration | future decoration layer | Reusable only within a declared label panel/view contract. |
| Liquid | body-contextual procedural/masked render first | Never a universal color overlay; plate only if an A/B test proves the benefit. |
| Background | canvas contract | Not a plate. |
| Final SKU | exact recipe + immutable versions | Deterministic assembly, never an untracked manual composite. |

## What already exists and works

1. Canonical product and body-geometry datasets.
2. Family scale profiles and a fixed production canvas.
3. Five locked CYL-9ML body plates with verified cross-body registration.
4. A deterministic Node/Sharp compositor with mm-aware placement, mount-axis support, contact occlusion, and shadow painting.
5. A contextual weld lane that restores body pixels outside the approved mask.
6. Component intake and QA, including the metal-roller detached-junk lesson.
7. Exact-alpha authority-mask clamping and byte-level verification.
8. A 23-component CYL-9ML inventory, 13 geometry authorities, material recipes, and 145 derived assembly combinations.
9. Deterministic rhinestone registration using eight permanent IDs, fixed pixel centers, stone-free material bases, and a versioned post-process candidate lineage.
10. An interactive family-fit workbench with individual body inspection.
11. Append-only candidate history, named approvals, immutable placement versions, release heads/cuts, and Sanity sync records.
12. Separate Sanity draft sync and public publication controls.

### Catalog-wide reusable shot list

- `master-plate-shot-list.json` is the canonical machine-readable checklist.
- `master-plate-shot-list.csv` is the portable filter/sort view.
- `MASTER-PLATE-SHOT-LIST.md` records the count interpretation and operating sequence.
- 309 source-backed reusable appearance plates cover 2,131 unique catalog bottle identities without rendering each SKU independently.
- 161 rows are body appearances across 118 measured body geometries.
- 148 rows are explicit component-source appearances; they must still be grouped into verified physical geometry families before modeling.
- Those 148 appearances now resolve into 42 conservative descriptor review lanes using exact slot, neck-finish, applicator, and cap-style evidence. This is a review reduction, not a geometry-lock claim.
- One lane—the ten 17-415 roll-on cap finishes—already proves one shared exact authority mask. The two local 17-415 pump/sprayer lanes require reconciliation because their current appearance authorities do not prove one shared mask.
- Twenty-eight lanes have component imagery for every source identity and can enter physical review; eleven remain source-incomplete.
- All 117 references across the 28 source-ready lanes are now preserved locally and have calibrated, per-source silhouette diagnostics; all 28 completed and none failed.
- The diagnostics are ranked review evidence only. They do not use a global pass threshold and do not promote source photography to geometry authority.
- Six physical-review boundaries are recorded: split direct-bulb and tassel atomizers, quarantine the clear-protected lotion pump for responsibility decomposition, decompose each 15-415 sprayer kit into exposed head plus protective overcap plus a body-contextual dip tube, keep 20-400 dropper pipette length body-contextual, require a fluted/flanged profile for 8-425 short caps instead of reusing the smooth renderer, and quarantine the contradictory 10 mm versus 32 mm heights assigned to the two 13-415 short caps.
- The first component-kit source extraction is now reproducible: ten SHA-pinned 15-415 Photoshop sources yield five exposed heads, five protective overcaps, and five dip-tube review assets with native pixels preserved. The generated manifest and three responsibility contact sheets remain local, review-only evidence; no source composite, extracted cutout, or centered review canvas is geometry locked or production eligible.
- Twelve distinct dimension-calibrated cap candidate families now cover 38 catalog appearances with 37 rendered outputs. The measured 21 × 45 mm 18-400 applicator candidate preserves the short fluted black shell and clear-glass rod as one compound responsibility; its cap-shell height, stem diameter, and terminal dimensions remain source-derived review parameters. The 18-400 short black cap has its own measured 21 × 11 mm fluted profile and is not merged with the larger 20-400 cap. The two 20-400 short-cap identities resolve to one identical source file, one Grace SKU, and one verified 23 × 12 mm fluted profile; explicit source-identity aliases preserve both catalog rows without duplicating the render. The two short 8-425 caps use a dedicated fluted/flanged mesh instead of the smooth renderer; source-derived flute counts remain review parameters rather than verified tooling truth. The six 20-400 tall roll-on cap appearances share verified 23 × 35 mm dimensions and one smooth review profile. The five 18-415 faux-leather appearances share a verified 25 × 30 mm two-zone profile; their leather grain and trim coatings remain unapproved material responsibilities. Every variant within its own family has byte-identical clamped alpha, but all twelve profiles remain review-only: geometry lock, production eligibility, family placement, Current Release, and Sanity state are all unchanged.
- 22 source-backed requirements have exact local authority coverage; 287 remain authority or catalog-truth work.
- 318 operational rows include six supplemental local pilot assets and three missing-source responsibilities (`glass-rod`, `reducer`, `stopper`).
- Every row carries family, appearance, authority/source key, evidence URLs, status, priority, next gate, and existing SHA-pinned asset evidence where available.
- Generation, remote writes, Current Release mutation, and Sanity mutation remain false.

## Genuine gaps

### Blocking CYL-9ML production

1. The 23-candidate private-ledger import and named pixel approvals remain operator actions. Candidate creation is not approval.
2. The two translucent overcaps require explicit five-body visual acceptance; they cannot auto-pass from isolated alpha or brightness metrics.
3. All 13 family placements remain unlocked pending named family-fit approval.
4. The new current release and Sanity draft do not exist yet. The browser now resolves exact persisted body-version UUIDs and can lock a reviewed shared placement without using local display IDs.
5. The base manifest still stores an empty `catalogMappings` array; exact catalog identity now lives in the generated, source-hashed `cyl9-catalog-crosswalk.json` and is joined onto the 145 structural mappings at load time. Future family manifests still need the same declarative pattern generalized.

### Resolved during this audit

The 147 Cylinder/9ml/17-415 catalog rows resolve to 145 unique website SKUs. The two surplus rows duplicate the Swirl/White plastic- and metal-roller website SKUs while incorrectly labeling their body color as Clear. The production crosswalk selects the rows whose body color agrees with the website SKU and preserves both conflicts as `catalogReviewIssues`. Every production mapping now contains an exact `graceSku` and `websiteSku`; no row was silently guessed or discarded.

### Blocking catalog-wide scale

1. The shot list proves 161 required body appearances across 118 measured geometries; only three have exact source-backed local crosswalk coverage, while Frosted and Swirl are preserved as locked supplemental pilot plates pending their canonical geometry aliases.
2. The catalog-wide component authority queue contains 148 explicit source identities, but compatibility remains unverified and the appearances still require physical-geometry grouping before production. Do not treat 148 appearances as 148 unique models.
   The generated 42-lane review queue is the starting point for that physical grouping; only one lane currently earns a shared-authority claim.
3. Droppers, atomizers, vintage bulbs, tassels, reducers, glass rods/stoppers, and several other applicator classes are not represented in the new release slot contract.
4. Label, decoration, liquid, and explicit integration-layer records are not represented in the new release schema.
5. There is no complete parametric 3D bottle/pump/sprayer library in the repository.
6. Catalog-wide contact sheets and recipe-level QA exist as architecture, but not as complete assets for all families.

## Duplicate or conflicting functionality

### Legacy Darkroom paper-doll lane

`src/components/darkroom/ComponentsTabPanel.tsx` and `src/lib/paperDollAssets.ts` form an older paper-doll implementation. It:

- defaults to the legacy 1000×1300 component preset;
- treats generated/reference-anchored output as a slot result without exact-alpha authority clamping;
- stores approved slots through delete-then-insert upserts;
- uses cohort/applicator/cap-color identity rather than immutable component/candidate/placement versions.

It should remain a legacy intake surface until it is bridged to the new component factory. It must not become a second production authority.

### V1 versus V2 release persistence

The repository contains both `paper_doll_family_releases`/`paper_doll_family_release_assets` and the newer release-head/release-cut model. The newer append-only release-cut path is the production authority. The V1 tables should be treated as compatibility data until migration/deprecation is explicitly planned.

### Full-product generation lane

The older full-image generation pipeline overlaps with paper-doll assembly. Retain it as a bounded fallback for exceptional one-off shapes and plate birth, not as the default way to produce component colorways.

### Intentional duplication

The Node and Deno `familyRig` modules are runtime twins. This duplication is documented and intentional, although parity tests must remain mandatory.

## Liquid recommendation

**Do not build a general liquid plate library now.**

Current PDP body contracts intentionally render empty bottles. A separate marketing-only filled-hover pilot already supports a reviewed cavity mask, a fixed fill percentage, outside-mask pixel preservation, and meniscus QA. That is useful prior art, but it is not connected to paper-doll recipes and it does not prove that a reusable liquid plate will composite correctly through every glass body.

Classify liquid support as `existing-but-incomplete`:

1. Keep liquid body-contextual.
2. After CYL-9ML components ship, test one clear CYL-9ML body at five optical densities.
3. Compare a masked procedural/generated cavity edit against a family/body-specific liquid layer.
4. Require unchanged outer silhouette, no leakage outside the reviewed cavity, credible meniscus/refraction, and assembled visual review.
5. If plates win, key them to exact body-plate version, view, fill level, liquid optical class, and lighting rig. Never reuse them globally.

## Recommended pilot

Keep `CYL-9ML` as the pilot because it has the only complete locked five-body authority set.

The next bounded proof should include:

- all five locked body plates;
- plastic and metal roller fitments sharing one verified housing geometry;
- two cap finishes that exercise different material structure, not merely different hue;
- one sprayer with its contextual tube weld;
- exact SKU identity for 3–5 representative catalog rows;
- one append-only release cut and one Sanity draft sync;
- no public publication.

Liquid and labels should follow this component/release proof, not block it.

The next-family intake is now scaffolded separately as `CYL-5ML-13-415`. It contains three measured geometry records, four body appearance requirements, 54 catalog identities, and 23 normalized physical responsibilities: 13 independent cap appearances, two roller fitments, and eight sprayer finishes. The eight catalog `capStyle: Spray` descriptors are integrated sprayer evidence, not eight duplicate caps. The intake performs no generation or production mutation. The only local 5 ml visuals found are legacy full-product references, not clean body authorities, so the family remains correctly blocked before candidate creation.

## Minimal implementation order

1. **Reconcile CYL-9ML catalog identity — complete locally.** Exact `graceSku`/`websiteSku` mappings are persisted with a source hash; the two conflicting duplicate rows are quarantined as review evidence.
2. **Material-candidate checkpoint — complete locally.** Seven deterministic and sixteen GPT-material candidates were produced and clamped; the three dotted finishes were then superseded locally by deterministic registered-stone candidates.
3. **Approve pixels — next human gate.** Named review of the 23 component variants, including deterministic rhinestones and five-body translucent review.
4. **Family fit and placement.** Review each of 13 geometry families on all five bodies, then lock shared placement versions. Use explicit per-body overrides only when evidence proves they are required.
5. **Release cut.** Atomically cut five bodies plus approved components/placements into a new Current Release.
6. **Sanity draft.** Sync only the named release cut to `drafts.d5291f24-f02b-4fb7-aa99-78c5f63d8c9d`; inspect downstream readiness before public publication.
7. **Legacy bridge.** Route Darkroom upload/generation into the new candidate lifecycle and stop legacy destructive approvals from becoming production truth.
8. **Generalize the manifest.** Remove CYL-9ML-only mapping reconstruction; make exact catalog mappings declarative and validated for future families.
9. **Next family factory.** Select the next body geometry from the 118-row geometry inventory and repeat the same evidence-based lifecycle.
10. **Liquid A/B.** Run the body-contextual liquid prototype only after the component/release path is proven.

The catalog-wide execution view is now the 318-line master shot list. Work it in status order: verify exact existing authorities, resolve P0 truth/source gaps, group appearances by physical geometry, produce and exact-alpha clamp the remaining appearances, then use named family-fit and release actions. Do not create a second ad-hoc checklist.

## Risks and review issues

- Catalog metadata is not clean enough for automatic compatibility at full scale.
- “Rig” currently means prompt/framing/compositor contracts more often than physical 3D geometry; calling it a full CAD digital twin would be inaccurate.
- The old approved component registry still contains historical/problematic assets, including the formerly defective metal-roller lineage. The newer recropped source must supersede it through versioned release history, not silent overwrite.
- Translucent components cannot be approved from isolated brightness/opacity metrics.
- Generated material quality remains a human visual decision even when geometry alpha is exact.
- Sprayer/pump tube behavior is body-color dependent and must remain contextual.
- Existing stale 1000×1300 documentation and UI paths can accidentally reintroduce a second coordinate system.
- Six untracked user image files are present under `assets/paper-doll/components/`; this audit did not modify or adopt them.

## Intentionally excluded from the immediate build

- A new Studio shell.
- A third asset registry.
- Universal liquid overlays.
- Universal integration/retouch layers.
- Mass catalog generation before CYL-9ML release proof.
- Rebuilding the five approved body plates.
- Public Sanity publication.
