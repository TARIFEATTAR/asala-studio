# Best Bottles Cylinder Dual-Role Remediation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every evidence-supported Cylinder identity retain an immutable cap-on identity reference and, where its physical topology permits, an independently reviewed cap-off sidecar reference without weakening evidence or publish gates.

**Architecture:** A pure, taxonomy-aware queue composer is the authority for remediation routing. It consumes the existing 377-row role-aware artifact, exact approval artifacts, and taxonomy overrides; emits a sealed plan; and never performs remote writes. Local runners consume only sealed role jobs, keep outputs `review-pending`, and independent promotion gates publish hash-addressed cap-on and sidecar references only after review.

**Tech Stack:** TypeScript, Node test runner through `tsx --test`, Sharp for opaque PNG verification, existing OpenAI image-edit runner, Supabase immutable object storage.

## Global Constraints

- Read `docs/best-bottles-canonical-truth/BEST-BOTTLES-CANONICAL-TRUTH.md` in full before measurement or geometry work.
- Consume only `canon_*` geometry values; body geometry keys on family × size, while assembled height remains variant-specific.
- Reference roles are exactly `identity-cap-on` and `pdp-cap-off-sidecar`; they must never share a mutable pointer or be treated as interchangeable.
- Use only flattened opaque/original-background PNG references. The retired transparent-reference cutover must not run.
- Preserve exact Website SKU + Grace SKU identity. No sibling substitution, inferred identity, or invented hidden topology.
- Raw generation output is 2080 × 2288. Paper-doll canvas remains 1000 × 1300.
- Vintage bulb and genuine two-piece products use an explicit topology exception; assembled-only evidence must never be converted into an invented detached sidecar.
- Generated outputs remain local and `review-pending` until explicit review. No job linking, reconciliation promotion, Shopify write, or publish is authorized by remediation.
- Current taxonomy is 375 Cylinder identities plus two Vial handoffs. The queue must preserve 11 true Cylinder evidence blockers.

---

### Task 1: Sealed taxonomy-aware dual-role queue

**Files:**
- Create: `src/lib/bestBottlesCylinderDualRoleRemediation.ts`
- Create: `src/lib/bestBottlesCylinderDualRoleRemediation.test.ts`
- Create: `scripts/best-bottles/build-cylinder-dual-role-remediation.ts`
- Create: `tmp/best-bottles-reference-production/cylinder-dual-role-remediation-v2/cylinder-dual-role-remediation-plan.json`

**Interfaces:**
- Consumes: `CylinderRoleAwareReadinessArtifact`, recovery approval decisions, live-pointer approval decisions, and taxonomy overrides.
- Produces: `buildCylinderDualRoleRemediationPlan(input): CylinderDualRoleRemediationPlan` and a stable SHA-256-sealed artifact.

- [x] **Step 1: Write the failing tests**

  Tests must import the missing composer and assert exact artifact-wide partitions: 377 source rows; 375 Cylinder rows; two Vial handoffs; 172 strict-ready; 56 current raw-live-sidecar remediation; 123 approved detached-evidence dual-role remediation; 13 topology exceptions; 11 hard blockers. Assert every identity occurs exactly once, exact dual identities match normalized keys, approved evidence lanes do not overlap, the two Vial handoffs are exactly `GB09BlackCapApp|GB-CYL-CLR-9ML-T-01` and `GB09BlackCapSht|GB-CYL-CLR-9ML-S-01`, and all hard blockers have no role job. Negative cases must reject altered Vial identities, rejected/substituted approval decisions, transparent/non-opaque evidence, or contradictory embedded taxonomy.

- [x] **Step 2: Run the tests and verify RED**

  Run: `npx tsx --test src/lib/bestBottlesCylinderDualRoleRemediation.test.ts`

  Expected: failure because `bestBottlesCylinderDualRoleRemediation` does not exist.

