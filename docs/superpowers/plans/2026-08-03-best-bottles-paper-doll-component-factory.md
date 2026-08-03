# Best Bottles Paper-Doll Component Factory Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a reusable full-lifecycle component-plate factory, complete all 23 CYL-9ML component records serving 29 catalog rows, and package the workflow as a repository skill for future bottle families.

**Approved design:** `docs/superpowers/specs/2026-08-03-best-bottles-paper-doll-component-factory-design.md`

**Architecture:** A typed family-production manifest drives a provider-neutral component image engine. Geometry masks, four bounding boxes, material candidates, placements, approvals, release cuts, and Sanity syncs are separately versioned. Madison renders persisted lifecycle records; server-only functions perform immutable writes after named actions.

**Tech Stack:** TypeScript, Zod, Sharp, React, Node test runner, Supabase Postgres/Edge Functions, Sanity documents, repository Agent Skills.

## Global Constraints

- Preserve the five locked CYL-9ML body plates and their registered SHA-256 values.
- Use the canonical `2080 × 2288` canvas and Bone `#F5F3EF` background.
- Track 23 unique CYL-9ML component plates, 29 catalog rows per body, and 145 explicit five-body assemblies.
- Treat GPT Image 2.0 output as material RGB only; generated alpha and framing are untrusted.
- Call geometry locked only when authority-mask clamp produces IoU `1.0000` and zero mismatched alpha pixels.
- Preserve original upload filenames in immutable provenance; sanitized object keys never replace them.
- Version every source crop, authority bounds, edit bounds, placement bounds, transform, approval, and release write.
- Keep candidate work no-write by default. Draft sync and public publication are separate named server actions.
- Do not regenerate bodies, silently nudge production pixels, replace the Madison shell, or assume unlike sprayers/pumps share geometry.
- Keep credentials and live database state out of Git, manifests, prompts, and skill files.
- Preserve unrelated dirty-worktree files; stage exact paths only.

---

## Milestone A — Deterministic component factory

### Task 1: Define the generic component-plate and family-production contracts

**Files:**
- Create: `src/lib/paperDoll/componentPlateContract.ts`
- Create: `src/lib/paperDoll/componentPlateContract.test.ts`
- Modify: `src/lib/paperDoll/releaseContract.ts`
- Modify: `package.json`

**Interfaces:**
- Produces: `PixelBoundsSchema`, `ComponentSourceSchema`, `ComponentAuthoritySchema`, `ComponentPlacementSchema`, `ComponentCandidateSchema`, `FamilyComponentDefinitionSchema`, `PaperDollFamilyProductionManifestSchema`, and their inferred TypeScript types.
- Consumes: the existing `PaperDollSlotSchema` and `PAPER_DOLL_RELEASE_CANVAS` constants.

- [ ] **Step 1: Write failing bounds and provenance tests**

```ts
test("component candidates preserve four distinct bounding boxes and the original filename", () => {
  const parsed = parseComponentCandidate(candidateFixture);
  assert.equal(parsed.source.originalFilename, "Spry17-415ShnSl.psd.png");
  assert.deepEqual(parsed.sourceBoundsPx, { left: 29, top: 24, width: 980, height: 1461 });
  assert.deepEqual(parsed.authorityBoundsPx, { left: 124, top: 187, width: 1152, height: 1681 });
  assert.deepEqual(parsed.editBoundsPx, { left: 29, top: 24, width: 980, height: 1461 });
  assert.deepEqual(parsed.placementBoundsPx, { left: 869, top: 500, width: 344, height: 502 });
});

test("family production manifests reject duplicate component and catalog keys", () => {
  assert.throws(() => parsePaperDollFamilyProductionManifest(duplicateFixture), /duplicate/i);
});
```

- [ ] **Step 2: Run the tests and verify RED**

Run: `npx tsx --test src/lib/paperDoll/componentPlateContract.test.ts`

Expected: FAIL because the contract module does not exist.

- [ ] **Step 3: Implement the schemas and cross-record refinements**

Use this public shape:

```ts
export const PixelBoundsSchema = z.object({
  left: z.number().int().nonnegative(),
  top: z.number().int().nonnegative(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
});

export const ComponentCandidateSchema = z.object({
  candidateId: z.string().min(1),
  familyKey: z.string().min(1),
  componentKey: z.string().min(1),
  variantKey: z.string().min(1),
  source: z.object({
    originalFilename: z.string().min(1).refine((v) => !/[\\/]/.test(v)),
    path: z.string().min(1),
    sha256: z.string().regex(/^[a-f0-9]{64}$/),
    widthPx: z.number().int().positive(),
    heightPx: z.number().int().positive(),
  }),
  sourceBoundsPx: PixelBoundsSchema,
  editBoundsPx: PixelBoundsSchema,
  authorityBoundsPx: PixelBoundsSchema,
  placementBoundsPx: PixelBoundsSchema,
  authorityMaskPath: z.string().min(1),
  authorityMaskSha256: z.string().regex(/^[a-f0-9]{64}$/),
  normalizedCandidateSha256: z.string().regex(/^[a-f0-9]{64}$/),
  fullCanvasLayerSha256: z.string().regex(/^[a-f0-9]{64}$/),
  placementVersionId: z.string().min(1).nullable(),
  provider: z.enum(["openai", "google", "higgsfield", "manual", "blender", "deterministic"]),
  model: z.string().min(1),
  promptSha256: z.string().regex(/^[a-f0-9]{64}$/).nullable(),
  estimatedCostUsd: z.number().nonnegative().nullable(),
  qa: z.object({
    geometryLocked: z.boolean(),
    minIoU: z.number().min(0).max(1),
    mismatchedPixels: z.number().int().nonnegative(),
  }),
  mutationPolicy: z.object({
    currentReleaseChanged: z.literal(false),
    sanityChanged: z.literal(false),
  }),
  lifecycleState: z.enum(["candidate", "pixels-approved", "family-fit-approved", "placement-locked", "released", "sanity-draft", "published", "rejected"]),
});
```

Refine every box against its declared canvas; reject duplicate component keys,
variant keys within a component, placement IDs, and catalog mapping keys.
`placementVersionId` remains `null` until the named `Lock Shared Placement` action
creates immutable placement truth. A preview transform is not a placement version.

- [ ] **Step 4: Extend release assets without breaking v1 parsing**

Add optional `candidateId`, `placementVersionId`, and four-box evidence fields to
`PaperDollReleaseAssetSchema`. Keep v1 generated releases parseable when these fields
are absent.

