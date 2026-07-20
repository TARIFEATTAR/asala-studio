# Best Bottles Cylinder Approved Coverage Manifest Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a local, evidence-preserving Cylinder coverage manifest that separates the 232 approved exact-PSD SKU identities from the 145 canonical Cylinder identities that have no approved exact reference.

**Architecture:** A pure TypeScript builder consumes reviewed PSD decisions plus the canonical master and canonical body-geometry CSVs. It collapses archive copies to one website-SKU identity while retaining every source hash and cap-state decision, maps each canonical identity to a body by product-group slug before canonical-axis fallback, and fails closed on missing, ambiguous, or conflicting evidence. A thin CLI writes versioned artifacts only under `tmp/best-bottles-reference-production/`; no existing 75-type manifest, catalog snapshot, PSD, database, or remote system changes.

**Tech Stack:** TypeScript, Node test runner, Node `fs`, canonical CSV inputs, reviewed PSD JSON.

## Global Constraints

- Read `docs/best-bottles-canonical-truth/BEST-BOTTLES-CANONICAL-TRUTH.md` in full before any geometry work.
- Consume only `canon_bodyHeightMm`, `canon_widthAxisMm`, `canon_secondAxisMm`, and `canon_heightWithCapMm` from `best-bottles-master-truth.csv`; never raw measurement columns, Convex `widthMm`, or Convex `depthMm`.
- Geometry identity is the canonical body, not the SKU. Resolve by `productGroupSlug` in `best-bottles-body-geometry.csv` first; use a unique exact match of canonical axes only as fallback.
- Preserve every PSD path, source SHA-256, preview SHA-256, cap-state classification, and reviewer decision. Do not merge, delete, rename, export, upload, generate, or publish source evidence.
- An identity is `reference-ready` only when the reviewed manifest contains at least one `assembled-cap-on` source with `identityStatus: exact-website-sku` and matching website SKU plus Grace SKU.
- Every canonical Cylinder or Tall Cylinder website SKU without such evidence remains `no-approved-exact-reference`; no sibling, catalog image, fuzzy match, generated image, or inferred body may satisfy the gap.
- Write only local files beneath `tmp/best-bottles-reference-production/cylinder-coverage-manifest-v1/`; `externalWriteCount` must equal `0`.
- Do not change `scripts/best-bottles/build-cylinder-75-type-manifest.ts` in this task. Its current raw-catalog measurement path must not be used for this cutover gate.
- Do not stage, commit, push, deploy, or modify any unrelated dirty-worktree file in this task.

---

### Task 1: Pure canonical coverage builder

**Files:**
- Create: `src/lib/bestBottlesCylinderApprovedCoverageManifest.ts`
- Create: `src/lib/bestBottlesCylinderApprovedCoverageManifest.test.ts`

**Interfaces:**
- Consumes: parsed canonical-master rows, parsed body-geometry rows, and reviewed PSD units from `reviewed-manifest.json`.
- Produces: `buildCylinderApprovedCoverageManifest(input): CylinderApprovedCoverageManifest`.

- [ ] **Step 1: Write the failing behavior tests**

