# CYL-9ML Family Release Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the versioned CYL-9ML release contract, calibrated validator, deterministic local release builder, and immutable Supabase ledger that all Madison, Sanity, and storefront work can consume.

**Architecture:** A pure TypeScript domain layer parses and validates release manifests without browser, database, or image-decoder dependencies. A Node-only adapter reads the five frozen body entries, placement recipe, and closure material pilot; it creates full-canvas release layers and a deterministic manifest. Supabase stores logical components, immutable component versions, append-only QA evidence, immutable family releases, exact release membership, and publish-run history behind organization-scoped RLS.

**Tech Stack:** TypeScript, Zod 3, Node test runner through `tsx --test`, Node `crypto`, Sharp, Supabase Postgres migrations, psql SQL contract tests.

## Global Constraints

- Preserve the five frozen body assets and their current SHA-256 values byte-for-byte.
- Canonical release canvas is exactly `2080 × 2288`, RGBA, on Bone `#F5F3EF`.
- Release family is `CYL-9ML`; physical closure family is `closure__17-415__rollon-overcap__v1`.
- Approved component versions and ready/published releases are immutable.
- Every blocking QA gate records its calibration fixture IDs; an uncalibrated blocking result blocks release readiness.
- Opaque closure geometry uses one binary object mask derived from the shared Blender mesh.
- `translucent-frosted` remains `assembly-context-required` and cannot count as release-ready.
- Unknown product/component keys fail closed; there is no first-asset fallback.
- No production Sanity, Convex, Shopify, Supabase, or storefront mutation occurs in this plan.
- Use `npx supabase migration new paper_doll_family_release_v1` to create the migration; do not invent its timestamp.
- Enable RLS on every new `public` table. Authenticated users receive organization-scoped read access only; writes remain service-role/server-side.
- Preserve the current uncommitted closure-pilot files and unrelated `package.json` changes.

## Plan boundaries

This is execution plan 1 of 4. It produces the stable interfaces consumed by:

1. Madison release workbench and visual assembly canvas.
2. Best Bottles-specific Sanity `paperDollFamily` dry-run publisher.
3. Development storefront compositor preview.

Those three surfaces receive separate plans after this core passes. They do not duplicate the release contract.

---

### Task 0: Freeze the verified closure-material pilot baseline

**Files:**
- Existing uncommitted: `scripts/paper-doll/closure-material-pilot.ts`
- Existing uncommitted: `scripts/paper-doll/render_closure.py`
- Existing uncommitted: `src/lib/paperDoll/closureMaterialPilot.ts`
- Existing uncommitted: `src/lib/paperDoll/closureMaterialPilot.test.ts`
- Existing modified: `package.json`

**Interfaces:**
- Produces: the verified four-material Blender pilot and `paperdoll:pilot-closure-materials` command consumed by Task 3.

- [ ] **Step 1: Review only the existing pilot diff**

```bash
git diff -- package.json
git diff --no-index /dev/null scripts/paper-doll/closure-material-pilot.ts
git diff --no-index /dev/null scripts/paper-doll/render_closure.py
git diff --no-index /dev/null src/lib/paperDoll/closureMaterialPilot.ts
git diff --no-index /dev/null src/lib/paperDoll/closureMaterialPilot.test.ts
```

Confirm the diff contains no registry mutation, network publication, catalog patch, or generated output.

- [ ] **Step 2: Re-run the pilot unit tests and TypeScript verification**

```bash
npx tsx --test src/lib/paperDoll/closureMaterialPilot.test.ts
npx tsc --noEmit
```

Expected: all four focused tests pass and TypeScript exits `0`.

- [ ] **Step 3: Re-run the isolated pilot**

```bash
npm run paperdoll:pilot-closure-materials
```

Expected: four closure renders, four clear-body composites, exact binary silhouette IoU `1.0000`, zero mismatched pixels, and `registryMutation: false`. Generated files remain under `outputs/` and are not staged.