- [ ] **Step 5: Add the focused test command and verify GREEN**

Add:

```json
"test:paperdoll:factory": "tsx --test src/lib/paperDoll/componentPlateContract.test.ts src/lib/paperDoll/componentPlateImage.node.test.ts src/lib/paperDoll/cyl9ComponentFactory.test.ts scripts/paper-doll/build-component-candidate.test.ts"
```

Run: `npx tsx --test src/lib/paperDoll/componentPlateContract.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit the contract**

```bash
git add package.json src/lib/paperDoll/componentPlateContract.ts src/lib/paperDoll/componentPlateContract.test.ts src/lib/paperDoll/releaseContract.ts
git commit -m "feat(paper-doll): define component factory contract"
```

### Task 2: Generalize mask, bounding-box, placement, and composition operations

**Files:**
- Create: `supabase/functions/_shared/paperDollExactAlpha.ts`
- Create: `supabase/functions/_shared/paperDollExactAlpha.node.test.ts`
- Create: `src/lib/paperDoll/componentPlateImage.node.ts`
- Create: `src/lib/paperDoll/componentPlateImage.node.test.ts`
- Modify: `scripts/paper-doll/render-cyl9-cap-family.ts`
- Modify: `scripts/paper-doll/render-cyl9-cap-family.test.ts`

**Interfaces:**
- Consumes: `PixelBounds`, `ComponentCandidate`, and `PAPER_DOLL_RELEASE_CANVAS` from Task 1.
- Produces: dependency-free byte-level `copyAuthorityAlpha` and `compareExactAlphaBytes`, plus the Node image adapters `inspectAuthorityMask`, `normalizeMaterialIntoAuthority`, `clampToAuthorityMask`, `buildPlacedComponentLayer`, and `composeComponentAssembly`. Task 6 reuses the pure alpha core from its Deno adapter instead of inventing a second clamp algorithm.

- [ ] **Step 1: Write failing real-operation tests**

```ts
test("generated material is normalized into the mask and copies exact binary alpha", async () => {
  const result = await normalizeMaterialIntoAuthority({
    materialPng,
    sourceBoundsPx: { left: 1, top: 2, width: 6, height: 4 },
    authorityMaskPng,
  });
  assert.deepEqual(await alphaBytes(result.png), await alphaBytes(authorityMaskPng));
  assert.deepEqual(result.qa, { geometryLocked: true, minIoU: 1, mismatchedPixels: 0 });
});

test("authority inspection rejects the frame, empty masks, and undeclared islands", async () => {
  await assert.rejects(() => inspectAuthorityMask(frameMask, { expectedRegions: 1 }), /frame/i);
  await assert.rejects(() => inspectAuthorityMask(islandMask, { expectedRegions: 1 }), /connected/i);
});
```

- [ ] **Step 2: Run the tests and verify RED**

Run: `npx tsx --test supabase/functions/_shared/paperDollExactAlpha.node.test.ts src/lib/paperDoll/componentPlateImage.node.test.ts`

Expected: FAIL because the generic image module is absent.

- [ ] **Step 3: Move the proven operations into the generic module**

Refactor the existing uncommitted `buildGeometryLockedMaterialPlate` prototype and
the committed cap renderer helpers. Do not reimplement them in parallel. Put exact
alpha-copy and comparison logic in the dependency-free module; use Sharp only for
PNG decoding, normalization, composition, and encoding. Never infer geometry from
RGB.

```ts
export interface AuthorityInspectionOptions { expectedRegions: number }

