# Best Bottles Cylinder Reference Production Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert all 232 qualified, human-approved Cylinder Photoshop composites into immutable native-resolution opaque PNG references while preserving a complete, explicit worklist for the 145 canonical identities that still lack exact approved source evidence.

**Architecture:** A pure planner consumes the existing canonical Cylinder coverage manifest and reviewed PSD evidence, fails closed on any identity, review, geometry, cap-state, opacity, or hash inconsistency, and emits one deterministic export job per qualified identity plus a disjoint blocker lane for every gap. A local-only CLI performs a complete source-hash preflight, exports Photoshop scene zero without resizing or AI reconstruction, validates PNG format/dimensions/opacity, records exact output hashes and primary bounds, and writes immutable versioned artifacts beneath `tmp/best-bottles-reference-production/`. Upload, database promotion, generation, and publishing remain separate later gates.

**Tech Stack:** TypeScript, Node test runner, Node `fs`/`crypto`/`child_process`, ImageMagick 7, existing canonical coverage JSON, existing reviewed PSD JSON.

## Global Constraints

- Read `docs/best-bottles-canonical-truth/BEST-BOTTLES-CANONICAL-TRUTH.md` in full before measurement or geometry work.
- Consume only canonical dimensions already carried by the coverage manifest: `canon_bodyHeightMm`, `canon_widthAxisMm`, `canon_secondAxisMm`, and `canon_heightWithCapMm` plus the matched canonical body row.
- Source identity is exact Website SKU plus exact Grace SKU. Never borrow a sibling, deduplicate across identities, infer a missing source, or substitute a generated/catalog image.
- A production export requires an approved `assembled-cap-on` reviewed source, exact identity status, usable composite evidence, an unambiguous canonical body, an opaque Photoshop composite, and an unchanged source SHA-256.
- Read Photoshop sources only. Never rename, move, modify, flatten in place, resave, or update source timestamps.
- Export Photoshop scene zero at native pixel dimensions. Do not crop, resize, reconstruct, remove the source background, or use AI.
- Write only immutable local artifacts beneath `tmp/best-bottles-reference-production/cylinder-native-opaque-exports-v2/`. Preserve the earlier 161-item v1 evidence snapshot. Existing different bytes at a target path are a hard error; matching bytes are reusable.
- Keep every blocked canonical identity visible. Required disjoint lanes are `canonical-geometry`, `source-evidence`, `source-and-geometry`, and `other`.
- `externalWriteCount` must remain `0`. Do not upload, promote to `flattened-product-truth`, write Convex/Supabase/Shopify/Sanity, generate product imagery, stage, commit, push, or deploy.
- Preserve every unrelated dirty-worktree change.

---

### Task 1: Pure production-plan builder

**Files:**
- Create: `src/lib/bestBottlesCylinderReferenceProduction.ts`
- Create: `src/lib/bestBottlesCylinderReferenceProduction.test.ts`

**Interfaces:**
- Consumes: `CylinderApprovedCoverageManifest` and reviewed `PsdReviewedUnit[]`.
- Produces: `buildCylinderReferenceProductionPlan(input): CylinderReferenceProductionPlan`.

- [ ] **Step 1: Write failing tests for the qualification and blocker contract**

Cover these behaviors with fixture builders: one exact approved opaque assembled source becomes one deterministic export job; an exact source with ambiguous body geometry goes only to `canonical-geometry`; a missing source goes only to `source-evidence`; both blockers go to `source-and-geometry`; transparent, detached, non-exact, identity-conflicting, or missing reviewed evidence is rejected; every canonical row appears exactly once across jobs and blockers.

- [ ] **Step 2: Run the focused test and confirm RED**

Run: `npx tsx --test src/lib/bestBottlesCylinderReferenceProduction.test.ts`  
Expected: FAIL because `bestBottlesCylinderReferenceProduction.ts` does not exist.

- [ ] **Step 3: Implement the minimal fail-closed planner**

Export these stable interfaces:

```ts
export type CylinderReferenceProductionPlan = {
  version: "best-bottles-cylinder-reference-production-plan-v1";
  summary: {
    canonicalIdentityCount: number;
    exportQualifiedCount: number;
    blockedIdentityCount: number;
    canonicalGeometryBlockedCount: number;
    sourceEvidenceBlockedCount: number;
    sourceAndGeometryBlockedCount: number;
    otherBlockedCount: number;
    uniqueSourceCount: number;
    externalWriteCount: 0;
  };
  exportJobs: CylinderReferenceExportJob[];
  blockedIdentities: CylinderReferenceBlockedIdentity[];
};

export function buildCylinderReferenceProductionPlan(input: {
  coverageManifest: CylinderApprovedCoverageManifest;
  reviewedUnits: readonly PsdReviewedUnit[];
}): CylinderReferenceProductionPlan;
```

The planner must join the primary reference back to the reviewed source by exact absolute path plus source SHA-256, verify the paired SKU identity and review record, retain source/composite/reviewer metadata, copy only canonical measurement fields, and build a filename from normalized Website SKU, normalized Grace SKU, and the first 12 source-hash characters. It must reject duplicate output filenames or a source record assigned to different identities.

- [ ] **Step 4: Run focused tests and confirm GREEN**

Run: `npx tsx --test src/lib/bestBottlesCylinderReferenceProduction.test.ts`  
Expected: all planner tests pass with `externalWriteCount: 0`.

---

### Task 2: Immutable native-resolution exporter and artifact writer

**Files:**
- Create: `scripts/best-bottles/build-cylinder-reference-production.ts`
- Create: `scripts/best-bottles/build-cylinder-reference-production.test.ts`

