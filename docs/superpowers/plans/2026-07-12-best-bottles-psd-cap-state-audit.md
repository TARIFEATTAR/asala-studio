# Best Bottles PSD Cap-State Audit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and run a read-only, resumable audit of all 4,493 original Best Bottles PSDs that exact-matches sources to canonical SKUs, renders review evidence, groups true duplicates, and produces human-reviewable cap-state/topology manifests without exporting or promoting a generation reference.

**Architecture:** Pure TypeScript modules own taxonomy, identity matching, review-unit grouping, and decision validation. Node CLI scripts hash and inspect the immutable PSD archive through ImageMagick, cache one rendered composite per source hash, and generate family/cohort review sheets plus machine-readable worklists. Machine triage may route files but cannot approve cap state; only a validated human decision can move a review unit out of `ambiguous-manual-review`.

**Tech Stack:** TypeScript, Node 20/22, `tsx --test`, Sharp 0.35, ImageMagick `magick`, canonical Best Bottles CSV/JSON snapshots, SHA-256, JSON/CSV/PNG artifacts.

## Global Constraints

- Before implementing anything measurement- or geometry-related, read `docs/best-bottles-canonical-truth/BEST-BOTTLES-CANONICAL-TRUTH.md` in full.
- Read-only PSD root: `/Users/jordanrichter/Projects/Clients/Nemat-International/Best-Bottles-Original-Photoshop-Sources`.
- Canonical product truth: `docs/best-bottles-canonical-truth/best-bottles-master-truth.csv` with 2,483 rows.
- Geometry consumers use only `canon_*` values and `docs/best-bottles-canonical-truth/best-bottles-body-geometry.csv`.
- Never use raw flat-family `diameter` or copied Convex `widthMm`/`depthMm` as truth.
- Exact normalized website SKU is the first identity key; exact Grace SKU is second; aliases must be explicit.
- A filename or folder label is a triage hint, not a cap-state approval.
- No PSD may be modified, renamed, relocated, flattened in place, or assigned a new timestamp.
- No AI reconstruction, generated stand-in, sibling SKU, fuzzy filename match, or silent substitution.
- No reference export, Supabase upload, pipeline pointer change, Convex write, Shopify write, generation request, or publication in this plan.
- Audit outputs live under `tmp/best-bottles-reference-production/psd-cap-state-audit-v1/`; code and tests are committed, rendered evidence is not.
- Machine review status is always `pending-human-review`; a non-human decision cannot set `approved`.
- Exact duplicate bytes may share one rendered composite, but review decisions propagate only across the same source hash and the same canonical SKU identity.

---

## File Structure

- `src/lib/bestBottlesPsdCapStateAudit.ts` — taxonomy, audit records, duplicate/review-unit keys, and validation primitives.
- `src/lib/bestBottlesPsdCapStateAudit.test.ts` — taxonomy and fail-closed unit tests.
- `src/lib/bestBottlesPsdIdentityJoin.ts` — exact PSD-to-canonical identity matching and alias handling.
- `src/lib/bestBottlesPsdIdentityJoin.test.ts` — precedence, ambiguity, and no-fuzzy-match tests.
- `scripts/best-bottles/psd-cap-state-evidence.ts` — immutable hashing, ImageMagick metadata extraction, composite rendering, pixel evidence, cache, and bounded concurrency.
- `scripts/best-bottles/psd-cap-state-evidence.test.ts` — injected-runner evidence and resume tests.
- `scripts/best-bottles/build-psd-cap-state-audit.ts` — archive traversal, canonical join, review-unit construction, CSV/JSON output, and summary.
- `scripts/best-bottles/build-psd-cap-state-audit.test.ts` — fixture end-to-end audit tests.
- `scripts/best-bottles/render-psd-cap-state-review.ts` — family/cohort contact sheets and HTML review index.
- `scripts/best-bottles/render-psd-cap-state-review.test.ts` — deterministic batching and sheet-plan tests.
- `src/lib/bestBottlesPsdReviewDecisions.ts` — human decision schema, CSV parsing, and approval guards.
- `src/lib/bestBottlesPsdReviewDecisions.test.ts` — decision validation and propagation tests.
- `scripts/best-bottles/apply-psd-cap-state-review.ts` — local-only decision merge and reviewed/blocker manifests.
- `scripts/best-bottles/apply-psd-cap-state-review.test.ts` — local merge tests.
- `package.json` — audit, sheet, decision, and focused-test commands.
- `docs/best-bottles-psd-cap-state-audit.md` — generated run summary and interpretation after the full audit.