export async function normalizeMaterialIntoAuthority(input: {
  materialPng: Buffer;
  sourceBoundsPx: PixelBounds;
  authorityMaskPng: Buffer;
  expectedRegions?: number;
}): Promise<{
  png: Buffer;
  authorityBoundsPx: PixelBounds;
  qa: { geometryLocked: boolean; minIoU: number; mismatchedPixels: number };
}>;
```

- [ ] **Step 4: Implement generic full-canvas placement**

```ts
export async function buildPlacedComponentLayer(input: {
  componentPng: Buffer;
  canvas: { widthPx: 2080; heightPx: 2288 };
  transform: { widthPx: number; centerXPx: number; seatYPx: number };
}): Promise<{ layerPng: Buffer; placementBoundsPx: PixelBounds }>;
```

Preserve aspect ratio through one uniform scale. Do not expose separate production
X/Y scaling.

- [ ] **Step 5: Convert the cap script to imports and preserve its API**

Re-export compatibility names from `render-cyl9-cap-family.ts` so committed cap
tests continue to pass while the implementation lives in the generic module.

- [ ] **Step 6: Run focused and regression tests**

Run:

```bash
npx tsx --test supabase/functions/_shared/paperDollExactAlpha.node.test.ts src/lib/paperDoll/componentPlateImage.node.test.ts
npm run test:paperdoll:cyl9-caps
npm run test:paperdoll
```

Expected: all PASS.

- [ ] **Step 7: Commit the generic image engine**

```bash
git add supabase/functions/_shared/paperDollExactAlpha.ts supabase/functions/_shared/paperDollExactAlpha.node.test.ts src/lib/paperDoll/componentPlateImage.node.ts src/lib/paperDoll/componentPlateImage.node.test.ts scripts/paper-doll/render-cyl9-cap-family.ts scripts/paper-doll/render-cyl9-cap-family.test.ts
git commit -m "refactor(paper-doll): generalize component plate image engine"
```

### Task 3: Register the complete CYL-9ML production inventory

**Files:**
- Create: `docs/paper-doll-rig/cyl9-component-factory.json`
- Create: `src/lib/paperDoll/cyl9ComponentFactory.ts`
- Create: `src/lib/paperDoll/cyl9ComponentFactory.test.ts`
- Modify: `docs/paper-doll-rig/cyl9-cap-family-recipe.json`
- Modify: `src/lib/paperDoll/cyl9CapFamily.ts`
- Modify: `src/lib/paperDoll/cyl9CapFamily.test.ts`

**Interfaces:**
- Consumes: `PaperDollFamilyProductionManifestSchema` from Task 1 and five locked body records.
- Produces: `loadCyl9ComponentFactory`, `buildCyl9ExpectedCatalogMappings`, `CYL9_COMPONENT_KEYS`, and the authoritative CYL-9ML manifest.

- [ ] **Step 1: Write the failing inventory reconciliation test**

```ts
test("CYL-9ML registers 23 component plates and 145 explicit assemblies", async () => {
  const manifest = await loadCyl9ComponentFactory();
  assert.equal(manifest.components.length, 23);
  assert.equal(manifest.catalogMappings.length, 145);
  assert.deepEqual(countRowsPerBody(manifest), { AMB: 29, BLU: 29, CLR: 29, FRS: 29, SWL: 29 });
});
```

- [ ] **Step 2: Run the test and verify RED**

Run: `npx tsx --test src/lib/paperDoll/cyl9ComponentFactory.test.ts`

Expected: FAIL because the manifest and loader do not exist.

- [ ] **Step 3: Add the exact 23 component keys**

Register these stable variant sets:

```ts
const caps = ["SSLV", "MSLV", "SGLD", "MGLD", "SBLK", "MCPR", "WHT", "SLDT", "BKDT", "PKDT"];
const rollers = ["PLASTIC", "METAL"];
const sprayers = ["GLD", "MSLV", "BLK", "SSLV", "RED", "TUR"];
const pumps = ["BLK", "GLD", "MSLV"];
const overcaps = ["SPRAY-TRNS", "LOTION-TRNS"];
```

Map the source filenames exactly:

```text
CpRoll17-415*.png
RollerBall17-415-{Plastic,Metal}.png
Spry17-415{Gl,MattSl,Blk,ShnSl,Red,Tur}.png
Ltn17-415{Blk,Gl,MattSl}.png
OverCap17-415-{Spray,Lotion}-Translucent.png
```

- [ ] **Step 4: Generate 145 deterministic mappings**

For each of five bodies, create ten plastic-roll-on rows, ten metal-roll-on rows,
six fine-mist rows, and three lotion rows. Overcaps are secondary assembly layers
and do not create additional catalog rows.

- [ ] **Step 5: Record unresolved authorities truthfully**

Every component must exist in the inventory, but components without an approved
mask use `authorityStatus: "missing"` and remain blocked. Do not manufacture hashes,
bounds, or approvals to satisfy the schema.

- [ ] **Step 6: Preserve the approved 344 px cap calibration**

Keep `widthPx: 344`, `centerX: 1041`, and `bottomY: 1002` for the cap geometry family.
Keep cap placement independent from roller, sprayer, pump, and overcap transforms.

- [ ] **Step 7: Run focused tests**

Run:

```bash
npx tsx --test src/lib/paperDoll/cyl9ComponentFactory.test.ts
npm run test:paperdoll:cyl9-caps
```

Expected: PASS with exactly 23 components and 145 mappings.

- [ ] **Step 8: Commit the CYL-9ML inventory**

```bash
git add docs/paper-doll-rig/cyl9-component-factory.json docs/paper-doll-rig/cyl9-cap-family-recipe.json src/lib/paperDoll/cyl9ComponentFactory.ts src/lib/paperDoll/cyl9ComponentFactory.test.ts src/lib/paperDoll/cyl9CapFamily.ts src/lib/paperDoll/cyl9CapFamily.test.ts
git commit -m "feat(paper-doll): register complete CYL-9ML component inventory"
```

### Task 4: Build provider-neutral candidate intake and normalization

**Files:**
- Create: `src/lib/paperDoll/componentMaterialPrompt.ts`
- Create: `src/lib/paperDoll/componentMaterialPrompt.test.ts`
- Create: `scripts/paper-doll/build-component-candidate.ts`
- Create: `scripts/paper-doll/build-component-candidate.test.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes: one family manifest, component/variant key, source image, explicit source bounds, provider metadata, and authority mask.
- Produces: `raw/`, `candidates/`, `layers/`, `review/`, and a candidate JSON record without registry, release, Supabase, or Sanity writes. Provider invocation is added server-side in Task 6; this command also accepts already-generated, Blender, manual-upload, and deterministic inputs.

- [ ] **Step 1: Write failing prompt and artifact tests**

```ts
test("material prompt locks material scope without claiming generated geometry is locked", () => {
  const prompt = buildComponentMaterialPrompt(input);
  assert.match(prompt, /change surface pixels only/i);
  assert.doesNotMatch(prompt, /reference.*geometry locked/i);
});

test("candidate build preserves original filename and emits exact-alpha evidence", async () => {
  const result = await buildComponentCandidate(fixture);
  assert.equal(result.record.source.originalFilename, "physical-gold-cap.jpg");
  assert.equal(result.record.qa.minIoU, 1);
  assert.equal(result.record.qa.mismatchedPixels, 0);
  assert.equal(result.record.mutationPolicy.currentReleaseChanged, false);
});
```

- [ ] **Step 2: Run tests and verify RED**

Run: `npx tsx --test src/lib/paperDoll/componentMaterialPrompt.test.ts scripts/paper-doll/build-component-candidate.test.ts`

Expected: FAIL because the modules do not exist.

- [ ] **Step 3: Implement material-class prompt rules**

Support `mirror`, `matte`, `glossy-dielectric`, `translucent`, `roller-plastic`,
`roller-steel-ball`, and `rhinestone`. Keep physical substrate and coating metadata
separate from color. For roll-on caps, prohibit solid/machined/brushed/anodized part
descriptions; only the roller ball may be steel.

- [ ] **Step 4: Implement candidate-only artifact generation**

```ts
export async function buildComponentCandidate(input: {
  manifest: PaperDollFamilyProductionManifest;
  componentKey: string;
  variantKey: string;
  sourcePath: string;
  originalFilename: string;
  sourceBoundsPx: PixelBounds;
  editBoundsPx: PixelBounds;
  provider: ComponentCandidate["provider"];
  model: string;
  prompt: string | null;
  outputDirectory: string;
}): Promise<{ record: ComponentCandidate; paths: CandidateArtifactPaths }>;
```

Reject sources whose explicit bounds fall outside the real source dimensions.
Write content-addressed filenames and a candidate manifest containing all hashes.
For desktop intake, preserve `File.name`; for Image Library intake, require the
asset's stored original filename and fall back only to a decoded URL basename.
Never send a storage URL/path as `originalFilename`, and fail before queueing when
no basename can be established.

- [ ] **Step 5: Add the CLI**

Add:

```json
"paperdoll:component-candidate": "tsx scripts/paper-doll/build-component-candidate.ts"
```

Required flags: `--manifest`, `--component`, `--variant`, `--source`,
`--original-filename`, `--source-bounds left,top,width,height`, `--edit-bounds`,
`--provider`, `--model`, and `--output`.

- [ ] **Step 6: Exercise the command on the existing GPT gold proof**

Run it with:

```text
component: closure__17-415__rollon-overcap
variant: SGLD
source: outputs/paper-doll-cyl9-cap-family/gpt-material-v1/raw/SGLD-gpt-image-2.png
source bounds: 29,24,980,1461
provider/model: openai/gpt-image-2
```

Expected: IoU `1.0000`, zero mismatched pixels, placement `344 × 502` at left `869`,
top `500`, bottom `1002`, and no external writes.

- [ ] **Step 7: Run factory tests**

Run: `npm run test:paperdoll:factory`

Expected: PASS.

- [ ] **Step 8: Commit the candidate command**

```bash
git add package.json src/lib/paperDoll/componentMaterialPrompt.ts src/lib/paperDoll/componentMaterialPrompt.test.ts scripts/paper-doll/build-component-candidate.ts scripts/paper-doll/build-component-candidate.test.ts
git commit -m "feat(paper-doll): add geometry-clamped material candidate loop"
```

---

## Milestone B — Immutable lifecycle and release operations

### Task 5: Add queued generation, append-only lifecycle, release-head, and Sanity-sync tables

**Files:**
- Create: `supabase/migrations/20260803090000_paper_doll_component_factory_v2.sql`
- Create: `supabase/tests/paper_doll_component_factory_v2.test.sql`

**Interfaces:**
- Consumes: existing organization-scoped `paper_doll_components`, `paper_doll_component_versions`, `paper_doll_family_releases`, and `paper_doll_publish_runs`.
- Produces: `paper_doll_candidate_requests`, `paper_doll_candidate_attempts`, `paper_doll_component_candidates`, `paper_doll_approval_events`, `paper_doll_placement_versions`, `paper_doll_placement_plates`, `paper_doll_release_heads`, `paper_doll_release_head_events`, `paper_doll_release_cuts`, `paper_doll_release_cut_assets`, and `paper_doll_sanity_syncs`.

- [ ] **Step 1: Write failing pgTAP lifecycle tests**

Assert:

```sql
SELECT throws_ok(
  $$ UPDATE paper_doll_approval_events SET approval_note = 'changed' $$,
  'Paper-doll approval events are append-only'
);

SELECT throws_ok(
  $$ INSERT INTO paper_doll_release_heads (...) VALUES (...) $$,
  'Release head must reference a validated release cut'
);
```

Also assert organization isolation, candidate source filename preservation,
idempotent request claiming, retry attempts that cannot overwrite successful
history, one current head per family, audited compare-and-swap head advancement,
release-cut idempotency by manifest SHA, and draft/public sync action separation.

- [ ] **Step 2: Run the database test and verify RED**

Run: `npx supabase test db --local`

Expected: FAIL because the v2 tables are absent.

- [ ] **Step 3: Create normalized append-only tables**

Store queued requests separately from immutable attempts so a worker can safely
claim one request and retries cannot replace a prior attempt. Store the four boxes
as JSONB with all `left`, `top`, `width`, and `height` keys.
Store named approver user ID, display name, note, action, and timestamp in approval
events. Store release head as a compare-and-swap pointer to an immutable cut and
append a release-head event for every successful advance; never mutate a cut.

- [ ] **Step 4: Add immutability and state-transition guards**

Use triggers to reject update/delete on completed attempts, candidates after pixel
approval, all approval events, locked placement versions, release-head events,
release cuts, release-cut assets, and successful Sanity sync rows. Permit only the
documented claim/complete/fail request transitions. Validate server-side lifecycle
transitions:

```text
candidate -> pixels-approved -> family-fit-approved -> placement-locked
placement-locked -> released -> sanity-draft -> published
```

- [ ] **Step 5: Add read-only authenticated RLS and service-role writes**

Match the existing v1 ledger policy: organization members may select; browser
clients receive no insert/update/delete grants; only service-role Edge Functions
write.

- [ ] **Step 6: Run pgTAP and migration lint**

Run:

```bash
npx supabase db lint --local
npx supabase test db --local
```

Expected: PASS.

- [ ] **Step 7: Commit the migration**

```bash
git add supabase/migrations/20260803090000_paper_doll_component_factory_v2.sql supabase/tests/paper_doll_component_factory_v2.test.sql
git commit -m "feat(paper-doll): add immutable component lifecycle ledger"
```

### Task 6: Implement server-only lifecycle actions

**Files:**
- Create: `supabase/functions/_shared/paperDollLifecycle.ts`
- Create: `supabase/functions/_shared/paperDollLifecycle.test.ts`
- Create: `supabase/functions/_shared/paperDollComponentGeneration.ts`
- Create: `supabase/functions/_shared/paperDollComponentGeneration.test.ts`
- Create: `supabase/functions/generate-paper-doll-component/index.ts`
- Create: `supabase/functions/approve-paper-doll-candidate/index.ts`
- Create: `supabase/functions/lock-paper-doll-placement/index.ts`
- Create: `supabase/functions/cut-paper-doll-release/index.ts`
- Create: `supabase/functions/sync-paper-doll-sanity-draft/index.ts`
- Create: `supabase/functions/publish-paper-doll-sanity-public/index.ts`

**Interfaces:**
- Consumes: authenticated user, organization membership, candidate request or named approval payload, immutable candidate/cut IDs, configured provider credentials, private storage buckets, and configured Sanity credentials.
- Produces: idempotent generation attempts and lifecycle action results with event IDs, content hashes, and no implicit next action.

- [ ] **Step 1: Write failing shared lifecycle tests**

```ts
Deno.test("pixel approval requires exact geometry QA and a named approver", () => {
  assertThrows(() => validateApprovalRequest(invalid), Error, "exact geometry");
});

Deno.test("draft sync cannot publish a public document", () => {
  const operation = buildSanityMutation(draftInput);
  assertEquals(operation.documentId, `drafts.${draftInput.documentId}`);
  assertEquals(operation.publicWrite, false);
});

Deno.test("generated framing is discarded and authority alpha is copied exactly", () => {
  const result = clampDecodedMaterialToAuthority(material, authority);
  assertEquals(result.alpha, authority.alpha);
  assertEquals(result.qa, { geometryLocked: true, minIoU: 1, mismatchedPixels: 0 });
});
```

- [ ] **Step 2: Run tests and verify RED**

Run: `deno test --allow-env supabase/functions/_shared/paperDollLifecycle.test.ts supabase/functions/_shared/paperDollComponentGeneration.test.ts`

Expected: FAIL because the shared lifecycle module is missing.

- [ ] **Step 3: Implement shared authorization and validation**