- [ ] **Step 4: Commit only the verified pilot source**

```bash
git add package.json scripts/paper-doll/closure-material-pilot.ts scripts/paper-doll/render_closure.py src/lib/paperDoll/closureMaterialPilot.ts src/lib/paperDoll/closureMaterialPilot.test.ts
git commit -m "feat(paper-doll): prove shared-geometry closure materials"
```

Run `git status --short` and confirm none of the `outputs/` files entered the commit.

### Task 1: Release manifest contract and deterministic hashing

**Files:**
- Create: `src/lib/paperDoll/releaseContract.ts`
- Create: `src/lib/paperDoll/releaseContract.test.ts`
- Create: `src/lib/paperDoll/releaseHash.node.ts`

**Interfaces:**
- Produces: `PaperDollReleaseManifest`, `PaperDollReleaseAsset`, `PaperDollQaEvidence`, `parsePaperDollReleaseManifest(value)`, `canonicalizeReleaseValue(value)`, and `hashPaperDollRelease(manifest)`.
- Consumed by: Tasks 2, 3, and 5; subsequent Madison, Sanity, and storefront plans.

- [ ] **Step 1: Write the failing contract tests**

Create `releaseContract.test.ts` with a minimal valid fixture and assertions for the locked canvas, stable canonical ordering, and Node hash:

```ts
import assert from "node:assert/strict";
import test from "node:test";
import {
  canonicalizeReleaseValue,
  parsePaperDollReleaseManifest,
  type PaperDollReleaseManifest,
} from "./releaseContract";
import { hashPaperDollRelease } from "./releaseHash.node";

const validRelease: PaperDollReleaseManifest = {
  schemaVersion: 1,
  familyKey: "CYL-9ML",
  releaseVersion: "1.0.0-draft.1",
  status: "draft",
  canvas: { widthPx: 2080, heightPx: 2288, backgroundHex: "#F5F3EF" },
  assets: [],
  assemblyRecipes: [],
  assemblyMappings: [],
  qaEvidence: [],
  blockers: [],
  provenance: { sourceGitCommit: "fixture", rendererVersion: "fixture" },
};

test("release parser accepts the locked CYL-9ML canvas", () => {
  assert.equal(parsePaperDollReleaseManifest(validRelease).familyKey, "CYL-9ML");
});

test("release parser rejects a legacy canvas", () => {
  assert.throws(() => parsePaperDollReleaseManifest({
    ...validRelease,
    canvas: { widthPx: 1000, heightPx: 1300, backgroundHex: "#F5F3EF" },
  }), /2080|2288/);
});

test("canonical JSON and hash ignore object insertion order", () => {
  const reordered = { ...validRelease, provenance: { rendererVersion: "fixture", sourceGitCommit: "fixture" } };
  assert.equal(canonicalizeReleaseValue(validRelease), canonicalizeReleaseValue(reordered));
  assert.equal(hashPaperDollRelease(validRelease), hashPaperDollRelease(reordered));
});
```

- [ ] **Step 2: Run the contract tests and verify RED**

Run:

```bash
npx tsx --test src/lib/paperDoll/releaseContract.test.ts
```

Expected: FAIL because `releaseContract.ts` and `releaseHash.node.ts` do not exist.

- [ ] **Step 3: Implement the minimal Zod contract**

Create `releaseContract.ts` with literal canvas values and explicit enums:

```ts
import { z } from "zod";

export const PAPER_DOLL_RELEASE_SCHEMA_VERSION = 1 as const;
export const PAPER_DOLL_RELEASE_CANVAS = {
  widthPx: 2080,
  heightPx: 2288,
  backgroundHex: "#F5F3EF",
} as const;

export const PaperDollSlotSchema = z.enum([
  "body", "cap", "roller", "sprayer", "overcap", "pump",
]);
export const PaperDollReleaseStatusSchema = z.enum([
  "draft", "validating", "blocked", "ready", "published", "superseded",
]);
export const PaperDollQaStatusSchema = z.enum(["passed", "failed", "advisory", "blocked"]);

export const PaperDollReleaseAssetSchema = z.object({
  componentVersionId: z.string().min(1),
  componentKey: z.string().min(1),
  geometryFamilyId: z.string().min(1),
  slot: PaperDollSlotSchema,
  variantKey: z.string().min(1),
  materialVariant: z.string().min(1),
  imagePath: z.string().min(1),
  imageSha256: z.string().regex(/^[a-f0-9]{64}$/),
  geometryMaskPath: z.string().min(1).nullable(),
  geometryMaskSha256: z.string().regex(/^[a-f0-9]{64}$/).nullable(),
  widthPx: z.literal(2080),
  heightPx: z.literal(2288),
  alphaBounds: z.object({
    left: z.number().int().nonnegative(),
    top: z.number().int().nonnegative(),
    right: z.number().int().nonnegative(),
    bottom: z.number().int().nonnegative(),
  }),
  mountAxisXPx: z.number(),
  seatYPx: z.number(),
  approvalStatus: z.enum(["candidate", "blocked", "approved", "rejected"]),
});

export const PaperDollQaEvidenceSchema = z.object({
  evidenceId: z.string().min(1),
  subjectId: z.string().min(1),
  gateKey: z.string().min(1),
  gateVersion: z.string().min(1),
  status: PaperDollQaStatusSchema,
  blocking: z.boolean(),
  calibratedWith: z.array(z.string().min(1)),
  measurements: z.record(z.unknown()),
  issues: z.array(z.string()),
});

export const PaperDollReleaseManifestSchema = z.object({
  schemaVersion: z.literal(PAPER_DOLL_RELEASE_SCHEMA_VERSION),
  familyKey: z.string().min(1),
  releaseVersion: z.string().min(1),
  status: PaperDollReleaseStatusSchema,
  canvas: z.object({
    widthPx: z.literal(PAPER_DOLL_RELEASE_CANVAS.widthPx),
    heightPx: z.literal(PAPER_DOLL_RELEASE_CANVAS.heightPx),
    backgroundHex: z.literal(PAPER_DOLL_RELEASE_CANVAS.backgroundHex),
  }),
  assets: z.array(PaperDollReleaseAssetSchema),
  assemblyRecipes: z.array(z.object({
    recipeKey: z.string().min(1),
    mode: z.enum(["rollon", "spray", "lotion", "closure"]),
    layerOrder: z.array(PaperDollSlotSchema).min(1),
  })),
  assemblyMappings: z.array(z.object({
    mappingKey: z.string().min(1),
    websiteSku: z.string().min(1),
    graceSku: z.string().min(1),
    recipeKey: z.string().min(1),
    bodyVariantKey: z.string().min(1),
    fitmentVariantKey: z.string().min(1).nullable(),
    closureVariantKey: z.string().min(1).nullable(),
    overcapVariantKey: z.string().min(1).nullable(),
  })),
  qaEvidence: z.array(PaperDollQaEvidenceSchema),
  blockers: z.array(z.string()),
  provenance: z.object({ sourceGitCommit: z.string().min(1), rendererVersion: z.string().min(1) }),
});

export type PaperDollReleaseAsset = z.infer<typeof PaperDollReleaseAssetSchema>;
export type PaperDollQaEvidence = z.infer<typeof PaperDollQaEvidenceSchema>;
export type PaperDollReleaseManifest = z.infer<typeof PaperDollReleaseManifestSchema>;

export function parsePaperDollReleaseManifest(value: unknown): PaperDollReleaseManifest {
  return PaperDollReleaseManifestSchema.parse(value);
}

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, entry]) => [key, sortValue(entry)]));
  }
  return value;
}

export function canonicalizeReleaseValue(value: unknown): string {
  return JSON.stringify(sortValue(value));
}
```

Create `releaseHash.node.ts`:

```ts
import { createHash } from "node:crypto";
import { canonicalizeReleaseValue, type PaperDollReleaseManifest } from "./releaseContract";

export function hashPaperDollRelease(manifest: PaperDollReleaseManifest): string {
  return createHash("sha256").update(canonicalizeReleaseValue(manifest)).digest("hex");
}
```

- [ ] **Step 4: Run the contract tests and verify GREEN**

Run the focused test command from Step 2. Expected: PASS.

- [ ] **Step 5: Commit the contract**

```bash
git add src/lib/paperDoll/releaseContract.ts src/lib/paperDoll/releaseContract.test.ts src/lib/paperDoll/releaseHash.node.ts
git commit -m "feat(paper-doll): define immutable family release contract"
```

### Task 2: Calibrated release validator and fail-closed assembly resolver

**Files:**
- Create: `src/lib/paperDoll/releaseValidator.ts`
- Create: `src/lib/paperDoll/releaseValidator.test.ts`

**Interfaces:**
- Consumes: `PaperDollReleaseManifest` from Task 1.
- Produces: `validatePaperDollRelease(manifest): PaperDollReleaseValidation` and `resolvePaperDollAssembly(manifest, mappingKey): ResolvedPaperDollAssembly`.

- [ ] **Step 1: Write failing tests for duplicate assets, uncalibrated evidence, blocked translucency, and unknown mappings**

Use a fixture builder local to the test. Assert these behaviors separately:

```ts
test("duplicate slot and variant keys block a release", () => {
  const asset = approvedAsset({ slot: "cap", variantKey: "SHN-SL" });
  const result = validatePaperDollRelease(release({ assets: [asset, { ...asset, componentVersionId: "other" }] }));
  assert.equal(result.ready, false);
  assert.match(result.blockers.join("\n"), /duplicate_asset:cap:SHN-SL/);
});

test("blocking QA without calibration fixtures blocks readiness", () => {
  const manifest = release({ qaEvidence: [qa({ blocking: true, calibratedWith: [] })] });
  const result = validatePaperDollRelease(manifest as PaperDollReleaseManifest);
  assert.match(result.blockers.join("\n"), /uncalibrated_gate/);
});

test("isolated translucent plastic remains blocked", () => {
  const result = validatePaperDollRelease(release({
    assets: [approvedAsset({ materialVariant: "translucent-frosted", approvalStatus: "approved" })],
  }));
  assert.match(result.blockers.join("\n"), /assembly_context_required/);
});

test("unknown assembly mapping fails closed", () => {
  assert.throws(() => resolvePaperDollAssembly(release(), "missing"), /No assembly mapping/);
});
```

- [ ] **Step 2: Run the validator tests and verify RED**

```bash
npx tsx --test src/lib/paperDoll/releaseValidator.test.ts
```

Expected: FAIL because the validator does not exist.

- [ ] **Step 3: Implement validation and resolution**

`PaperDollReleaseValidation` is:

```ts
export interface PaperDollReleaseValidation {
  ready: boolean;
  blockers: string[];
  advisories: string[];
  assetCountBySlot: Partial<Record<PaperDollReleaseAsset["slot"], number>>;
}
```

`validatePaperDollRelease` must perform these exact checks:

- unique `slot × variantKey` asset identity;
- unique `mappingKey` and unique `websiteSku`;
- referenced recipe exists;
- body, fitment, closure, and overcap keys resolve to exactly one asset in their expected slot;
- all approved opaque cap assets have non-null mask path/hash and share the same `geometryMaskSha256` and `geometryFamilyId`;
- blocking QA evidence has at least one calibration fixture and status `passed`;
- `translucent-frosted` approved as an isolated asset adds `assembly_context_required:<componentVersionId>`;
- assets in `candidate`, `blocked`, or `rejected` state cannot satisfy a mapping;
- `ready` is true only when the computed blocker list is empty.

`resolvePaperDollAssembly` returns:

```ts
export interface ResolvedPaperDollAssembly {
  mappingKey: string;
  recipeKey: string;
  layers: PaperDollReleaseAsset[];
}
```

Resolve layers in the selected recipe's `layerOrder`. Throw on missing, duplicate, or unknown keys. Do not use array position as a fallback.

- [ ] **Step 4: Run validator tests and the existing paper-doll suite**

```bash
npx tsx --test src/lib/paperDoll/releaseValidator.test.ts
npm run test:paperdoll
```

Expected: both commands PASS.

- [ ] **Step 5: Commit the validator**

```bash
git add src/lib/paperDoll/releaseValidator.ts src/lib/paperDoll/releaseValidator.test.ts
git commit -m "feat(paper-doll): validate family releases fail closed"
```

### Task 3: CYL-9ML draft-release adapter and canonical layer exporter

**Files:**
- Create: `src/lib/paperDoll/cyl9FamilyRelease.node.ts`
- Create: `src/lib/paperDoll/cyl9FamilyRelease.test.ts`
- Create: `scripts/paper-doll/build-cyl9-family-release.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes: `docs/paper-doll-rig/body-plate-registry.json`, `docs/paper-doll-rig/closure-placement-recipe.json`, and `outputs/paper-doll-closure-material-pilot/manifest.json`.
- Produces: `buildCyl9DraftRelease(input): Promise<Cyl9DraftReleaseResult>`, full-canvas cap layers, one binary geometry mask, `manifest.json`, and `validation.json` under a caller-provided output directory.

- [ ] **Step 1: Write failing adapter tests with temporary fixtures**

Use `mkdtemp`, four tiny RGBA Sharp fixtures, and fixture JSON written under the temporary directory. The test must prove:

```ts
test("CYL-9ML adapter preserves five frozen body SHAs and blocks translucent", async () => {
  const result = await buildCyl9DraftRelease(fixtureInput);
  assert.equal(result.manifest.assets.filter((asset) => asset.slot === "body").length, 5);
  assert.equal(result.manifest.assets.filter((asset) => asset.slot === "cap" && asset.approvalStatus === "approved").length, 3);
  assert.match(result.validation.blockers.join("\n"), /assembly_context_required/);
});

test("canonical cap layers and the geometry mask share the locked canvas", async () => {
  const result = await buildCyl9DraftRelease(fixtureInput);
  for (const asset of result.manifest.assets) {
    assert.equal(asset.widthPx, 2080);
    assert.equal(asset.heightPx, 2288);
  }
  const opaqueCaps = result.manifest.assets.filter((asset) => asset.slot === "cap" && asset.materialVariant !== "translucent-frosted");
  assert.equal(new Set(opaqueCaps.map((asset) => asset.geometryMaskSha256)).size, 1);
});
```

The production change that makes these tests pass is the new adapter and exporter; no existing function can produce this release.

- [ ] **Step 2: Run adapter tests and verify RED**

```bash
npx tsx --test src/lib/paperDoll/cyl9FamilyRelease.test.ts
```

Expected: FAIL because `cyl9FamilyRelease.node.ts` does not exist.

- [ ] **Step 3: Implement the Node adapter**

Define:

```ts
export interface Cyl9DraftReleaseInput {
  bodyRegistryPath: string;
  placementRecipePath: string;
  closurePilotManifestPath: string;
  outputDirectory: string;
  sourceGitCommit: string;
}