- [x] **Step 3: Implement the pure composer**

  Define exclusive routes:

  ```ts
  type CylinderDualRoleRoute =
    | "strict-both-roles-ready"
    | "remediate-current-live-sidecar"
    | "approved-detached-dual-role"
    | "approved-topology-exception"
    | "hard-blocked-no-evidence"
    | "routed-to-vial";
  ```

  Detached evidence produces two jobs: `assemble-cap-on-reference` and `preserve-cap-off-sidecar-reference`. Topology exceptions produce two independent role jobs from the same approved assembled evidence: `preserve-cap-on-reference` targets `identity-cap-on`, while `preserve-assembled-topology-exception` targets `pdp-cap-off-sidecar`. Hard blockers and Vial handoffs produce no Cylinder role jobs. Validate the exact Vial identities, approval semantics, opacity/original-background eligibility, input counts, and canonical taxonomy before returning, then compute the seal from stable JSON excluding `sha256`. The expected role-job count is 328.

- [x] **Step 4: Run tests and verify GREEN**

  Run: `npx tsx --test src/lib/bestBottlesCylinderDualRoleRemediation.test.ts`

  Expected: all tests pass.

- [x] **Step 5: Build and verify the artifact**

  Run: `npx tsx scripts/best-bottles/build-cylinder-dual-role-remediation.ts`

  Expected: an opaque, read-only plan artifact reporting the exact Task 1 partition and `externalWriteCount: 0`.

### Task 2: Bounded local role-remediation runner

**Files:**
- Create: `src/lib/bestBottlesCylinderDualRoleRunner.ts`
- Create: `src/lib/bestBottlesCylinderDualRoleRunner.test.ts`
- Create: `scripts/best-bottles/run-cylinder-dual-role-remediation.ts`

**Interfaces:**
- Consumes: the sealed Task 1 plan plus an explicit route/cohort/allowlist.
- Produces: role-specific prompt records, local 2080 × 2288 opaque PNG candidates, and resumable result records keyed by plan SHA, exact identity, role, source SHA, prompt SHA, and canonical-geometry SHA.

- [x] **Step 1: Write failing runner contract tests**

  Assert compile-only is the default; `--execute` without an explicit route and bounded `--count` fails; `--execute --all` fails; assembled-only evidence cannot request `pdp-cap-off-sidecar`; stale resume metadata fails; and successful output state is only `rendered-review-pending` or `skipped-existing-review-pending`.

- [x] **Step 2: Run tests and verify RED**

  Run: `npx tsx --test src/lib/bestBottlesCylinderDualRoleRunner.test.ts`

  Expected: failure because the runner contract does not exist.

- [x] **Step 3: Implement the minimal runner contract and CLI**

  The CLI may write only under `tmp/best-bottles-reference-production/cylinder-dual-role-remediation-v2/runs/`. It must not import Supabase or Shopify clients. Compile role-specific prompts from canonical geometry and preserve the source evidence hash in every result.

- [x] **Step 4: Run tests and the complete compile-only preflight**

  Run: `npx tsx --test src/lib/bestBottlesCylinderDualRoleRunner.test.ts`

  Run: `npx tsx scripts/best-bottles/run-cylinder-dual-role-remediation.ts --all`

  Expected: every non-blocked queued role compiles, no output is promoted, and external write count remains zero.

- [x] **Step 5: Recover framing failures without another model call**

  Add a bounded local-only geometry recanvas that consumes only hash-verified `failed-framing` output, preserves the raw PNG, runs the existing family-rig normalization for at most two passes, and accepts only an opaque 2080 × 2288 output whose framing decision passes. Detached sidecars use primary-bottle centerline plus the shared group baseline; no cap bounding box is introduced. Store raw/normalized hashes, every transform, and final QA under the sealed run directory. No paint-after prompt, generation call, upload, or promotion is allowed.

### Task 3: One authority for Studio and batch generation

**Files:**
- Modify: `src/hooks/useBestBottlesCylinderProductionReadiness.ts`
- Modify: `scripts/best-bottles/generate-family-batch.ts`
- Modify: `src/lib/bestBottlesCylinderSidecarReconciliation.ts`
- Modify: `supabase/functions/_shared/bestBottlesRenderingContract.ts`
- Test: corresponding existing `.test.ts` files plus new focused cases.

**Interfaces:**
- Consumes: reviewed immutable role promotions rebuilt into the role-aware readiness artifact.
- Produces: identical reference-role selection and canonical geometry in Studio, CLI, and server generation.