Require `approvedByName`, authenticated user ID, organization membership, non-empty
approval note, expected current lifecycle state, and matching content hash. Return
`409` for stale/idempotency conflicts, `422` for validation failures, and `403` for
authorization failures.

- [ ] **Step 4: Implement each Edge Function as one action**

- `approve-paper-doll-candidate`: append `approve-pixels` or `family-fit` event.
- `generate-paper-doll-component`: claim one queued request; call the selected
  provider through the existing provider wrappers; normalize the explicit source
  crop; copy the exact authority alpha; upload raw, candidate, layer, and review
  artifacts to private storage; append an attempt and candidate; never approve,
  release, or publish. Manual desktop/library uploads use this same intake path
  without a provider call.
- `lock-paper-doll-placement`: create one immutable transform plus five explicit plate rows.
- `cut-paper-doll-release`: validate selected immutable versions, append a cut, and atomically advance the family release head.
- `sync-paper-doll-sanity-draft`: write only `drafts.<documentId>` and record `_rev`.
- `publish-paper-doll-sanity-public`: require a second named action, downstream-scope confirmation, and a successful draft sync for the same cut.

- [ ] **Step 5: Run shared and function tests**

Run:

```bash
deno test --allow-env supabase/functions/_shared/paperDollLifecycle.test.ts supabase/functions/_shared/paperDollComponentGeneration.test.ts
npx supabase functions serve --env-file supabase/.env.local
```

Use local authenticated requests to verify each non-2xx response includes a stable
`code`, `message`, and field-level `issues` array.

- [ ] **Step 6: Commit the server actions**

```bash
git add supabase/functions/_shared/paperDollLifecycle.ts supabase/functions/_shared/paperDollLifecycle.test.ts supabase/functions/_shared/paperDollComponentGeneration.ts supabase/functions/_shared/paperDollComponentGeneration.test.ts supabase/functions/generate-paper-doll-component supabase/functions/approve-paper-doll-candidate supabase/functions/lock-paper-doll-placement supabase/functions/cut-paper-doll-release supabase/functions/sync-paper-doll-sanity-draft supabase/functions/publish-paper-doll-sanity-public
git commit -m "feat(paper-doll): add named lifecycle actions"
```

---

## Milestone C — Madison workbench and Sanity projection

### Task 7: Add the six persisted lifecycle views to the existing workbench

**Files:**
- Create: `src/lib/paperDoll/componentWorkbenchModel.ts`
- Create: `src/lib/paperDoll/componentWorkbenchModel.test.ts`
- Create: `src/components/paper-doll/ComponentInventoryView.tsx`
- Create: `src/components/paper-doll/ComponentPlateView.tsx`
- Create: `src/components/paper-doll/ComponentCandidateView.tsx`
- Create: `src/components/paper-doll/FamilyFitView.tsx`
- Create: `src/components/paper-doll/ReleaseCutView.tsx`
- Create: `src/components/paper-doll/SanityProjectionView.tsx`
- Modify: `src/components/paper-doll/ReleaseWorkbench.tsx`
- Modify: `src/components/paper-doll/releaseWorkbenchState.ts`
- Modify: `src/components/paper-doll/releaseWorkbenchState.test.ts`
- Modify: `src/pages/BestBottlesStudio.tsx`
- Modify: `src/styles/paper-doll-workbench.css`

**Interfaces:**
- Consumes: parsed production manifest, component candidates, approval events, placements, release head, and Sanity sync records.
- Produces: six URL-addressable views and named action payloads; no direct database mutation.

- [ ] **Step 1: Write failing state and model tests**

```ts
test("workbench URLs preserve family, component, candidate, plate, and lifecycle view", () => {
  const state = parseReleaseWorkbenchState(new URLSearchParams("view=component&component=cap&candidate=c1&plate=BLU"));
  assert.equal(state.view, "component");
  assert.equal(state.candidateId, "c1");
  assert.equal(state.bodyVariantKey, "BLU");
});

test("inventory distinguishes missing authority from failed current candidate", () => {
  assert.equal(buildComponentStatus(missingAuthority).tone, "blocked");
  assert.equal(buildComponentStatus(cleanCandidateWithQuarantinedAncestor).tone, "candidate");
});
```

- [ ] **Step 2: Run tests and verify RED**

Run: `npx tsx --test src/lib/paperDoll/componentWorkbenchModel.test.ts src/components/paper-doll/releaseWorkbenchState.test.ts`

Expected: FAIL because lifecycle views and state fields are absent.

- [ ] **Step 3: Implement the model before JSX**

Return rows containing component/variant identity, authority status, candidate
status, pixel approval, family-fit approval, placement lock, release membership,
Sanity draft state, blockers, and next action. Keep quarantine ancestry separate
from current candidate errors.

- [ ] **Step 4: Replace the five generic tabs with six lifecycle views**

Use exact labels: `Inventory`, `Component Plate`, `Candidate Review`, `Family Fit`,
`Release Cut`, and `Sanity Projection`. Preserve the existing workbench shell,
inventory rail, scrolling behavior, and query-string reopening.

- [ ] **Step 5: Implement Component Plate controls**

Display source image, authority mask, all four boxes, slot, geometry family,
compatible bodies, generation provider, prompt, and upload/library controls. Preview
drag/resize edits locally; persist them only through versioned candidate/placement
actions.

- [ ] **Step 6: Implement review and family-fit views**

Candidate Review displays release source, candidate, difference, provenance, and
exact-alpha QA. Family Fit displays the selected body at inspection size plus the
five-body lineup, shared transform, explicit override reason, and the named actions
`Approve Pixels`, `Family Fit`, and `Lock Shared Placement`.

- [ ] **Step 7: Implement release and Sanity views**

Release Cut shows selected immutable versions, manifest hash, validation, and named
approver. Sanity Projection shows dry-run payload, asset plan, target draft ID,
returned revision, and separate `Sync Draft` and `Publish Publicly` actions.

- [ ] **Step 8: Run UI tests and build**

Run:

```bash
npx tsx --test src/lib/paperDoll/componentWorkbenchModel.test.ts src/components/paper-doll/releaseWorkbenchState.test.ts
npm run build
```

Expected: PASS with no new console errors.

- [ ] **Step 9: Browser-verify the CYL-9ML route**

Open:

```text
/best-bottles/studio/cylinder-9ml-amber-17-415-rollon?paperDollPreview=1&view=inventory
```

Verify all six views, vertical scrolling, direct URL reopening, five-body selection,
four-box overlays, disabled writes without named approval, and no disappearance when
switching bodies.

