# Best Bottles Pilot Role Review V1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and execute a fail-closed, local-only, hash-addressed review artifact for the exact cap-on and cap-off-sidecar v3 pass-02 images of `GBCylBlu5SpryBlkSh|GB-CYL-BLU-5ML-SPR-SBLK`.

**Architecture:** A pure TypeScript library validates all seals, role continuity, image facts, framing QA, and current shadow QA, then constructs deterministic JSON and HTML. A thin Node CLI performs only local reads, hashing, Sharp decoding, current detector invocation, and atomic writes beneath the sealed run's `pilot-role-review-v1` directory.

**Tech Stack:** TypeScript, Node `crypto`/`fs`/`path`, Sharp, Node test runner through `tsx --test`.

## Global Constraints

- Do not mutate framing-recovery-v3 PNGs or recovery records.
- Write only beneath the selected sealed run directory's `pilot-role-review-v1` folder.
- No network, generation, upload, approval, promotion, deployment, Supabase, or Shopify operation.
- Machine pass is always `review-pending`, `humanVisualApproval: not-recorded`, and `promotionStatus: not-promoted`.
- Supporting screenshot evidence is metadata only: SHA-256 `e84f99572cded9a24efc9add7b6f7e402bd9c677532c3dc8438503d6c439126f`, `588 × 1280`, `supporting-identity-only`.
- Preserve the user's shared dirty worktree; do not stage or commit.

---

### Task 1: Pure sealed review builder

**Files:**
- Create: `src/lib/bestBottlesCylinderPilotRoleReview.ts`
- Test: `src/lib/bestBottlesCylinderPilotRoleReview.test.ts`

**Interfaces:**
- Consumes: `PilotRoleReviewBuildInput`, containing exact plan facts, compiled-job facts, two recovery-role facts, PNG proofs, recomputed contact bounds/shadow reports, and screenshot metadata.
- Produces: `buildCylinderPilotRoleReview(input): CylinderPilotRoleReviewArtifact` and `renderCylinderPilotRoleReviewHtml(artifact): string`.
- Produces constants `BEST_BOTTLES_CYLINDER_PILOT_ROLE_REVIEW_VERSION`, `PILOT_REVIEW_WEBSITE_SKU`, `PILOT_REVIEW_GRACE_SKU`, and `PILOT_SUPPORTING_IDENTITY_EVIDENCE`.

- [ ] **Step 1: Write the failing happy-path and manifest tests**

Create a complete two-role fixture. Assert role order, exact identity, all required hashes, PNG proof, framing/shadow QA, input-set SHA format, `machineStatus: pass`, `reviewStatus: review-pending`, `humanVisualApproval: not-recorded`, `promotionStatus: not-promoted`, and `externalWriteCount: 0`.

- [ ] **Step 2: Run the test and verify RED**

Run:

```text
npx tsx --test src/lib/bestBottlesCylinderPilotRoleReview.test.ts
```

Expected: module/function missing.

- [ ] **Step 3: Implement the minimal successful builder**

Define exact role/topology/job-type mappings:

```ts
const REQUIRED_ROLES = ["identity-cap-on", "pdp-cap-off-sidecar"] as const;
const ROLE_CONTRACT = {
  "identity-cap-on": { jobType: "assemble-cap-on-reference", topology: "assembled" },
  "pdp-cap-off-sidecar": { jobType: "preserve-cap-off-sidecar-reference", topology: "detached" },
} as const;
```

Build the canonical input envelope in required-role order, hash `JSON.stringify(envelope)`, and return the immutable non-promotion fields.

- [ ] **Step 4: Verify GREEN**

Run the focused test and require all happy-path assertions to pass.

- [ ] **Step 5: Add RED fail-closed tests one behavior at a time**

Add and observe failures for:

```text
mutated plan file hash
mutated job/record/output hash continuity
stale recomputed shadow report with status fail
identity-cap-on record crossed into sidecar role
non-opaque PNG proof
2079 × 2288 or 2080 × 2287 PNG proof
missing required role
duplicate required role
mutated screenshot metadata or promotable disposition
```

- [ ] **Step 6: Implement minimal validation for every RED case**

Validation must throw before constructing any artifact. Require pass 2 input hash to equal pass 1 output hash and actual pass-02 bytes hash to equal pass 2 output hash. Require current recomputed shadow status and every expected contact status to be `pass`.

- [ ] **Step 7: Add HTML rendering RED test**

Assert a two-column sheet, exact relative pass-02 links, dimensions/baseline/fill/center/topology/shadow-contact/warning text, and the banner `Machine pass — human visual review pending — not promoted`. Assert no approval claim and no screenshot path/image tag.

- [ ] **Step 8: Implement HTML renderer and verify GREEN**

Escape all displayed values and URL attributes. Render screenshot evidence as hash/dimensions/disposition text only.

### Task 2: Thin local-only CLI

**Files:**
- Create: `scripts/best-bottles/build-cylinder-pilot-role-review.ts`
- Test: `scripts/best-bottles/build-cylinder-pilot-role-review.test.ts`