---

### Task 1: Cap-State Domain Model and Review Units

**Files:**
- Create: `src/lib/bestBottlesPsdCapStateAudit.ts`
- Create: `src/lib/bestBottlesPsdCapStateAudit.test.ts`

**Interfaces:**
- Consumes: raw PSD source identity, SHA-256, and canonical SKU identity.
- Produces: `PsdCapStateClassification`, `PsdAuditRecord`, `PsdReviewUnit`, `buildPsdReviewUnitKey()`, `groupPsdAuditRecords()`, and `assertMachineCannotApprove()`.

- [ ] **Step 1: Write failing taxonomy and grouping tests**

```ts
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  PSD_CAP_STATE_CLASSIFICATIONS,
  assertMachineCannotApprove,
  buildPsdReviewUnitKey,
  groupPsdAuditRecords,
  type PsdAuditRecord,
} from "./bestBottlesPsdCapStateAudit";

const base: PsdAuditRecord = {
  sourcePath: "/archive/A.psd",
  sourceRelativePath: "Cylinder/A.psd",
  sourceSha256: "a".repeat(64),
  sourceBytes: 100,
  websiteSku: "WebA",
  graceSku: "GB-A",
  family: "Cylinder",
  identityStatus: "exact-website-sku",
  identityReasons: [],
  composite: null,
  machineTriage: {
    proposedClassification: "ambiguous-manual-review",
    confidence: "low",
    reasons: ["visual_review_required"],
  },
  reviewStatus: "pending-human-review",
};

describe("Best Bottles PSD cap-state audit domain", () => {
  it("uses the complete evidence-preserving taxonomy", () => {
    assert.deepEqual(PSD_CAP_STATE_CLASSIFICATIONS, [
      "assembled-cap-on",
      "cap-off-applicator-exposed",
      "detached-cap-or-sidecar",
      "component-only",
      "multi-product-layout",
      "ambiguous-manual-review",
      "blocked-identity-conflict",
    ]);
  });

  it("keeps duplicate pixels separate across canonical identities", () => {
    const groups = groupPsdAuditRecords([
      base,
      { ...base, sourcePath: "/archive/A copy.psd" },
      { ...base, sourcePath: "/archive/B.psd", websiteSku: "WebB", graceSku: "GB-B" },
    ]);
    assert.equal(groups.length, 2);
    assert.equal(groups.find((group) => group.websiteSku === "WebA")?.sources.length, 2);
  });

  it("builds a stable hash plus identity review key", () => {
    assert.equal(
      buildPsdReviewUnitKey(base),
      `${"a".repeat(64)}|WEBA|GBA`,
    );
  });

  it("rejects a machine-authored approval", () => {
    assert.throws(() => assertMachineCannotApprove({
      reviewStatus: "approved",
      reviewer: "machine",
    }), /human reviewer/i);
  });
});
```

- [ ] **Step 2: Run the test and confirm RED**

Run: `npx tsx --test src/lib/bestBottlesPsdCapStateAudit.test.ts`  
Expected: FAIL because `bestBottlesPsdCapStateAudit.ts` does not exist.

- [ ] **Step 3: Implement the domain model**

