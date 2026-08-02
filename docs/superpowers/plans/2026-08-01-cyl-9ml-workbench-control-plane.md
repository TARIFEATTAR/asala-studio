# CYL-9ML Workbench Control Plane Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the release-capable CYL-9ML Studio Components/Compose path with a read-only Precision Bench that visualizes the real release bundle across Assembly, Matrix, Lineup, Evidence, and QA & Publish preview without writing to Supabase or Sanity.

**Architecture:** A checked-in browser snapshot is exported from the validated local release bundle and parsed through the existing Release v1 contract. Pure workbench selectors derive lifecycle counts, explicit assemblies, lineup registration, blocker presentation, and a deterministic no-write Sanity projection. Focused React modules render those selectors inside the existing `BestBottlesStudio` shell only for the canonical CYL-9ML group; every other family keeps the legacy Components and Compose behavior.

**Tech Stack:** React 18, TypeScript, Vite asset URLs, Zod Release v1 schemas, Node `tsx --test`, existing Darkroom CSS/tokens, existing paper-doll release validator/resolver.

## Global Constraints

- Preserve the existing `/best-bottles/studio/:groupSlug` route, auth, organization context, Masters tab, and Darkroom shell.
- Reuse the five frozen body plates. Do not regenerate them.
- Treat the release manifest as the only authority for assets, mappings, layer order, status, QA, and blockers.
- Never select a first/default asset to conceal a missing mapping.
- Display `geometry locked` only when the release asset has the authoritative geometry mask and passing geometry-lock evidence; otherwise say `mask shared` or `not verified`.
- The existing translucent cap remains blocked and cannot resolve into an approved assembly.
- The known 72.8% white-junk metal roller remains explicitly blocked/missing from this release; no UI status may imply that it is approved.
- This slice makes no provider calls, no pixel edits, no component approval writes, no immutable ledger writes, and no Sanity mutations.
- The Sanity surface is an exact, deterministic, no-write projection preview with target fields marked unconfigured until a later server-side publisher slice.
- All status totals include a requirements denominator and distinguish missing, candidate, QA-passed, approved, in-release, blocked, and published.
- Calibrate visual overlays from the real 2080×2288 asset metadata; do not introduce fixed object-detection thresholds.

---

## Task 1: Export a browser-safe snapshot from the verified release

**Files:**

- Create: `scripts/paper-doll/export-workbench-release.ts`
- Create: `scripts/paper-doll/export-workbench-release.test.ts`
- Create: `src/generated/paperDoll/cyl9Release.generated.ts`
- Create: `assets/paper-doll/release-components/CYL-9ML/1.0.0-draft.1/layers/cap/*.png`
- Create: `assets/paper-doll/release-components/CYL-9ML/1.0.0-draft.1/geometry/*.png`
- Modify: `package.json`

- [x] Write a failing exporter test that builds a minimal temporary release and requires the exporter to parse it with `parsePaperDollReleaseManifest`, re-run `validatePaperDollRelease`, reject a validation mismatch, compute the canonical manifest hash, copy only non-body release images, and generate stable TypeScript data.
- [x] Run `npx tsx --test scripts/paper-doll/export-workbench-release.test.ts` and confirm the missing exporter failure.
- [x] Implement an exporter with explicit `--release-dir`, `--output-ts`, and `--component-asset-dir` arguments. It must fail closed on missing files, SHA mismatch, validation mismatch, or an unknown body asset SHA.
- [x] Map body assets to the existing tracked canonical files in `assets/paper-doll/body-plates/` by SHA rather than copying their ~20 MB bytes.
- [x] Copy cap/mask assets into the tracked release-component directory only after their SHA-256 values match the manifest.
- [x] Generate a stable TypeScript snapshot containing the full parsed manifest, validation result, canonical manifest hash, source paths, and an exhaustive asset-key-to-Vite-URL mapping. Include a generated-file warning and source release identity.
- [x] Add `paperdoll:export-workbench-release` to `package.json`.
- [x] Run the exporter against `outputs/paper-doll-family-releases/CYL-9ML/1.0.0-draft.1`, then re-run the test and inspect `git diff --stat` to confirm that only four caps, one geometry mask, and the TypeScript snapshot were promoted.
- [x] Commit: `feat(paper-doll): export verified release for workbench`