```ts
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildCylinderApprovedCoverageManifest } from "./bestBottlesCylinderApprovedCoverageManifest";

const canonical = {
  websiteSku: "GBCyl9SpryBlk",
  graceSku: "GB-CYL-CLR-9ML-SPR-BLK",
  family: "Cylinder",
  productGroupSlug: "cylinder-9ml-clear-17-415-finemist",
  capacityMl: "9",
  canon_bodyHeightMm: "70",
  canon_widthAxisMm: "20",
  canon_secondAxisMm: "20",
  canon_heightWithCapMm: "96",
};

const body = {
  family: "Cylinder",
  capacityMl: "9",
  bodyHeightMm: "70",
  widthAxisMm: "20",
  depthAxisMm: "20",
  productGroupSlugs: "cylinder-9ml-clear-17-415-finemist",
};

describe("approved Cylinder coverage manifest", () => {
  it("retains paired approved PSD sources but emits one ready identity", () => {
    const manifest = buildCylinderApprovedCoverageManifest({
      canonicalRows: [canonical], bodyGeometryRows: [body],
      reviewedUnits: [
        approved("one.psd", "a".repeat(64)),
        approved("two.psd", "b".repeat(64)),
      ],
    });
    assert.equal(manifest.summary.canonicalIdentityCount, 1);
    assert.equal(manifest.summary.referenceReadyCount, 1);
    assert.equal(manifest.rows[0].approvedReferences.length, 2);
    assert.equal(manifest.rows[0].bodyMatch.method, "product-group-slug");
  });

  it("keeps an unreferenced canonical identity blocked without substitution", () => {
    const manifest = buildCylinderApprovedCoverageManifest({
      canonicalRows: [canonical], bodyGeometryRows: [body], reviewedUnits: [],
    });
    assert.equal(manifest.summary.referenceReadyCount, 0);
    assert.deepEqual(manifest.rows[0].blockers, ["no-approved-exact-reference"]);
  });

  it("rejects ambiguous canonical-axis fallback instead of selecting a body", () => {
    const manifest = buildCylinderApprovedCoverageManifest({
      canonicalRows: [{ ...canonical, productGroupSlug: "missing-slug" }],
      bodyGeometryRows: [body, { ...body, productGroupSlugs: "other-slug" }],
      reviewedUnits: [approved("one.psd", "a".repeat(64))],
    });
    assert.ok(manifest.rows[0].blockers.includes("ambiguous-canonical-body-geometry"));
  });
});
```

`approved()` must return a reviewed unit with `reviewStatus: "approved"`, `classification: "assembled-cap-on"`, `identityStatus: "exact-website-sku"`, matching SKU identity, readable composite evidence metadata, and one source path/hash.

- [ ] **Step 2: Run the focused test to confirm RED**

Run: `npx tsx --test src/lib/bestBottlesCylinderApprovedCoverageManifest.test.ts`  
Expected: FAIL because `bestBottlesCylinderApprovedCoverageManifest.ts` does not exist.

- [ ] **Step 3: Implement the fail-closed builder**

Implement these exported contracts:

```ts
export type CanonicalCylinderCoverageRow = {
  websiteSku: string; graceSku: string; family: "Cylinder" | "Tall Cylinder";
  productGroupSlug: string; capacityMl: string;
  canon_bodyHeightMm: string; canon_widthAxisMm: string;
  canon_secondAxisMm: string; canon_heightWithCapMm: string;
};

export type CylinderApprovedCoverageManifest = {
  version: "best-bottles-cylinder-approved-coverage-manifest-v1";
  summary: {
    canonicalIdentityCount: number; referenceReadyCount: number;
    blockedIdentityCount: number; canonicalBodyCount: number;
    coveredBodyCount: number; externalWriteCount: 0;
  };
  rows: CylinderApprovedCoverageRow[];
  bodyCoverage: CylinderBodyCoverage[];
};

export function buildCylinderApprovedCoverageManifest(input: {
  canonicalRows: readonly CanonicalCylinderCoverageRow[];
  bodyGeometryRows: readonly CanonicalBodyGeometryRow[];
  reviewedUnits: readonly PsdReviewedUnit[];
}): CylinderApprovedCoverageManifest;
```

For every canonical identity, retain only canonical dimensions; attach every exact approved source with its source and preview hashes; select the deterministic primary reference by `assembled-cap-on`, then source SHA-256. Map to a body via a matching `productGroupSlug`; otherwise permit a body only when family, capacity, and all three canonical body axes identify exactly one row. Emit `no-approved-exact-reference`, `missing-canon-*`, `missing-canonical-body-geometry`, `ambiguous-canonical-body-geometry`, or `canonical-identity-conflict` as applicable. Never repair a blocker by choosing a sibling.

- [ ] **Step 4: Run focused tests to confirm GREEN**

Run: `npx tsx --test src/lib/bestBottlesCylinderApprovedCoverageManifest.test.ts`  
Expected: all three tests pass and no test writes outside its operating-system temporary directory.

---

### Task 2: Local CLI, provenance artifact, and regression coverage