```ts
export const PSD_CAP_STATE_CLASSIFICATIONS = [
  "assembled-cap-on",
  "cap-off-applicator-exposed",
  "detached-cap-or-sidecar",
  "component-only",
  "multi-product-layout",
  "ambiguous-manual-review",
  "blocked-identity-conflict",
] as const;

export type PsdCapStateClassification =
  (typeof PSD_CAP_STATE_CLASSIFICATIONS)[number];
export type PsdIdentityStatus =
  | "exact-website-sku"
  | "exact-grace-sku"
  | "reviewed-alias"
  | "unmatched"
  | "ambiguous"
  | "conflict";

export interface PsdCompositeEvidence {
  width: number;
  height: number;
  opaque: boolean;
  sceneCount: number;
  foregroundBounds: { left: number; top: number; width: number; height: number } | null;
  largeForegroundComponentCount: number;
  whiteCornerCount: number;
  minimumSafeMarginPct: number | null;
  previewPath: string;
  evidenceSha256: string;
}

export interface PsdAuditRecord {
  sourcePath: string;
  sourceRelativePath: string;
  sourceSha256: string;
  sourceBytes: number;
  websiteSku: string | null;
  graceSku: string | null;
  family: string | null;
  identityStatus: PsdIdentityStatus;
  identityReasons: string[];
  composite: PsdCompositeEvidence | null;
  machineTriage: {
    proposedClassification: PsdCapStateClassification;
    confidence: "low" | "medium" | "high";
    reasons: string[];
  };
  reviewStatus: "pending-human-review" | "approved" | "blocked";
}

export interface PsdReviewUnit {
  reviewUnitKey: string;
  sourceSha256: string;
  websiteSku: string | null;
  graceSku: string | null;
  family: string | null;
  sources: PsdAuditRecord[];
  representative: PsdAuditRecord;
}

function identityToken(value: string | null): string {
  return String(value ?? "UNMATCHED").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function buildPsdReviewUnitKey(record: PsdAuditRecord): string {
  return [record.sourceSha256, identityToken(record.websiteSku), identityToken(record.graceSku)].join("|");
}

export function groupPsdAuditRecords(records: readonly PsdAuditRecord[]): PsdReviewUnit[] {
  const groups = new Map<string, PsdAuditRecord[]>();
  for (const record of records) {
    const key = buildPsdReviewUnitKey(record);
    groups.set(key, [...(groups.get(key) ?? []), record]);
  }
  return [...groups.entries()].map(([reviewUnitKey, sources]) => ({
    reviewUnitKey,
    sourceSha256: sources[0].sourceSha256,
    websiteSku: sources[0].websiteSku,
    graceSku: sources[0].graceSku,
    family: sources[0].family,
    sources,
    representative: [...sources].sort((a, b) =>
      a.sourceRelativePath.localeCompare(b.sourceRelativePath)
    )[0],
  })).sort((a, b) => a.reviewUnitKey.localeCompare(b.reviewUnitKey));
}

export function assertMachineCannotApprove(input: {
  reviewStatus: PsdAuditRecord["reviewStatus"];
  reviewer: string;
}): void {
  if (input.reviewStatus === "approved" && input.reviewer.trim().toLowerCase() === "machine") {
    throw new Error("Cap-state approval requires a named human reviewer.");
  }
}
```

- [ ] **Step 4: Run the test and confirm GREEN**

Run: `npx tsx --test src/lib/bestBottlesPsdCapStateAudit.test.ts`  
Expected: 4 passing tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/bestBottlesPsdCapStateAudit.ts src/lib/bestBottlesPsdCapStateAudit.test.ts
git commit -m "feat(best-bottles): model PSD cap-state audit"
```

### Task 2: Exact PSD-to-Canonical Identity Join

**Files:**
- Create: `src/lib/bestBottlesPsdIdentityJoin.ts`
- Create: `src/lib/bestBottlesPsdIdentityJoin.test.ts`

**Interfaces:**
- Consumes: conservative PSD filename records, canonical master truth rows, and explicit aliases.
- Produces: `joinPsdSourceIdentity(input): PsdIdentityJoinResult` and `buildCanonicalIdentityIndex(rows)`.

- [ ] **Step 1: Write failing precedence and ambiguity tests**

```ts
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildCanonicalIdentityIndex, joinPsdSourceIdentity } from "./bestBottlesPsdIdentityJoin";

const rows = [
  { website_sku: "WebA", grace_sku: "GB-A", family: "Cylinder" },
  { website_sku: "WebB", grace_sku: "GB-B", family: "Circle" },
];