## Task 2: Build the pure workbench domain model

**Files:**

- Create: `src/lib/paperDoll/workbenchModel.ts`
- Create: `src/lib/paperDoll/workbenchModel.test.ts`

- [x] Write failing tests for release-family eligibility using the exact slug `cylinder-9ml-frosted-17-415-rollon`, with non-CYL-9ML groups falling back to the legacy Studio.
- [x] Write failing tests for an inventory tree that keeps body materials separate from component systems and preserves blocked assets.
- [x] Write failing tests for lifecycle counts with explicit denominators and mutually exclusive states. The current snapshot must report five bodies, three approved opaque caps, one blocked translucent cap, fifteen resolvable approved assemblies, and no published items.
- [x] Write failing tests proving blocked assets cannot resolve into an assembly and missing mappings remain errors rather than fallback selections.
- [x] Write failing tests for geometry labels: the three approved opaque caps may be `geometry locked` only when shared-mask identity and passing release QA evidence are both present; a shared mask without passing evidence is not enough.
- [x] Write failing lineup tests that select five explicit assembly mappings, preserve manifest layer order, and compute overlay percentages directly from manifest canvas/bounds/axis/seat metadata.
- [x] Implement typed selectors over `PaperDollReleaseManifest` and `PaperDollReleaseValidation` without React or browser dependencies.
- [x] Run `npx tsx --test src/lib/paperDoll/workbenchModel.test.ts src/lib/paperDoll/releaseValidator.test.ts`.
- [x] Commit: `feat(paper-doll): derive truthful workbench state`

## Task 3: Add deterministic no-write Sanity projection

**Files:**

- Create: `src/lib/paperDoll/sanityProjection.ts`
- Create: `src/lib/paperDoll/sanityProjection.test.ts`

- [x] Write failing tests for stable `_key` values, release/schema versions, manifest hash, canvas, assets, QA evidence, mappings, recipe layer order, blockers, and explicit target metadata.
- [x] Write a failing round-trip test that parses the projection back into an equivalent Release v1 manifest without losing component IDs, hashes, geometry, mappings, or layer order.
- [x] Write a failing test proving blocked releases produce a preview but `publishEligible: false`, `writeCount: 0`, and no mutation payload or credential-bearing field.
- [x] Implement `buildPaperDollSanityProjection` as a pure function. Use a caller-supplied target descriptor; default UI data must use `unconfigured` project/dataset/document values rather than guessing production.
- [x] Implement the reverse parser used by the round-trip gate and expose canonical payload hashing.
- [x] Run `npx tsx --test src/lib/paperDoll/sanityProjection.test.ts`.
- [x] Commit: `feat(paper-doll): add no-write Sanity projection`

## Task 4: Build the Precision Bench shell and navigation

**Files:**

- Create: `src/components/paper-doll/ReleaseWorkbench.tsx`
- Create: `src/components/paper-doll/ReleaseWorkbenchHeader.tsx`
- Create: `src/components/paper-doll/ReleaseInventoryRail.tsx`
- Create: `src/components/paper-doll/releaseWorkbenchState.ts`
- Create: `src/components/paper-doll/releaseWorkbenchState.test.ts`
- Create: `src/styles/paper-doll-workbench.css`