**Interfaces:**
- Consumes: the existing coverage artifact, reviewed PSD manifest, and source Photoshop files.
- Produces: `buildCylinderReferenceProductionArtifacts(input): Promise<CylinderReferenceProductionArtifactsResult>`.

- [ ] **Step 1: Write a failing integration test using a real temporary PSD**

Create a 100×130 opaque PSD fixture with ImageMagick, hash it, construct matching coverage/review fixtures, and assert that the exporter writes exactly one 100×130 opaque PNG plus the production manifest, summary, and blocker report. Assert the PSD hash and bytes are unchanged, a second identical run reuses the output, and a pre-existing different target file is rejected.

- [ ] **Step 2: Run the exporter test and confirm RED**

Run: `npx tsx --test scripts/best-bottles/build-cylinder-reference-production.test.ts`  
Expected: FAIL because `build-cylinder-reference-production.ts` does not exist.

- [ ] **Step 3: Implement preflight, export, validation, and immutable writes**

For every export job, compute the source SHA-256 before rendering and compare it with the reviewed hash; run ImageMagick on `<source>[0]` with no resize/crop; write to a temporary path; identify format, width, height, opacity, and colorspace; calculate primary foreground bounds against the preserved background; hash the PNG; recheck the source hash/stat; then atomically rename. If the final path already exists, reuse only when its SHA-256 and inspected metadata match the expected manifest record. Write JSON artifacts with absolute input paths and SHA-256 provenance using the same immutable-write rule.

The default output tree is:

```text
tmp/best-bottles-reference-production/cylinder-native-opaque-exports-v2/
  exports/<deterministic-name>.png
  cylinder-reference-production-manifest.json
  cylinder-reference-production-summary.json
  cylinder-reference-blocker-report.json
```

- [ ] **Step 4: Run focused exporter and planner tests**

Run: `npx tsx --test src/lib/bestBottlesCylinderReferenceProduction.test.ts scripts/best-bottles/build-cylinder-reference-production.test.ts`  
Expected: all tests pass; source bytes remain unchanged; no file is written outside the temporary test output root.

---

### Task 3: Execute the 232-item local production pass and audit invariants

**Files:**
- Generate locally: `tmp/best-bottles-reference-production/cylinder-native-opaque-exports-v2/exports/*.png`
- Generate locally: `tmp/best-bottles-reference-production/cylinder-native-opaque-exports-v2/cylinder-reference-production-manifest.json`
- Generate locally: `tmp/best-bottles-reference-production/cylinder-native-opaque-exports-v2/cylinder-reference-production-summary.json`
- Generate locally: `tmp/best-bottles-reference-production/cylinder-native-opaque-exports-v2/cylinder-reference-blocker-report.json`

**Interfaces:**
- Consumes: the tested planner/exporter and the saved canonical/review evidence.
- Produces: reviewed local reference candidates and a separate blocker remediation queue; no remote state.

- [ ] **Step 1: Record immutable input hashes and run the exporter**

Run:

```bash
shasum -a 256 tmp/best-bottles-reference-production/psd-cap-state-audit-v1/reviewed-manifest.json \
  tmp/best-bottles-reference-production/cylinder-coverage-manifest-v2/cylinder-approved-coverage-manifest.json
npx tsx scripts/best-bottles/build-cylinder-reference-production.ts
```

Expected summary after canonical-axis disambiguation: `canonicalIdentityCount: 377`, `exportQualifiedCount: 232`, `blockedIdentityCount: 145`, `uniqueSourceCount: 232`, `externalWriteCount: 0`.

- [ ] **Step 2: Verify exported-file and blocker invariants**

Assert there are exactly 232 PNGs; every file is PNG, opaque, native-dimension matched, hash-recorded, and traceable to one exact Website/Grace identity; there are no unrecorded PNGs. Assert blocker lanes total 145 and are disjoint. Expected breakdown after the canonical-axis tie-breaker is 139 `source-evidence`, 6 `source-and-geometry`, and 0 in the other lanes. The six remaining geometry discrepancies are explicit `54.2` versus body-row `54` and `18.4` versus body-row `18` cases and must not be rounded silently.

- [ ] **Step 3: Recheck source evidence and focused regressions**

Re-run the two input SHA-256 commands and confirm they match Step 1. Run:

```bash
npx tsx --test \
  src/lib/bestBottlesCylinderApprovedCoverageManifest.test.ts \
  scripts/best-bottles/build-cylinder-approved-coverage-manifest.test.ts \
  src/lib/bestBottlesCylinderReferenceProduction.test.ts \
  scripts/best-bottles/build-cylinder-reference-production.test.ts
```

Expected: all focused tests pass and the PSD/review/coverage inputs are unchanged.

- [ ] **Step 4: Stop at the local review gate**

Report which 232 references are ready for visual/technical review and list all 145 blocked identities. Do not upload or promote. The next authorized phase is review of these opaque PNGs and their manifest; only approved rows may later enter a separate no-overwrite upload/promotion plan.

## Plan Self-Review

- Canonical-only measurement and body-keyed geometry constraints are carried through the existing coverage rows and revalidated before export.
- Exact paired SKU identity, human approval, cap state, topology, opacity, source hashes, native dimensions, output hashes, primary bounds, and provenance all have explicit planner/exporter gates.
- The 232 ready and 145 blocked configurations remain disjoint and exhaustive; no blocker is repaired by substitution. The additional 71 are unlocked only by exact `canon_*` axes selecting one of multiple slug-matched canonical body rows.
- PSD sources and existing evidence artifacts remain read-only; local exports are versioned and immutable.
- Remote upload, `flattened-product-truth` promotion, AI generation, batch generation, UI work, and publishing are outside this plan.