- [ ] **Step 10: Commit the workbench**

```bash
git add src/lib/paperDoll/componentWorkbenchModel.ts src/lib/paperDoll/componentWorkbenchModel.test.ts src/components/paper-doll/ComponentInventoryView.tsx src/components/paper-doll/ComponentPlateView.tsx src/components/paper-doll/ComponentCandidateView.tsx src/components/paper-doll/FamilyFitView.tsx src/components/paper-doll/ReleaseCutView.tsx src/components/paper-doll/SanityProjectionView.tsx src/components/paper-doll/ReleaseWorkbench.tsx src/components/paper-doll/releaseWorkbenchState.ts src/components/paper-doll/releaseWorkbenchState.test.ts src/pages/BestBottlesStudio.tsx src/styles/paper-doll-workbench.css
git commit -m "feat(paper-doll): add component factory workbench"
```

### Task 8: Extend the release projection for deterministic Sanity drafts and guarded publication

**Files:**
- Modify: `src/lib/paperDoll/sanityProjection.ts`
- Modify: `src/lib/paperDoll/sanityProjection.test.ts`
- Create: `src/lib/paperDoll/releaseCut.ts`
- Create: `src/lib/paperDoll/releaseCut.test.ts`
- Modify: `src/components/paper-doll/publishPreviewModel.ts`
- Modify: `src/components/paper-doll/publishPreviewModel.test.ts`

**Interfaces:**
- Consumes: immutable release cut, release head, configured Sanity target, and lifecycle sync rows.
- Produces: no-write preview, draft-sync request, public-publish request, deterministic document IDs, and UI action guards.

- [ ] **Step 1: Write failing release and projection tests**

```ts
test("release cuts are content-addressed and advance the head idempotently", async () => {
  const first = buildReleaseCut(input);
  const second = buildReleaseCut(input);
  assert.equal(first.cutId, second.cutId);
  assert.equal(first.manifestSha256, second.manifestSha256);
});

test("draft projection never targets the public document", async () => {
  const projection = await buildPaperDollSanityDraftProjection(manifest, target);
  assert.equal(projection.target.documentId, `drafts.${target.documentId}`);
  assert.equal(projection.publishEligible, false);
});
```

- [ ] **Step 2: Run tests and verify RED**

Run: `npx tsx --test src/lib/paperDoll/releaseCut.test.ts src/lib/paperDoll/sanityProjection.test.ts`

Expected: FAIL because release-cut and draft-sync interfaces are missing.

- [ ] **Step 3: Implement canonical release cuts**

Derive `cutId` from family key, release version, manifest SHA, and sorted selected
component/placement version IDs. Reject mutable candidates and mixed placement
versions. Permit incremental cuts containing approved subsets while reporting
unresolved catalog mappings explicitly.

- [ ] **Step 4: Split preview, draft, and public requests**

Keep `buildPaperDollSanityProjection` as no-write preview. Add
`buildPaperDollSanityDraftProjection` and `buildPaperDollSanityPublicRequest`.
The public request requires a successful draft revision for the same cut and
`downstreamScopeConfirmed: true`.

- [ ] **Step 5: Guard the obsolete direct-publish path**

Ensure no component-factory UI action calls `push-product-to-sanity` or any legacy
auto-publish route. The only allowed clients are the new draft and public Edge
Functions from Task 6.

- [ ] **Step 6: Run projection and workbench tests**

Run:

```bash
npx tsx --test src/lib/paperDoll/releaseCut.test.ts src/lib/paperDoll/sanityProjection.test.ts src/components/paper-doll/publishPreviewModel.test.ts
npm run build
```

Expected: PASS.

- [ ] **Step 7: Commit release projection**

```bash
git add src/lib/paperDoll/releaseCut.ts src/lib/paperDoll/releaseCut.test.ts src/lib/paperDoll/sanityProjection.ts src/lib/paperDoll/sanityProjection.test.ts src/components/paper-doll/publishPreviewModel.ts src/components/paper-doll/publishPreviewModel.test.ts
git commit -m "feat(paper-doll): add controlled release and Sanity draft projection"
```

---

## Milestone D — Complete the real CYL-9ML production set

### Task 9: Calibrate and register geometry authorities for all 23 component plates

**Files:**
- Create: `scripts/paper-doll/calibrate-cyl9-component-authorities.ts`
- Create: `scripts/paper-doll/calibrate-cyl9-component-authorities.test.ts`
- Create: `docs/paper-doll-rig/cyl9-component-authority-calibration.json`
- Create: `assets/paper-doll/authority-masks/cyl9/*.png`
- Modify: `docs/paper-doll-rig/cyl9-component-factory.json`
- Modify: `package.json`

**Interfaces:**
- Consumes: the 23 real component source records, their actual alpha channels,
  operator-confirmed crop settings, and the approved shared-silhouette claims.
- Produces: versioned authority masks, occupied bounds, topology evidence, hashes,
  and truthful geometry-family assignments for every CYL-9ML component record.

- [ ] **Step 1: Write failing real-file calibration tests**

```ts
test("all 23 CYL-9ML records resolve to a calibrated authority mask", async () => {
  const report = await calibrateCyl9Authorities({ write: false });
  assert.equal(report.components.length, 23);
  assert.equal(report.components.filter((row) => row.status === "approved").length, 23);
});

test("shared geometry is earned by exact alpha, not by applicator label", async () => {
  const report = await calibrateCyl9Authorities({ write: false });
  for (const group of report.geometryFamilies) {
    assert.equal(group.maxAlphaMismatchPixels, 0);
  }
});
```

- [ ] **Step 2: Run the tests and verify RED**

Run: `npx tsx --test scripts/paper-doll/calibrate-cyl9-component-authorities.test.ts`

Expected: FAIL because the calibration command and authority records do not exist.

- [ ] **Step 3: Build per-component extraction recipes from real files**

Use the approved shiny-silver cap silhouette for the ten cap variants. Use the
approved clean roller silhouette for plastic and metal only after exact-alpha
comparison confirms identity. Inspect every sprayer, pump, and translucent overcap
source independently before assigning a shared geometry family. Record each crop,
alpha extraction rule, expected connected regions, and review decision in the
calibration JSON. Do not use one global alpha, luminance, brightness, or region
threshold.

- [ ] **Step 4: Generate and inspect versioned masks**

Reject frame masks, empty masks, frame-touching masks, undeclared islands, and masks
whose occupied bounds clip the component. Rhinestone stones receive stable IDs and
normalized positions but do not expand the over-cap silhouette. Emit a contact
sheet showing source, mask, occupied bounds, and topology for every component.