- [x] Write failing pure-state tests for `view=assembly|matrix|lineup|evidence|publish`, filter/query serialization, invalid-query fallback, and release-lock mode.
- [x] Implement the persistent header with family/geometry identity, release/schema versions, short manifest hash, lifecycle counts with denominators, blocker/advisory counts, target state, and an explicit `READ ONLY` mode badge.
- [x] Implement internal view navigation and a responsive inventory rail with separate Bodies and Compatible Systems sections. Populate it only from domain selectors.
- [x] Surface absent 17-415 systems (rollers, sprayers, pumps, reducers/plugs) as catalog gaps, not as generated assets. Label the defective metal roller blocker explicitly.
- [x] Ensure keyboard focus, selected state, and reduced-motion behavior work without changing the existing Studio shell.
- [x] Run `npx tsx --test src/components/paper-doll/releaseWorkbenchState.test.ts` and `npm run build`.
- [x] Commit: `feat(paper-doll): add Precision Bench shell`

## Task 5: Implement the Assembly and Evidence views

**Files:**

- Create: `src/components/paper-doll/AssemblyView.tsx`
- Create: `src/components/paper-doll/AssemblyCanvas.tsx`
- Create: `src/components/paper-doll/EvidenceView.tsx`
- Create: `src/components/paper-doll/assemblyCanvasModel.ts`
- Create: `src/components/paper-doll/assemblyCanvasModel.test.ts`

- [ ] Write failing canvas-model tests for explicit mapping selection, layer URL resolution, canvas-to-display scaling, alpha bounds, centerline, seat, geometry-mask overlays, and an error state for missing URLs.
- [ ] Implement a release-lock canvas that composes the selected manifest layers at their authoritative full-canvas coordinates. Add zoom, pan, layer visibility, bounds, centerline, seat, and mask toggles; do not add persistent drag or editing behavior in this slice.
- [ ] Display top-to-bottom layer order, exact component-version IDs, SHA prefixes, material/approval states, bounds, mount axis, and seat coordinates.
- [ ] Implement before/difference affordances only where evidence exists; otherwise render an explicit unavailable state.
- [ ] Implement Evidence as a searchable list of real `qaEvidence`, including gate version, blocking status, fixtures in `calibratedWith`, measurements, issues, and subject ID.
- [ ] Run the canvas-model test and `npm run build`.
- [ ] Commit: `feat(paper-doll): render locked assemblies and evidence`

## Task 6: Implement Matrix and five-product Lineup

**Files:**

- Create: `src/components/paper-doll/MatrixView.tsx`
- Create: `src/components/paper-doll/LineupView.tsx`
- Create: `src/components/paper-doll/LineupCard.tsx`

- [ ] Render matrix rows from the domain lifecycle model, never from hand-authored completion labels. Include requirement identity, latest component version, material, QA, release, publication, blockers, and next action.
- [ ] Add family/system/role/finish/status filters whose counts remain tied to the unfiltered denominator.
- [ ] Render five explicit approved assembly mappings side by side on one locked baseline and fixed canvas scale, with SKU/mapping IDs and per-card layer identity.
- [ ] Add baseline, centerline, bounds, and geometry-mask overlays across the entire lineup; blocked or missing items must not be substituted.
- [ ] Show the family-level registration verdict and the exact reason when it is not yet a publishable catalog lineup.
- [ ] Run `npm run build` and exercise responsive widths at desktop and tablet breakpoints.
- [ ] Commit: `feat(paper-doll): add lifecycle matrix and lineup`

## Task 7: Implement QA & Publish preview

**Files:**

- Create: `src/components/paper-doll/PublishPreviewView.tsx`
- Create: `src/components/paper-doll/ReleaseGateSummary.tsx`
- Create: `src/components/paper-doll/publishPreviewModel.ts`
- Create: `src/components/paper-doll/publishPreviewModel.test.ts`