describe("PSD canonical identity join", () => {
  it("prefers exact website SKU over Grace SKU", () => {
    const index = buildCanonicalIdentityIndex(rows);
    const result = joinPsdSourceIdentity({ websiteSku: "WebA", graceSku: "GB-B", index, aliases: [] });
    assert.equal(result.status, "exact-website-sku");
    assert.equal(result.row?.grace_sku, "GB-A");
  });

  it("uses exact Grace SKU only when website SKU is absent", () => {
    const index = buildCanonicalIdentityIndex(rows);
    const result = joinPsdSourceIdentity({ websiteSku: null, graceSku: "gb-b", index, aliases: [] });
    assert.equal(result.status, "exact-grace-sku");
  });

  it("does not use substring or fuzzy identity", () => {
    const index = buildCanonicalIdentityIndex(rows);
    const result = joinPsdSourceIdentity({ websiteSku: "Web", graceSku: null, index, aliases: [] });
    assert.equal(result.status, "unmatched");
  });

  it("fails closed when an exact key maps to conflicting canonical rows", () => {
    const index = buildCanonicalIdentityIndex([...rows, { website_sku: "WebA", grace_sku: "GB-X", family: "Diva" }]);
    const result = joinPsdSourceIdentity({ websiteSku: "WebA", graceSku: null, index, aliases: [] });
    assert.equal(result.status, "ambiguous");
    assert.match(result.reasons.join(" "), /duplicate website sku/i);
  });
});
```

- [ ] **Step 2: Run the test and confirm RED**

Run: `npx tsx --test src/lib/bestBottlesPsdIdentityJoin.test.ts`  
Expected: FAIL because the identity module does not exist.

- [ ] **Step 3: Implement exact indexes and joins**

Implement normalized exact keys using `String(value).trim().toUpperCase().replace(/[^A-Z0-9]/g, "")`. Build `Map<string, CanonicalTruthRow[]>` indexes for website and Grace SKUs. Return `ambiguous` whenever an exact key has multiple non-equivalent canonical rows; never choose the first row. Apply an alias only when its `sourceToken`, `websiteSku`, `graceSku`, `reviewedBy`, and `reviewedAt` are all populated.

```ts
export interface CanonicalTruthRow {
  website_sku: string;
  grace_sku: string;
  family: string;
  [key: string]: string;
}

export interface ReviewedPsdAlias {
  sourceToken: string;
  websiteSku: string;
  graceSku: string;
  reviewedBy: string;
  reviewedAt: string;
}

export interface CanonicalIdentityIndex {
  byWebsiteSku: Map<string, CanonicalTruthRow[]>;
  byGraceSku: Map<string, CanonicalTruthRow[]>;
}

export function joinPsdSourceIdentity(input: {
  websiteSku: string | null;
  graceSku: string | null;
  sourceToken?: string | null;
  index: CanonicalIdentityIndex;
  aliases: readonly ReviewedPsdAlias[];
}): { status: import("./bestBottlesPsdCapStateAudit").PsdIdentityStatus; row: CanonicalTruthRow | null; reasons: string[] };
```

- [ ] **Step 4: Run the test and confirm GREEN**

Run: `npx tsx --test src/lib/bestBottlesPsdIdentityJoin.test.ts`  
Expected: 4 passing tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/bestBottlesPsdIdentityJoin.ts src/lib/bestBottlesPsdIdentityJoin.test.ts
git commit -m "feat(best-bottles): join PSDs to canonical identity"
```

### Task 3: Immutable PSD Evidence Extraction and Resume Cache

**Files:**
- Create: `scripts/best-bottles/psd-cap-state-evidence.ts`
- Create: `scripts/best-bottles/psd-cap-state-evidence.test.ts`

**Interfaces:**
- Consumes: an absolute PSD path inside the authoritative archive and an output root.
- Produces: `inspectPsdEvidence(input): Promise<PsdSourceEvidence>`, `runEvidencePool(input)`, one hash-keyed preview PNG, and one hash-keyed evidence JSON.

- [ ] **Step 1: Write failing evidence and cache tests**

Use injected `readSource`, `runMagick`, and `writeArtifact` functions so tests never require Photoshop files or alter disk.

```ts
it("hashes source bytes and renders scene zero without modifying the source", async () => {
  const writes: string[] = [];
  const result = await inspectPsdEvidence({
    sourcePath: "/archive/WebA.psd",
    sourceRelativePath: "Cylinder/WebA.psd",
    outputRoot: "/audit",
    readSource: async () => Buffer.from("immutable-psd"),
    statSource: async () => ({ size: 13, mtimeMs: 1000 }),
    runMagick: async (args) => {
      assert.equal(args[0], "/archive/WebA.psd[0]");
      return args.includes("json:-")
        ? Buffer.from(JSON.stringify({ width: 1000, height: 1600, opaque: true, sceneCount: 4 }))
        : Buffer.from("preview-png");
    },
    writeArtifact: async (target) => { writes.push(target); },
    readCachedEvidence: async () => null,
  });
  assert.match(result.sourceSha256, /^[a-f0-9]{64}$/);
  assert.equal(result.sourceMtimeBefore, result.sourceMtimeAfter);
  assert.equal(writes.length, 2);
});

it("reuses evidence only when hash and extractor version match", async () => {
  let magickCalls = 0;
  const cached = await inspectPsdEvidence({
    sourcePath: "/archive/WebA.psd",
    sourceRelativePath: "Cylinder/WebA.psd",
    outputRoot: "/audit",
    readSource: async () => Buffer.from("immutable-psd"),
    statSource: async () => ({ size: 13, mtimeMs: 1000 }),
    runMagick: async () => { magickCalls += 1; return Buffer.alloc(0); },
    writeArtifact: async () => undefined,
    readCachedEvidence: async () => ({
      extractorVersion: PSD_EVIDENCE_EXTRACTOR_VERSION,
      sourceSha256: createHash("sha256").update("immutable-psd").digest("hex"),
    } as PsdSourceEvidence),
  });
  assert.equal(magickCalls, 0);
  assert.equal(cached.cacheStatus, "reused");
});
```