- [ ] **Step 5: Update the family manifest with measured evidence**

Replace `authorityStatus: "missing"` only when the corresponding real mask, hash,
bounds, topology, and operator review evidence exist. Keep visually similar but
non-identical sprayers or pumps in separate geometry families.

- [ ] **Step 6: Run calibration, factory, and regression tests**

```bash
npx tsx --test scripts/paper-doll/calibrate-cyl9-component-authorities.test.ts
npm run test:paperdoll:factory
npm run test:paperdoll:cyl9-caps
```

Expected: PASS with 23 authority-backed component records and unchanged five body
plate hashes.

- [ ] **Step 7: Commit authority metadata and compact masks**

```bash
git add package.json scripts/paper-doll/calibrate-cyl9-component-authorities.ts scripts/paper-doll/calibrate-cyl9-component-authorities.test.ts docs/paper-doll-rig/cyl9-component-authority-calibration.json docs/paper-doll-rig/cyl9-component-factory.json assets/paper-doll/authority-masks/cyl9
git commit -m "feat(paper-doll): register CYL-9ML geometry authorities"
```

### Task 10: Produce the 23-component material and five-body review batch

**Files:**
- Create: `docs/paper-doll-rig/cyl9-component-material-recipes.json`
- Create: `scripts/paper-doll/build-cyl9-component-batch.ts`
- Create: `scripts/paper-doll/build-cyl9-component-batch.test.ts`
- Create: `src/lib/paperDoll/rhinestoneLayout.ts`
- Create: `src/lib/paperDoll/rhinestoneLayout.test.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes: 23 approved geometry authorities, real material references, the
  provider-neutral candidate loop, and five locked body plates.
- Produces: a costed no-write batch plan, 23 mask-clamped candidates, five-body
  assembly evidence, material-specific QA evidence, and an operator review queue.

- [ ] **Step 1: Write failing batch-completeness and decoration tests**

```ts
test("the CYL-9ML batch plans one candidate for every component plate", async () => {
  const plan = await buildCyl9ComponentBatch({ mode: "plan" });
  assert.equal(plan.jobs.length, 23);
  assert.equal(new Set(plan.jobs.map((job) => job.componentKey)).size, 23);
});

test("rhinestone coordinates remain identical across rerenders", () => {
  assert.deepEqual(buildRhinestoneLayout(recipe), buildRhinestoneLayout(recipe));
});
```

- [ ] **Step 2: Run the tests and verify RED**

Run: `npx tsx --test scripts/paper-doll/build-cyl9-component-batch.test.ts src/lib/paperDoll/rhinestoneLayout.test.ts`

Expected: FAIL because the batch recipe and runner do not exist.

- [ ] **Step 3: Encode material-specific recipes**

Use deterministic treatment for mirror variants that already share approved
reflection structure. Use GPT Image 2.0 for matte, glossy-dielectric, translucent,
and other surface structures that cannot be obtained by hue shift. Keep the plastic
roller housing unchanged; only the metal roller ball becomes mirror chrome.
Rhinestone recipes preserve stable stone IDs and coordinates. Each recipe names its
physical substrate, coating, real reference, provider policy, prompt hash, and
material-specific review checklist.

- [ ] **Step 4: Add explicit plan and execute modes**

`--plan` validates all inputs, lists provider calls, estimates cost, and writes
nothing. `--execute` requires an explicit confirmation token and defaults to the
local Supabase/ignored-output target. It refuses a non-loopback ledger target unless
the caller also provides the separate remote-write flag. It creates candidate
requests only and never approves or releases. Resume by request ID; do not queue a
duplicate successful content hash.

- [ ] **Step 5: Run the plan, review cost, then execute the authorized batch**

```bash
npm run paperdoll:cyl9-batch -- --plan
npm run paperdoll:cyl9-batch -- --execute --target local --confirmation CYL9-MATERIAL-BATCH
```

Use local/provider credentials only after the costed plan is reviewed. Provider
calls may incur the displayed cost, but the default execution target keeps ledger
and artifact writes local. Store raw and normalized artifacts in ignored local
output or configured private candidate storage. Do not write Current Release or
Sanity.

- [ ] **Step 6: Generate review evidence and stop at named approval**

For every candidate, emit source/candidate/difference views, exact-alpha evidence,
and assemblies on Amber, Cobalt, Clear, Frosted, and Swirl. Review mirror, matte,
glossy black, white, translucent, roller, and rhinestone classes with separately
calibrated real-file evidence. Do not auto-approve on a cross-material brightness
score. Present the 23-row queue for `Approve Pixels` and subsequent `Family Fit`.

- [ ] **Step 7: Run batch and factory tests**

Extend `test:paperdoll:factory` to include the exact-alpha, prompt, generation,
rhinestone, batch, release-cut, and workbench-model suites added after Task 1.

```bash
npx tsx --test scripts/paper-doll/build-cyl9-component-batch.test.ts src/lib/paperDoll/rhinestoneLayout.test.ts
npm run test:paperdoll:factory
```

Expected: PASS with 23 reviewable component candidates, 115 component/body plate
inspections (23 component plates × five bodies), and 145 fully assembled catalog
rows.

- [ ] **Step 8: Commit recipes and code, not raw generated binaries**

```bash
git add package.json docs/paper-doll-rig/cyl9-component-material-recipes.json scripts/paper-doll/build-cyl9-component-batch.ts scripts/paper-doll/build-cyl9-component-batch.test.ts src/lib/paperDoll/rhinestoneLayout.ts src/lib/paperDoll/rhinestoneLayout.test.ts
git commit -m "feat(paper-doll): add CYL-9ML component production batch"
```

---

## Milestone E — Repository skill and end-to-end proof

### Task 11: Create and test the repository production skill

**Files:**
- Create: `.agents/skills/best-bottles-paper-doll-production/SKILL.md`
- Create: `.agents/skills/best-bottles-paper-doll-production/agents/openai.yaml`
- Create: `.agents/skills/best-bottles-paper-doll-production/references/component-contract.md`
- Create: `.agents/skills/best-bottles-paper-doll-production/references/material-doctrine.md`
- Create: `.agents/skills/best-bottles-paper-doll-production/references/release-and-sanity.md`
- Create: `.agents/skills/best-bottles-paper-doll-production/scripts/validate_family_manifest.ts`
- Create: `.agents/skills/best-bottles-paper-doll-production/scripts/summarize_family_status.ts`
- Create: `docs/paper-doll-rig/evidence/paper-doll-skill-evaluation.md`

**Interfaces:**
- Consumes: the generic commands, real CYL-9ML calibration, and contracts from Tasks 1–10.
- Produces: a discoverable repository skill that guides a fresh agent through inventory, geometry, material, approvals, release cut, and Sanity draft/public actions.

- [ ] **Step 1: Run the baseline skill scenario without the new skill**

Use a fresh subagent with only this task and a synthetic future-family manifest:

```text
Prepare matte, mirror, and rhinestone closures for a five-body 13-415 family,
approve them, and publish the family to Sanity. Work quickly and use the supplied
reference images.
```

Record whether the agent independently regenerates geometry, omits bounding-box
provenance, treats a reference as geometry locked, skips exact-alpha QA, or combines
draft/public publication. Write the baseline observations to the evaluation file.

- [ ] **Step 2: Initialize the repository skill**

Run:

```bash
python /Users/jordanrichter/.codex/skills/.system/skill-creator/scripts/init_skill.py \
  best-bottles-paper-doll-production \
  --path .agents/skills \
  --resources scripts,references \
  --interface display_name="Best Bottles Paper-Doll Production" \
  --interface short_description="Produce and release geometry-locked Best Bottles component families" \
  --interface default_prompt="Run the full paper-doll component lifecycle for this Best Bottles family."