export interface Cyl9DraftReleaseResult {
  manifest: PaperDollReleaseManifest;
  manifestSha256: string;
  validation: PaperDollReleaseValidation;
}
```

Implementation requirements:

1. Read and parse all three JSON inputs.
2. Require exactly the five approved body IDs and exact frozen SHA values currently recorded in `body-plate-registry.json`.
3. Verify each body file's bytes still match its registry SHA before adding it.
4. Take the `silver`, `matte-white`, `glossy-black`, and `translucent-frosted` closure renders from the pilot manifest.
5. Convert the silver render alpha to a binary object mask and save it once as `geometry/closure__17-415__rollon-overcap__v1-mask.png`.
6. Resize each source closure by the placement recipe's width and place it at its `centerX`/`bottomY` on a transparent `2080 × 2288` canvas. Save under `layers/cap/<variantKey>.png`.
7. Use `SHN-SL`, `WHT`, `SHN-BLK`, and `TRNS-FRS` variant keys respectively.
8. Mark the first three cap layers `approved`; mark `TRNS-FRS` `blocked`.
9. Build fifteen preview assembly mappings covering all five bodies × all three approved opaque caps, using stable keys `CYL-9ML:<BODY>:ROLLON:<CAP>`. These mappings are pilot preview mappings, not catalog publication truth.
10. Add calibrated evidence for shared geometry using fixture IDs `closure-material-pilot:silver`, `closure-material-pilot:matte-white`, and `closure-material-pilot:glossy-black`.
11. Add blocking translucent evidence with fixture ID `closure-material-pilot:translucent-frosted` and issue `assembly_context_required`.
12. Validate the manifest, hash it canonically, and write `manifest.json` and `validation.json`.

- [ ] **Step 4: Add the CLI and package script**

`build-cyl9-family-release.ts` accepts only `--output <directory>`, resolves the three locked repo inputs, reads `git rev-parse HEAD`, calls `buildCyl9DraftRelease`, prints the manifest hash/readiness/blockers, and exits `2` when blockers exist. That exit is expected for Release v1 because translucent is intentionally blocked.

Add without disturbing existing closure-pilot script changes:

```json
"paperdoll:build-cyl9-release": "tsx scripts/paper-doll/build-cyl9-family-release.ts"
```

- [ ] **Step 5: Verify GREEN on fixtures and the real local assets**

```bash
npx tsx --test src/lib/paperDoll/cyl9FamilyRelease.test.ts
npm run paperdoll:build-cyl9-release -- --output outputs/paper-doll-family-releases/CYL-9ML/1.0.0-draft.1
```

Expected: fixture tests PASS. Real command writes the deterministic release, reports the three opaque caps and five bodies, reports translucent as blocked, and exits `2` without mutating a registry or remote system.

Run the real command twice into two temporary directories and compare `manifest.json` hashes. Expected: identical.

- [ ] **Step 6: Commit the adapter without committing generated outputs**

```bash
git add package.json src/lib/paperDoll/cyl9FamilyRelease.node.ts src/lib/paperDoll/cyl9FamilyRelease.test.ts scripts/paper-doll/build-cyl9-family-release.ts
git commit -m "feat(paper-doll): build deterministic CYL-9ML draft release"
```

### Task 4: Supabase immutable release ledger

**Files:**
- Create via CLI: the migration path emitted by `npx supabase migration new paper_doll_family_release_v1`
- Create: `supabase/tests/paper_doll_family_release_v1.sql`

**Interfaces:**
- Consumes: release/component fields from Task 1.
- Produces: `paper_doll_components`, `paper_doll_component_versions`, `paper_doll_qa_results`, `paper_doll_family_releases`, `paper_doll_family_release_assets`, and `paper_doll_publish_runs`.

- [ ] **Step 1: Check the current Supabase changelog and schema documentation**

Read `https://supabase.com/changelog.md` and current documentation for RLS and local migration testing. Record any breaking change relevant to PostgreSQL policies, CLI migration creation, or local tests in the plan execution notes. Current observed CLI before execution: `2.111.0`; re-run `npx supabase --version` rather than assuming it remains unchanged.

- [ ] **Step 2: Write the failing SQL contract test**

Create `supabase/tests/paper_doll_family_release_v1.sql` as a pgTAP transaction using `select plan(12);` and `select * from finish();`. It must assert:

- all six tables exist;
- RLS is enabled on all six tables;
- authenticated read policies contain organization-membership predicates;
- duplicate `component_key` in one organization fails;
- duplicate `release_id × slot × variant_key` fails;
- component version organization must match its component organization;
- release asset organization must match both release and component-version organizations;
- an approved component version cannot change image hash, geometry hash, material, bounds, or approval state;
- QA rows cannot update or delete;
- ready/published release manifest hash and version cannot update;
- a service-role transaction can insert the five fixture bodies, three opaque caps, QA evidence, one blocked translucent cap, and one draft release;
- transaction rolls back.

- [ ] **Step 3: Run the SQL test and verify RED**

If local Supabase is already running:

```bash
npx supabase test db --local supabase/tests/paper_doll_family_release_v1.sql
```

Expected: FAIL because the tables do not exist. If no local database is running, proceed to Step 4, start Supabase with the documented CLI command, and return to this RED verification before writing migration SQL.

- [ ] **Step 4: Create the migration with the CLI**

```bash
npx supabase migration new paper_doll_family_release_v1
```

Use the exact emitted filename. The migration defines:

- UUID primary keys and `organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE` on every table;
- `created_at`/`updated_at` timestamps where rows are mutable drafts;
- explicit status checks copied from the design;
- SHA checks `CHECK (sha ~ '^[a-f0-9]{64}$')` for every hash;
- positive canvas dimensions and fixed Release v1 canvas checks on family releases;
- foreign keys with unique `(id, organization_id)` parent constraints so composite foreign keys enforce organization identity;
- unique asset membership `(release_id, slot, variant_key)`;
- indexes on organization/status, geometry family, family/version, and publish-run creation time;
- RLS enabled on every table;
- authenticated select policies using `public.is_organization_member((select auth.uid()), organization_id)`;
- no authenticated insert/update/delete policies;
- trigger functions that reject mutation of approved component identity, any QA update/delete, and ready/published release identity;
- trigger functions use default invoker security, `SET search_path = public`, and no `SECURITY DEFINER`.

Use these status checks exactly:

```sql
approval_status text not null check (approval_status in ('candidate','blocked','approved','rejected'))
qa_status text not null check (qa_status in ('passed','failed','advisory','blocked'))
release_status text not null check (release_status in ('draft','validating','blocked','ready','published','superseded'))
publish_status text not null check (publish_status in ('dry_run','success','failed','blocked'))
```

Store complete immutable JSON evidence alongside queryable columns:

```sql
measurements jsonb not null default '{}'::jsonb,
calibrated_with text[] not null check (cardinality(calibrated_with) > 0),
manifest jsonb not null,
manifest_sha256 text not null check (manifest_sha256 ~ '^[a-f0-9]{64}$')
```

- [ ] **Step 5: Reset the local database and verify GREEN**

Run only against the local Supabase instance:

```bash
npx supabase db reset --local
npx supabase test db --local supabase/tests/paper_doll_family_release_v1.sql
npx supabase migration list --local
```

Expected: migration applies, SQL contract test completes, rolls back, and migration list shows the new local migration. Do not link or push a remote project.

- [ ] **Step 6: Run database advisors or record the local-tool limitation**

Discover the installed command first:

```bash
npx supabase db --help
```

If `db advisors` is present, run `npx supabase db advisors --local` and resolve errors affecting the six new tables. If it is absent, record that exact CLI limitation in the verification report; do not substitute a remote production advisor run.

- [ ] **Step 7: Commit the migration and SQL test**

```bash
git add supabase/migrations/*_paper_doll_family_release_v1.sql supabase/tests/paper_doll_family_release_v1.sql
git commit -m "feat(paper-doll): add immutable Supabase release ledger"
```

### Task 5: Core verification command and handoff artifact

**Files:**
- Create: `scripts/paper-doll/verify-family-release.ts`
- Create: `scripts/paper-doll/verify-family-release.test.ts`
- Modify: `package.json`
- Create: `docs/paper-doll-rig/CYL-9ML-RELEASE-V1-CORE-VERIFICATION.md`