- [ ] **Step 2: Run the test and confirm RED**

Run: `npx tsx --test scripts/best-bottles/psd-cap-state-evidence.test.ts`  
Expected: FAIL because the evidence module does not exist.

- [ ] **Step 3: Implement immutable evidence extraction**

Use `readFile` and `stat` before and after inspection. Reject any size or `mtimeMs` change. Hash original PSD bytes before invoking ImageMagick. Render only scene zero with:

```ts
[
  `${sourcePath}[0]`,
  "-background", "white",
  "-alpha", "remove",
  "-alpha", "off",
  "-colorspace", "sRGB",
  "-resize", "900x1200>",
  "png:-",
]
```

Read scene metadata with `magick identify -format` and analyze the preview through Sharp raw pixels. Compute foreground pixels as those differing from white by more than 6% in any RGB channel. Record foreground bounds, four white-corner samples, minimum margin, and connected components larger than 0.5% of the preview canvas. Keep the proposed cap state `ambiguous-manual-review`; only attach routing hints such as `folder_hint:capped`, `folder_hint:uncapped`, `multiple_large_components`, or `component_path_hint`.

Key artifacts:

```text
{outputRoot}/evidence/{sourceSha256}.json
{outputRoot}/previews/{sourceSha256}.png
```

Use `PSD_EVIDENCE_EXTRACTOR_VERSION = "best-bottles-psd-evidence-v1"`. Limit the default pool to four concurrent ImageMagick processes. Catch row failures into evidence records with `status: "blocked"` and an exact error; do not abort unrelated rows.

- [ ] **Step 4: Run the test and confirm GREEN**

Run: `npx tsx --test scripts/best-bottles/psd-cap-state-evidence.test.ts`  
Expected: all evidence and resume tests pass.

- [ ] **Step 5: Commit**

```bash
git add scripts/best-bottles/psd-cap-state-evidence.ts scripts/best-bottles/psd-cap-state-evidence.test.ts
git commit -m "feat(best-bottles): extract immutable PSD evidence"
```

### Task 4: Archive-Wide Audit Builder

**Files:**
- Create: `scripts/best-bottles/build-psd-cap-state-audit.ts`
- Create: `scripts/best-bottles/build-psd-cap-state-audit.test.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes: PSD archive root, canonical master truth CSV, optional reviewed alias JSON, and Task 3 evidence extraction.
- Produces: `buildPsdCapStateAudit(input): Promise<PsdCapStateAuditResult>` and complete local audit artifacts.

- [ ] **Step 1: Write failing fixture audit tests**

The fixture must contain an exact website match, exact Grace-only match, duplicate bytes for the same identity, the same bytes under a different identity, an unmatched PSD, and an ambiguous canonical key.

```ts
it("accounts for every source while deduplicating review work only within identity", async () => {
  const result = await buildPsdCapStateAudit({
    sourceFiles: fixtures.sources,
    canonicalRows: fixtures.canonicalRows,
    aliases: [],
    inspectEvidence: fixtures.inspectEvidence,
    outputRoot: "/audit",
    writeOutputs: false,
  });
  assert.equal(result.summary.sourceFileCount, 6);
  assert.equal(result.summary.accountedSourceCount, 6);
  assert.equal(result.summary.unmatchedCount, 1);
  assert.equal(result.summary.ambiguousIdentityCount, 1);
  assert.equal(result.reviewUnits.length, 5);
  assert.ok(result.records.every((row) => row.reviewStatus === "pending-human-review"));
});