**Files:**
- Create: `scripts/best-bottles/build-cylinder-approved-coverage-manifest.ts`
- Create: `scripts/best-bottles/build-cylinder-approved-coverage-manifest.test.ts`
- Modify: `package.json`
- Generate locally (ignored): `tmp/best-bottles-reference-production/cylinder-coverage-manifest-v1/cylinder-approved-coverage-manifest.json`
- Generate locally (ignored): `tmp/best-bottles-reference-production/cylinder-coverage-manifest-v1/cylinder-approved-coverage-summary.json`

**Interfaces:**
- Consumes: canonical master CSV, body geometry CSV, `tmp/best-bottles-reference-production/psd-cap-state-audit-v1/reviewed-manifest.json`.
- Produces: two hash-stamped local JSON artifacts and a stdout summary.

- [ ] **Step 1: Write the failing CLI test**

```ts
it("writes only versioned local coverage artifacts and reports the canonical gap", async () => {
  const result = await buildCylinderApprovedCoverageArtifacts({
    canonicalMasterPath, bodyGeometryPath, reviewedManifestPath, outputRoot,
  });
  assert.equal(result.summary.externalWriteCount, 0);
  assert.equal(result.summary.canonicalIdentityCount, 2);
  assert.equal(result.summary.referenceReadyCount, 1);
  assert.equal(result.summary.blockedIdentityCount, 1);
  assert.ok(await exists(join(outputRoot, "cylinder-approved-coverage-manifest.json")));
  assert.ok(await exists(join(outputRoot, "cylinder-approved-coverage-summary.json")));
});
```

- [ ] **Step 2: Run the focused CLI test to confirm RED**

Run: `npx tsx --test scripts/best-bottles/build-cylinder-approved-coverage-manifest.test.ts`  
Expected: FAIL because the CLI module does not exist.

- [ ] **Step 3: Implement robust parsing and local-only writes**

Export `buildCylinderApprovedCoverageArtifacts(input)`. Parse quoted CSV cells without relying on comma-splitting. Hash the three complete input files with SHA-256 and include their absolute paths plus hashes in both artifacts. Default paths must be:

```text
docs/best-bottles-canonical-truth/best-bottles-master-truth.csv
docs/best-bottles-canonical-truth/best-bottles-body-geometry.csv
tmp/best-bottles-reference-production/psd-cap-state-audit-v1/reviewed-manifest.json
tmp/best-bottles-reference-production/cylinder-coverage-manifest-v1/
```

Add this package command:

```json
"bestbottles:cylinder:build-approved-coverage": "tsx scripts/best-bottles/build-cylinder-approved-coverage-manifest.ts"
```

The CLI must reject a reviewed source whose `identityStatus` is not `exact-website-sku`, reject a source whose identity conflicts with the selected canonical identity, and never change the source review artifacts.

- [ ] **Step 4: Run the local build and verify its evidence invariants**

Run:

```bash
npm run bestbottles:cylinder:build-approved-coverage
npx tsx --test src/lib/bestBottlesCylinderApprovedCoverageManifest.test.ts scripts/best-bottles/build-cylinder-approved-coverage-manifest.test.ts
shasum -a 256 tmp/best-bottles-reference-production/psd-cap-state-audit-v1/reviewed-manifest.json
```

Expected: `canonicalIdentityCount: 377`; `referenceReadyCount` equals the approved exact-identity count only when all canonical geometry conditions pass; every uncovered identity has an explicit blocker; source-manifest checksum before and after the build is identical; `externalWriteCount: 0`.

- [ ] **Step 5: Review scope before any commit**

Run: `git status --short`. Confirm that only the four new source/test/package files and ignored `tmp` artifacts are attributable to this task. Do not stage or commit while the pre-existing dirty worktree remains under user ownership.

## Plan Self-Review

- Canonical measurement requirements are covered by Tasks 1–2; raw catalog, Convex width, and Convex depth are excluded explicitly.
- Exact PSD source evidence, duplicate preservation, no-substitution behavior, and local-only outputs are covered by the builder tests and CLI test.
- The 377-identity canonical Cylinder/Tall Cylinder scope and 145 uncovered identities are reported as a gate, not transformed into generation eligibility.
- The existing 75-type builder remains untouched until this manifest proves its canonical body mapping and coverage boundaries.