**Interfaces:**
- Consumes: manifest and validation output from Task 3.
- Produces: one machine-readable process exit and one human-readable verification report for the next Madison UI plan.

- [ ] **Step 1: Write the failing verification tests**

Test three exit decisions through a pure `releaseVerificationExitCode` function:

```ts
assert.equal(releaseVerificationExitCode({ ready: true, blockers: [] }), 0);
assert.equal(releaseVerificationExitCode({ ready: false, blockers: ["assembly_context_required:x"] }), 2);
assert.equal(releaseVerificationExitCode({ ready: false, blockers: ["duplicate_asset:cap:SHN-SL"] }), 1);
```

Exit `2` means the known, explicitly represented translucent research block; exit `1` means an unexpected core failure.

- [ ] **Step 2: Run the verification tests and verify RED**

```bash
npx tsx --test scripts/paper-doll/verify-family-release.test.ts
```

Expected: FAIL because the script does not exist.

- [ ] **Step 3: Implement verification reporting**

The CLI accepts `--manifest` and `--validation`, reparses both, recomputes the canonical manifest hash, prints:

- family/release/schema version;
- hash verification;
- asset count by slot;
- five frozen body identities;
- opaque closure variants and shared geometry-mask hash;
- blockers/advisories grouped by expected and unexpected;
- database migration/test status supplied through `--database-status passed|not-run|failed`;
- a final `CORE_READY_FOR_UI_PLAN`, `CORE_VALID_WITH_RESEARCH_BLOCK`, or `CORE_FAILED` verdict.

Add:

```json
"paperdoll:verify-release": "tsx scripts/paper-doll/verify-family-release.ts"
```

- [ ] **Step 4: Run the complete core verification**

```bash
npx tsx --test src/lib/paperDoll/releaseContract.test.ts src/lib/paperDoll/releaseValidator.test.ts src/lib/paperDoll/cyl9FamilyRelease.test.ts scripts/paper-doll/verify-family-release.test.ts
npm run test:paperdoll
npm run paperdoll:build-cyl9-release -- --output outputs/paper-doll-family-releases/CYL-9ML/1.0.0-draft.1
npm run paperdoll:verify-release -- --manifest outputs/paper-doll-family-releases/CYL-9ML/1.0.0-draft.1/manifest.json --validation outputs/paper-doll-family-releases/CYL-9ML/1.0.0-draft.1/validation.json --database-status passed
npx tsc --noEmit
```

Expected: all tests and TypeScript pass. Builder/verifier return the documented `2` research-block status only for translucent plastic; duplicate keys, hash drift, canvas drift, missing masks, or unresolved assembly mappings produce `1`.

- [ ] **Step 5: Write the verification handoff**

Record exact commands, exit codes, test counts, manifest hash, shared geometry-mask hash, five body SHAs, three opaque cap SHAs, known translucent blocker, Supabase CLI version, SQL-test result, and any advisor limitation. Do not report production readiness; report readiness for the Madison workbench plan.

- [ ] **Step 6: Commit the verification command and handoff**

```bash
git add package.json scripts/paper-doll/verify-family-release.ts scripts/paper-doll/verify-family-release.test.ts docs/paper-doll-rig/CYL-9ML-RELEASE-V1-CORE-VERIFICATION.md
git commit -m "test(paper-doll): verify CYL-9ML release core"
```

## Final core checkpoint

Before starting the Madison workbench plan:

- [ ] `git status --short` contains only the pre-existing closure-pilot work or explicitly reviewed new work.
- [ ] Contract, validator, adapter, verifier, existing paper-doll suite, SQL contract, and TypeScript checks pass.
- [ ] Five body registry SHAs match their files.
- [ ] Opaque cap layers share one geometry mask and exact placement.
- [ ] Translucent is present as a visible blocker.
- [ ] No remote Supabase command, Sanity mutation, Convex patch, Shopify mutation, or storefront deployment ran.
- [ ] Generated release output remains uncommitted unless a later asset-governance decision explicitly promotes it.
