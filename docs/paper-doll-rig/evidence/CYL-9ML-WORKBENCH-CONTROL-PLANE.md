# CYL-9ML Workbench Control-Plane Evidence

**Verified:** 2026-08-01  
**Route:** `/best-bottles/studio/cylinder-9ml-frosted-17-415-rollon`  
**Release:** `CYL-9ML@1.0.0-draft.1`  
**Manifest SHA-256:** `ae63771148024b24230fd77d7a5518082062a1b717df13f2152ba3ebdbbc4755`

## Result

The signed-in Madison Studio route renders the actual checked-in Release v1 snapshot inside the existing Studio shell. Masters remains available. The release-capable tab is a read-only workbench with Assembly, Matrix, Lineup, Evidence, and QA & Publish views.

The current release is intentionally blocked. The UI reports:

- 8 approved assets of 9 required
- 15 resolved assemblies of 15 declared mappings
- 2 blocking release gates
- 0 published assets of 9
- 0 exact SKU mappings of 29 live catalog products; 15 mappings still use preview identities
- an unconfigured Sanity project, dataset, and document target
- 0 writes performed

No generation provider, Supabase mutation, immutable-ledger write, approval mutation, or Sanity mutation is reachable from this workbench slice.

## Browser verification

The route was exercised in the signed-in Chrome session at `http://localhost:8082`.

- Masters loaded with its existing preset, model, reference, and generation controls.
- All five workbench views rendered from the release manifest.
- Every one of the 15 explicit body/cap mappings was selected in Assembly. Each resolved exactly two 2080 × 2288 image layers with non-zero natural dimensions.
- The five frozen body plates loaded from `assets/paper-doll/body-plates/`.
- `SHN-SL`, `WHT`, and `SHN-BLK` cap layers loaded from the promoted release-component directory.
- The translucent `TRNS-FRS` cap remained blocked and was not offered as an approved assembly.
- Geometry-lock language appeared only for the three opaque caps backed by the shared authoritative mask and passing calibrated evidence (`minIoU: 1`, exact binary silhouette).
- The five-product lineup used explicit mappings at one fixed canvas scale. Baseline and centerline overlays visibly registered across all five products.
- QA & Publish reported the catalog identity and assembly-context gates as blocked, named approval and publication as unavailable, the Sanity target as unconfigured, projection round-trip as PASS, and zero writes.
- At 900 × 1100, the workbench had no horizontal overflow (`document 900/900`, workbench `594/594`, view surface `592/592`). The inventory reflowed above the assembly surface and the assembly heading/select no longer compressed.
- All workbench images inspected in the DOM completed with non-zero 2080 × 2288 natural dimensions. No workbench-origin console errors appeared. Chrome retained one earlier, unrelated Radix `forwardRef` warning originating from `DashboardNew.tsx` before the workbench route was opened.

## Captured views

- `cyl-9ml-workbench-assembly.png`
- `cyl-9ml-workbench-matrix.png`
- `cyl-9ml-workbench-lineup.png`
- `cyl-9ml-workbench-publish-preview.png`

## Verification commands

```sh
npx tsx --test \
  src/App.routes.test.ts \
  scripts/paper-doll/export-workbench-release.test.ts \
  src/lib/paperDoll/workbenchModel.test.ts \
  src/lib/paperDoll/sanityProjection.test.ts \
  src/components/paper-doll/releaseWorkbenchState.test.ts \
  src/components/paper-doll/assemblyCanvasModel.test.ts \
  src/components/paper-doll/matrixModel.test.ts \
  src/components/paper-doll/publishPreviewModel.test.ts

npx tsc -p tsconfig.app.json --noEmit
npm run build
```

Final focused result: 24 tests passed, 0 failed, and the production build completed successfully. The repository-wide TypeScript command remains red on pre-existing Madison type debt across unrelated modules. Filtering that full compiler output to the workbench, release-model, exporter, generated snapshot, and `BestBottlesStudio` integration paths returned no errors after two integration typing fixes in this slice.

## Remaining blockers and next slices

1. Replace the 15 preview mapping identities with exact master-catalog SKU mappings. Until this is complete, the matrix correctly reports 0/29 exact mappings.
2. Run assembly-context QA on translucent plastic and bind passing evidence to a superseding component version before approval.
3. Repair the metal roller source containing 72.8% opaque white junk, produce a superseding version, and verify it before release inclusion.
4. Build and verify the missing fine-mist sprayer and lotion-pump systems. They are catalog inventory, not release assets, in this slice.
5. Add Edit Lab as a candidate-version workflow. Any pixel adjustment must create a versioned candidate and fresh evidence; approved release pixels and coordinates stay immutable.
6. Configure the real Sanity destination and add a server-side dry-run/approval/publication protocol with a named approval bound to the exact manifest, payload, target, and lineup hashes.

This evidence does not claim that CYL-9ML is ready to publish. It proves that the visual control plane faithfully exposes what is ready, what is missing, and why publication remains blocked.