**Interfaces:**
- Consumes CLI flags `--run-dir`, `--plan`, `--website-sku`, and `--grace-sku`; exact SKU values are required.
- Produces `buildCylinderPilotRoleReviewFromLocalFiles(options): Promise<{ outputDirectory; manifestPath; htmlPath; artifact }>` for tests and CLI `main()`.
- Uses the pure Task 1 functions unchanged.

- [ ] **Step 1: Write parser RED tests**

Assert missing flags, wrong identity, paths outside the expected remediation plan/run relationship, unknown flags, URL-like paths, and alternate modes are rejected.

- [ ] **Step 2: Implement strict parser and verify GREEN**

The CLI has no mode flag and no remote fallback. Resolve paths locally and require the plan's semantic SHA to equal the sealed run ancestor.

- [ ] **Step 3: Write filesystem integration RED test**

Build a temporary sealed run containing a sealed plan, two compiled jobs, two complete recovery records, and two real Sharp-generated `2080 × 2288` opaque PNGs with valid model-owned shadows. Assert output is created only at:

```text
<run-dir>/pilot-role-review-v1/<input-set-sha256>/pilot-role-review.json
<run-dir>/pilot-role-review-v1/<input-set-sha256>/index.html
```

Capture source hashes before and after and assert no source mutation.

- [ ] **Step 4: Implement local input loading and current detector recomputation**

Hash raw plan, compiled-job, recovery-record, and PNG bytes. Decode each PNG through Sharp with alpha, prove opacity by scanning alpha bytes, derive role topology/contact bounds, and invoke `analyzeModelOwnedShadow` on current code.

- [ ] **Step 5: Validate completely before writing**

Call the pure builder and renderer before `mkdir`. If the addressed directory exists, compare exact existing JSON/HTML bytes and reject any mismatch. Otherwise create only that directory and write both files.

- [ ] **Step 6: Add and pass integration failures**

Mutate, one at a time, the semantic plan while refreshing its mutable file SHA, actual compiled prompt text, coordinated canonical/source/reference declarations, actual PNG bytes/hash, record/job role, opacity, dimensions, and role presence. Assert rejection and absence of `pilot-role-review-v1` output. Directly hash the local approved-reference locator bytes; if the sealed source-lineage SHA has no separate byte locator, record that limitation explicitly and anchor it to the recomputed semantic plan rather than claiming direct-byte verification.

### Task 3: Actual immutable pilot and closeout

**Files:**
- Create: `.superpowers/sdd/task-6-pilot-review-artifact-report.md`
- Generate under `tmp`: `pilot-role-review-v1/<input-set-sha256>/pilot-role-review.json`
- Generate under `tmp`: `pilot-role-review-v1/<input-set-sha256>/index.html`

**Interfaces:**
- Consumes: the exact existing sealed plan and execute-local-only run.
- Produces: a machine-pass/human-review-pending local artifact and durable implementation report.

- [ ] **Step 1: Run focused tests**

```text
npx tsx --test \
  src/lib/bestBottlesCylinderPilotRoleReview.test.ts \
  scripts/best-bottles/build-cylinder-pilot-role-review.test.ts \
  src/lib/product-image/shadowQa.test.ts \
  src/lib/product-image/rigPostprocess.test.ts
```

- [ ] **Step 2: Execute the exact local pilot CLI**

```text
npx tsx scripts/best-bottles/build-cylinder-pilot-role-review.ts \
  --plan tmp/best-bottles-reference-production/cylinder-dual-role-remediation-v2/cylinder-dual-role-remediation-plan.json \
  --run-dir tmp/best-bottles-reference-production/cylinder-dual-role-remediation-v2/runs/411f34e80f7762da48859ad7cf7056f1668055c929aebac00012ff2031ac4d35/execute-local-only-304a29d863ee1e5a \
  --website-sku GBCylBlu5SpryBlkSh \
  --grace-sku GB-CYL-BLU-5ML-SPR-SBLK
```

Expected: one hash-addressed local directory, both roles machine-pass, human review pending, not promoted.

- [ ] **Step 3: Verify immutability and artifact integrity**

Re-hash the two v3 pass-02 PNGs and recovery records, compare them with pre-run hashes, parse the manifest, verify its input-set address equals its directory, and confirm HTML links resolve to the actual PNGs.

- [ ] **Step 4: Run static verification**

```text
npx tsc --noEmit
git diff --check -- \
  src/lib/bestBottlesCylinderPilotRoleReview.ts \
  src/lib/bestBottlesCylinderPilotRoleReview.test.ts \
  scripts/best-bottles/build-cylinder-pilot-role-review.ts \
  scripts/best-bottles/build-cylinder-pilot-role-review.test.ts \
  docs/superpowers/specs/2026-07-14-best-bottles-pilot-role-review-v1-design.md \
  docs/superpowers/plans/2026-07-14-best-bottles-pilot-role-review-v1.md \
  .superpowers/sdd/task-6-pilot-review-artifact-report.md
```

- [ ] **Step 5: Write the report**

Record RED evidence, implementation, exact input/output hashes, decoded image proof, both framing/shadow results and warnings, artifact path/hash, source immutability hashes, verification commands, and zero external effects. State explicitly that human visual approval is not recorded.