it("never changes a machine-triaged row to approved", async () => {
  const result = await buildPsdCapStateAudit({ ...fixtures.input, writeOutputs: false });
  assert.equal(result.summary.approvedCount, 0);
  assert.ok(result.reviewUnits.every((unit) => unit.representative.reviewStatus === "pending-human-review"));
});
```

- [ ] **Step 2: Run the test and confirm RED**

Run: `npx tsx --test scripts/best-bottles/build-psd-cap-state-audit.test.ts`  
Expected: FAIL because the builder does not exist.

- [ ] **Step 3: Implement the pure builder and CLI**

Export `buildPsdCapStateAudit()` without CLI side effects. The CLI must:

1. recursively list only `.psd` files;
2. sort paths deterministically;
3. parse the 2,483-row canonical CSV with a quoted-field-safe parser;
4. load aliases only from `docs/best-bottles-canonical-truth/best-bottles-psd-reviewed-aliases.json`, treating a missing file as an empty alias list;
5. exact-join every source;
6. extract/reuse evidence;
7. build source-hash plus identity review units;
8. write all rows, including blocked and unmatched rows;
9. assert `accountedSourceCount === sourceFileCount`;
10. assert `approvedCount === 0` before human decisions.

Write:

```text
source-inventory.json
source-inventory.csv
identity-join.json
review-units.json
review-decisions-template.csv
unmatched-sources.csv
ambiguous-identity.csv
blocked-evidence.csv
summary.json
README.md
```

The decision template columns are:

```text
reviewUnitKey,sourceSha256,websiteSku,graceSku,family,representativePreviewPath,proposedClassification,decision,reviewer,reviewedAt,notes
```

Add package commands:

```json
"bestbottles:references:audit-psds": "tsx scripts/best-bottles/build-psd-cap-state-audit.ts",
"test:bestbottles:psd-audit": "tsx --test src/lib/bestBottlesPsdCapStateAudit.test.ts src/lib/bestBottlesPsdIdentityJoin.test.ts src/lib/bestBottlesPsdReviewDecisions.test.ts scripts/best-bottles/psd-cap-state-evidence.test.ts scripts/best-bottles/build-psd-cap-state-audit.test.ts scripts/best-bottles/render-psd-cap-state-review.test.ts scripts/best-bottles/apply-psd-cap-state-review.test.ts"
```

- [ ] **Step 4: Run tests and a two-file local smoke**

Run:

```bash
npx tsx --test scripts/best-bottles/build-psd-cap-state-audit.test.ts
BEST_BOTTLES_PSD_AUDIT_LIMIT=2 npm run bestbottles:references:audit-psds
```

Expected: tests pass; smoke summary reports 2 source files, 2 accounted sources, 0 approvals, 0 external writes, and unchanged source hashes/timestamps.

- [ ] **Step 5: Commit**

```bash
git add package.json scripts/best-bottles/build-psd-cap-state-audit.ts scripts/best-bottles/build-psd-cap-state-audit.test.ts
git commit -m "feat(best-bottles): build PSD cap-state audit"
```

### Task 5: Deterministic Review Sheets and Index

**Files:**
- Create: `scripts/best-bottles/render-psd-cap-state-review.ts`
- Create: `scripts/best-bottles/render-psd-cap-state-review.test.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes: `review-units.json` and hash-keyed preview PNGs.
- Produces: `buildPsdReviewSheetPlan(units, options)`, family/cohort PNG sheets, and a local HTML index.

- [ ] **Step 1: Write failing deterministic batching tests**

```ts
it("groups by family and emits every review unit exactly once", () => {
  const plan = buildPsdReviewSheetPlan(fixtures.units, { tilesPerSheet: 20 });
  assert.equal(plan.sheets.flatMap((sheet) => sheet.tiles).length, fixtures.units.length);
  assert.equal(new Set(plan.sheets.flatMap((sheet) => sheet.tiles.map((tile) => tile.reviewUnitKey))).size, fixtures.units.length);
  assert.ok(plan.sheets.every((sheet) => new Set(sheet.tiles.map((tile) => tile.family)).size === 1));
});

it("sorts ambiguous and conflicted identities before exact matches", () => {
  const plan = buildPsdReviewSheetPlan(fixtures.units, { tilesPerSheet: 20 });
  assert.equal(plan.sheets[0].queue, "identity-blockers");
});
```

- [ ] **Step 2: Run the test and confirm RED**

Run: `npx tsx --test scripts/best-bottles/render-psd-cap-state-review.test.ts`  
Expected: FAIL because the renderer does not exist.

- [ ] **Step 3: Implement the plan and Sharp renderer**

Use 20 tiles per 2000 x 2400 sheet in a 5 x 4 grid. Each tile contains the complete uncropped preview plus:

```text
website SKU | Grace SKU
family | source-relative basename
identity status | machine routing hints
review unit key suffix
```

Do not draw an approved cap-state label before a human decision exists. Render queues in this order: identity blockers, evidence blockers, unmatched, ambiguous layout, exact matched. Split exact matched queues by family and then by capacity/applicator cohort when those canonical fields exist.

Write `review-sheet-manifest.json`, PNG sheets, and `index.html` with relative links. The HTML is read-only and contains no form that mutates a manifest.

Add:

```json
"bestbottles:references:review-psds": "tsx scripts/best-bottles/render-psd-cap-state-review.ts"
```

- [ ] **Step 4: Run tests and render the two-file smoke sheets**

Run:

```bash
npx tsx --test scripts/best-bottles/render-psd-cap-state-review.test.ts
npm run bestbottles:references:review-psds
```

Expected: tests pass; every smoke review unit appears once; no source or pipeline file changes.

- [ ] **Step 5: Commit**

```bash
git add package.json scripts/best-bottles/render-psd-cap-state-review.ts scripts/best-bottles/render-psd-cap-state-review.test.ts
git commit -m "feat(best-bottles): render PSD cap-state review sheets"
```

### Task 6: Human Review Decision Validation and Local Merge

**Files:**
- Create: `src/lib/bestBottlesPsdReviewDecisions.ts`
- Create: `src/lib/bestBottlesPsdReviewDecisions.test.ts`
- Create: `scripts/best-bottles/apply-psd-cap-state-review.ts`
- Create: `scripts/best-bottles/apply-psd-cap-state-review.test.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes: audit review units and a completed decision CSV.
- Produces: `validatePsdReviewDecision()`, `applyPsdReviewDecisions()`, `reviewed-manifest.json`, and explicit blocker/worklist CSVs.

- [ ] **Step 1: Write failing approval-guard tests**

```ts
it("requires a named reviewer and ISO timestamp for an approved state", () => {
  assert.throws(() => validatePsdReviewDecision({
    reviewUnitKey: "unit",
    decision: "assembled-cap-on",
    reviewer: "",
    reviewedAt: "",
    notes: "",
  }), /reviewer/i);
});

it("rejects approval when canonical identity is ambiguous or conflicting", () => {
  assert.throws(() => applyPsdReviewDecisions({
    reviewUnits: [fixtures.ambiguousUnit],
    decisions: [{
      reviewUnitKey: fixtures.ambiguousUnit.reviewUnitKey,
      decision: "assembled-cap-on",
      reviewer: "Jordan Richter",
      reviewedAt: "2026-07-12T20:00:00-07:00",
      notes: "",
    }],
  }), /identity/i);
});