- [ ] Write failing tests for gate ordering, blocker preservation, unconfigured target state, zero-write proof, round-trip verdict, and disabled approval/publish controls.
- [ ] Render all nine QA phases from the approved design with passed/blocked/not-yet-run states derived from actual evidence and catalog gaps.
- [ ] Render the Sanity projection target, manifest/payload hashes, document identity, stable array keys, additions/changes/removals summary, asset upload/reuse plan, round-trip result, and `0 writes performed` evidence.
- [ ] Show named approval and live publication as disabled future gates with exact blocker reasons. Do not bind click handlers that mutate data.
- [ ] Run `npx tsx --test src/components/paper-doll/publishPreviewModel.test.ts src/lib/paperDoll/sanityProjection.test.ts` and `npm run build`.
- [ ] Commit: `feat(paper-doll): expose truthful QA publish preview`

## Task 8: Integrate CYL-9ML into the existing Studio

**Files:**

- Modify: `src/pages/BestBottlesStudio.tsx`
- Modify: `src/App.routes.test.ts`

- [ ] Add an integration-level route/source test proving the canonical CYL-9ML slug reaches `ReleaseWorkbench` and non-release groups retain `ComponentsTabPanel` plus the legacy Compose skeleton.
- [ ] For the canonical CYL-9ML group, change Components to `Release Workbench`, render `ReleaseWorkbench`, and remove Compose from the visible tab list. Preserve Masters exactly.
- [ ] Leave every non-release family path unchanged.
- [ ] Confirm the Studio header counter uses the workbench denominator for CYL-9ML and the legacy count elsewhere.
- [ ] Run the focused paper-doll tests, `npm run build`, and the existing Best Bottles test suite affected by Studio routing.
- [ ] Commit: `feat(best-bottles): mount CYL-9ML release workbench`

## Task 9: Browser verification and evidence

**Files:**

- Create: `docs/paper-doll-rig/evidence/CYL-9ML-WORKBENCH-CONTROL-PLANE.md`
- Create: `docs/paper-doll-rig/evidence/cyl-9ml-workbench-assembly.png`
- Create: `docs/paper-doll-rig/evidence/cyl-9ml-workbench-matrix.png`
- Create: `docs/paper-doll-rig/evidence/cyl-9ml-workbench-lineup.png`
- Create: `docs/paper-doll-rig/evidence/cyl-9ml-workbench-publish-preview.png`

- [ ] Start the app with the existing local configuration and open `/best-bottles/studio/cylinder-9ml-frosted-17-415-rollon`.
- [ ] Verify Masters still loads; then verify Assembly, Matrix, Lineup, Evidence, and QA & Publish preview with no console errors or failed asset requests.
- [ ] Capture screenshots at a desktop viewport and check responsive behavior at a tablet viewport.
- [ ] Verify all five body plates and all three approved opaque caps render from the manifest, the translucent cap is visibly blocked, the metal roller defect is called out, and fifteen approved mappings resolve without fallback.
- [ ] Verify the lineup baseline/centerline overlays align across five products and the publish surface reports a blocked release, unconfigured target, and zero writes.
- [ ] Record exact commands, test results, current manifest hash, known blockers, and what remains for Edit Lab/catalog completion/live publication in the evidence document.
- [ ] Run `git status --short`, scan for `TODO|placeholder|mock|coming soon`, and remove any misleading production claim.
- [ ] Commit: `test(paper-doll): verify CYL-9ML workbench control plane`

## Completion Gate

- [ ] The browser renders the actual Release v1 assets and data, not recreated sample cards.
- [ ] The five frozen body plates are reused byte-for-byte.
- [ ] The three opaque caps resolve through explicit mappings and the translucent cap remains blocked.
- [ ] Matrix and header counts include truthful denominators and unresolved catalog gaps.
- [ ] The Lineup shows five manifest-resolved products on one locked baseline.
- [ ] The no-write Sanity projection round-trips and performs zero mutations.
- [ ] Existing Masters and all non-CYL-9ML Studio flows still build and test.
- [ ] No UI control can overwrite an approved asset, write the ledger, grant approval, or publish to Sanity in this slice.