- [x] **Step 1: Write failing convergence tests**

  Assert Studio and CLI resolve the same exact role URL/hash; raw `exact-live-pdp-sidecar` remains rejected; reviewed remediation is accepted; and server rendering rejects Convex geometry that conflicts with the caller's sealed canonical geometry.

- [x] **Step 2: Run tests and verify RED**

  Run focused tests for the four files and confirm failures describe the current divergent authority.

- [x] **Step 3: Implement convergence without weakening guards**

  Replace hard-coded 377/228/149 checks with artifact-derived validated totals. Add a reviewed-remediation route to sidecar authority. Make the family batch use the exact immutable role selected by the role-aware artifact. Preserve sealed canonical geometry server-side rather than replacing it with Convex-derived values.

- [x] **Step 4: Run focused and project verification**

  Run focused tests, `npx tsc --noEmit`, and `npm run build:dev`.

### Task 4: Independent role promotion and Shopify write hardening

**Files:**
- Create role-promotion tests and implementation beside `promote-cylinder-sidecar-references.ts` and `promote-cylinder-production-references.ts`.
- Modify: `supabase/functions/push-shopify-product-images/index.ts`

**Interfaces:**
- Consumes: explicitly reviewed role candidates with exact identity, role, source hash, output hash, and canonical-geometry hash.
- Produces: immutable hash-addressed role URLs and a rebuilt role-aware artifact; Shopify accepts only an exact `approved-keep` generated job after explicit publish approval.

- [x] **Step 1: Write failing promotion and Shopify-guard tests**

  Assert role promotions cannot overwrite existing paths, cannot promote `review-pending`, cannot cross role IDs, and Shopify rejects arbitrary public URLs or images without exact approved job identity.

- [x] **Step 2: Run tests and verify RED**

  Run the new promotion tests and the Shopify edge tests.

- [x] **Step 3: Implement independent immutable promotion and server-side Shopify guard**

  Promotion writes remain opt-in with `--execute`; default is dry-run. The Shopify edge function must verify exact organization, job, product identity, generated image ID, `approved-keep` review status, and explicit publish authorization before writing.

- [x] **Step 4: Run full completion audit**

  Run targeted tests, typecheck, build, role artifact verification, and browser verification for representative cap-on, sidecar, topology-exception, and blocked identities. Report ready and blocked counts without publishing.

### Task 5: Detached-sidecar shadow detector calibration

**Files:**
- Modify: `src/lib/product-image/rigPostprocess.ts`
- Modify: `src/lib/product-image/rigPostprocess.test.ts`
- Modify: `src/lib/product-image/shadowQa.ts`
- Modify: `src/lib/product-image/shadowQa.test.ts`
- Record: `.superpowers/sdd/task-5-shadow-detector-report.md`

**Interfaces:**
- Consumes: the existing hash-sealed local framing-recovery PNG and its detached-sidecar topology.
- Produces: fail-closed bottle and sidecar shadow QA that distinguishes physical contacts from faint floor bridges and insignificant background specks without weakening missing-contact, double-shadow, gap, floor-seam, or overlong-tail rejection.

- [x] **Step 1: Reproduce the real false failure and write RED regressions**

  Cover floor-lane contact merging, nearby multi-contact lane overlap, tiny disconnected specks, and a connected but non-meaningful continuation fringe. Preserve the existing non-waivable shadow failures.

- [x] **Step 2: Implement the narrow detector correction**

  Segment physical objects above the governed shadow lane, partition multi-contact QA lanes, retain every candidate pixel for conservative geometry masking, and count/extend depth only for meaningful components.

- [x] **Step 3: Verify the real v3 pilot locally**

  The existing sidecar candidate resolves separate bottle and sidecar bounds, one meaningful contact shadow per object, and a passing machine shadow report. The workflow remains `normalized-review-pending`, `review-pending`, `not-promoted`, with `externalWriteCount: 0`.

- [x] **Step 4: Independent fail-closed review**

  Independent review reproduced the real-candidate result, confirmed 84/84 focused tests plus TypeScript and scoped diff checks, and verified that missing sidecar shadow, true multiple shadows, contact gap, floor seam, and overlong tail still fail.