```

- [ ] **Step 3: Write the minimal skill from observed baseline failures**

Use frontmatter:

```yaml
---
name: best-bottles-paper-doll-production
description: Use when producing, reviewing, releasing, or publishing Best Bottles paper-doll component families, especially when closure geometry, material variants, bounding boxes, family fit, release cuts, or Sanity state must remain consistent.
---
```

Keep `SKILL.md` under 500 words. Require the agent to read the family manifest,
classify geometry families using real evidence, use GPT only for material pixels,
run candidate and family tests, stop at each named approval, and keep draft/public
actions separate.

- [ ] **Step 4: Add concise references and deterministic wrappers**

- `component-contract.md`: four boxes, authority hierarchy, lifecycle state machine.
- `material-doctrine.md`: mirror/matte/glossy/translucent/roller/rhinestone rules.
- `release-and-sanity.md`: approval payloads, release cut, draft sync, public guard.
- `validate_family_manifest.ts`: call the repository parser and print stable JSON.
- `summarize_family_status.ts`: print component counts, blockers, approvals, release head, and Sanity state without writes.

- [ ] **Step 5: Validate the skill structure and scripts**

Run:

```bash
python /Users/jordanrichter/.codex/skills/.system/skill-creator/scripts/quick_validate.py .agents/skills/best-bottles-paper-doll-production
npx tsx .agents/skills/best-bottles-paper-doll-production/scripts/validate_family_manifest.ts docs/paper-doll-rig/cyl9-component-factory.json
npx tsx .agents/skills/best-bottles-paper-doll-production/scripts/summarize_family_status.ts docs/paper-doll-rig/cyl9-component-factory.json
```

Expected: validation PASS, component count `23`, mapping count `145`, and truthful
blockers for material, fit, approval, release, or Sanity stages not yet completed.

- [ ] **Step 6: Forward-test the same scenario with the skill**

Use a fresh subagent and explicitly name the new skill. The agent must produce a
candidate-only plan, identify required geometry authorities, retain four-box
provenance, require mask clamp, and stop before draft/public writes without named
approval. Record the results beside the baseline.

- [ ] **Step 7: Commit the skill**

```bash
git add .agents/skills/best-bottles-paper-doll-production docs/paper-doll-rig/evidence/paper-doll-skill-evaluation.md
git commit -m "feat(paper-doll): add reusable production skill"
```

### Task 12: Verify the full CYL-9ML loop without production writes

**Files:**
- Modify only if verification exposes a defect in an owned file from Tasks 1–11.
- Produce ignored review outputs under `outputs/paper-doll-component-factory/CYL-9ML/`.

**Interfaces:**
- Consumes: all completed milestones.
- Produces: test results, 23-row component status, 145-assembly matrix, GPT gold proof, release-cut dry run, and Sanity no-write projection.

- [ ] **Step 1: Run all focused tests**

```bash
npm run test:paperdoll
npm run test:paperdoll:cyl9-caps
npm run test:paperdoll:factory
npx tsx --test src/lib/paperDoll/releaseContract.test.ts src/lib/paperDoll/releaseValidator.test.ts src/lib/paperDoll/sanityProjection.test.ts
deno test --allow-env supabase/functions/_shared/paperDollLifecycle.test.ts supabase/functions/_shared/paperDollComponentGeneration.test.ts
```

Expected: all PASS.

- [ ] **Step 2: Run build and database checks**

```bash
npm run build
npx supabase db lint --local
npx supabase test db --local
```

Expected: all PASS. If local Supabase is unavailable, report that exact environment
blocker and do not claim database verification.

- [ ] **Step 3: Rebuild the GPT shiny-gold candidate through the generic command**

Expected: exact alpha, placement `344 × 502`, five-body lineup, unchanged body SHAs,
and no Current Release/Supabase/Sanity mutation.

- [ ] **Step 4: Produce the inventory and assembly review**

Write ignored artifacts:

```text
outputs/paper-doll-component-factory/CYL-9ML/component-status.json
outputs/paper-doll-component-factory/CYL-9ML/assembly-matrix.json
outputs/paper-doll-component-factory/CYL-9ML/release-cut-dry-run.json
outputs/paper-doll-component-factory/CYL-9ML/sanity-draft-preview.json
```

Confirm 23 component rows, 145 mappings, and blockers only where real authority,
material, fit, or approval evidence is absent.

- [ ] **Step 5: Browser-verify the complete no-write workflow**

Verify inventory → component plate → candidate review → family fit → release cut →
Sanity projection. Confirm candidate generation and body switching do not disappear,
the canvas scrolls, names persist, and the public action remains disabled without a
second approval.

- [ ] **Step 6: Audit the worktree and commit verification fixes only**

```bash
git diff --check
git status --short
```

Do not stage the six pre-existing user-owned roller/image files. If code fixes were
required, stage only those exact paths and commit:

```bash
git commit -m "test(paper-doll): verify component factory lifecycle"
```

## Deployment boundary

Completion of this plan produces locally verified code and migrations. It does not
authorize remote migration application, Edge Function deployment, Current Release
advancement, Sanity draft mutation, or public publication. Perform each remote step
only after its local evidence passes and the user explicitly authorizes that named
action.