it("keeps unreviewed units pending and records them in the worklist", () => {
  const result = applyPsdReviewDecisions({ reviewUnits: fixtures.units, decisions: [] });
  assert.equal(result.reviewed.length, 0);
  assert.equal(result.pending.length, fixtures.units.length);
});
```

- [ ] **Step 2: Run tests and confirm RED**

Run:

```bash
npx tsx --test src/lib/bestBottlesPsdReviewDecisions.test.ts scripts/best-bottles/apply-psd-cap-state-review.test.ts
```

Expected: FAIL because decision handling does not exist.

- [ ] **Step 3: Implement strict decision handling**

Allowed decision values are the seven taxonomy values plus `blocked`. An approved visual state requires a nonempty reviewer, a valid ISO date-time, and identity status `exact-website-sku`, `exact-grace-sku`, or `reviewed-alias`. `ambiguous-manual-review`, `blocked-identity-conflict`, and `blocked` remain non-exportable.

Reject duplicate decision rows for one review-unit key, decisions for unknown keys, and any attempt to apply a decision to a different source hash. Never propagate a decision by hash alone.

The CLI reads `review-decisions.csv` and writes only local artifacts:

```text
reviewed-manifest.json
approved-cap-on.csv
approved-cap-off.csv
approved-detached-or-sidecar.csv
component-only.csv
multi-product-layout.csv
pending-human-review.csv
blocked-review.csv
review-summary.json
```

Add:

```json
"bestbottles:references:apply-psd-review": "tsx scripts/best-bottles/apply-psd-cap-state-review.ts"
```

- [ ] **Step 4: Run focused tests and an empty-decision smoke**

Run:

```bash
npx tsx --test src/lib/bestBottlesPsdReviewDecisions.test.ts scripts/best-bottles/apply-psd-cap-state-review.test.ts
npm run bestbottles:references:apply-psd-review
```

Expected: tests pass; with the untouched template every unit remains pending, approvals equal zero, and no remote writes occur.

- [ ] **Step 5: Commit**

```bash
git add package.json src/lib/bestBottlesPsdReviewDecisions.ts src/lib/bestBottlesPsdReviewDecisions.test.ts scripts/best-bottles/apply-psd-cap-state-review.ts scripts/best-bottles/apply-psd-cap-state-review.test.ts
git commit -m "feat(best-bottles): validate PSD cap-state reviews"
```

### Task 7: Full 4,493-PSD Audit Run and Durable Summary

**Files:**
- Modify: `docs/best-bottles-psd-cap-state-audit.md` (generated after the successful run)
- Do not commit: `tmp/best-bottles-reference-production/psd-cap-state-audit-v1/**`

**Interfaces:**
- Consumes: Tasks 1-6 and the immutable PSD archive.
- Produces: a complete local audit, review sheets, a zero-approval initial manifest, and a concise durable summary.

- [ ] **Step 1: Run the complete focused test suite**

Run: `npm run test:bestbottles:psd-audit`  
Expected: all focused tests pass with zero external services called.

- [ ] **Step 2: Record the archive before-state**

Run:

```bash
find '/Users/jordanrichter/Projects/Clients/Nemat-International/Best-Bottles-Original-Photoshop-Sources' -type f -iname '*.psd' -print0 \
  | sort -z \
  | xargs -0 shasum -a 256 \
  > tmp/best-bottles-reference-production/psd-cap-state-audit-v1/archive-before.sha256
```

Expected: 4,493 lines. This file is local evidence and is not committed.

- [ ] **Step 3: Run the resumable archive audit**

Run: `npm run bestbottles:references:audit-psds`  
Expected: summary reports 4,493 source files, 4,493 accounted sources, zero approvals, zero source changes, zero external writes, and explicit counts for exact joins, aliases, ambiguous identities, unmatched sources, duplicate review units, and evidence failures.

- [ ] **Step 4: Verify source immutability**

Run:

```bash
find '/Users/jordanrichter/Projects/Clients/Nemat-International/Best-Bottles-Original-Photoshop-Sources' -type f -iname '*.psd' -print0 \
  | sort -z \
  | xargs -0 shasum -a 256 \
  > tmp/best-bottles-reference-production/psd-cap-state-audit-v1/archive-after.sha256
cmp tmp/best-bottles-reference-production/psd-cap-state-audit-v1/archive-before.sha256 \
    tmp/best-bottles-reference-production/psd-cap-state-audit-v1/archive-after.sha256
```

Expected: `cmp` exits 0 with no output.

- [ ] **Step 5: Render the full review index**

Run: `npm run bestbottles:references:review-psds`  
Expected: every unique source-hash plus canonical-identity review unit appears exactly once; all 4,493 source paths remain traceable through the sheet manifest.

- [ ] **Step 6: Write the durable audit summary**

Create `docs/best-bottles-psd-cap-state-audit.md` from `summary.json` and `review-sheet-manifest.json`. It must report:

- archive file and unique-hash counts;
- exact website, exact Grace, alias, ambiguous, conflict, and unmatched counts;
- evidence-render success/failure counts;
- review-unit counts by family and queue;
- machine routing hints, clearly labeled as non-approvals;
- initial approvals: zero;
- PSD source hash comparison: unchanged;
- artifact paths and input hashes;
- next review cohort: Cylinder, starting with the exact 3 ml black sprayer and the reviewed clear 9 ml set;
- no export, upload, generation, or publication performed.

- [ ] **Step 7: Run final verification**

Run:

```bash
npm run test:bestbottles:psd-audit
npx tsc -p tsconfig.app.json --noEmit
git diff --check
git status --short
```

Expected: focused tests pass; TypeScript passes or only previously documented unrelated failures remain; diff check passes; no PSD or generated `tmp` artifact is staged.

- [ ] **Step 8: Commit the summary only**

```bash
git add docs/best-bottles-psd-cap-state-audit.md
git commit -m "docs(best-bottles): report PSD cap-state audit"
```

## Execution Boundary After This Plan

This plan ends with the complete read-only archive audit and review queues. The next implementation plan begins only after the first Cylinder review decisions are approved. It will cover versioned native-resolution opaque PNG exports, beginning with `GBSpry3mlClBlk..psd`, and will still stop before any Supabase upload or pipeline promotion.
