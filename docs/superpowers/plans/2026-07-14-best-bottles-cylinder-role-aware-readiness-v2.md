# Best Bottles Cylinder Role-Aware Readiness V2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:test-driven-development while implementing each task. This plan is tightly coupled to the current shared worktree, so execute inline without switching branches or creating a worktree.

**Goal:** Publish a fail-closed public Cylinder readiness artifact that preserves immutable cap-on and PDP cap-off/sidecar references as separate semantic roles for all 377 canonical identities.

**Architecture:** Add a pure composer that joins the existing 377-row readiness artifact to the verified 228-row cap-on promotion and verified 228-row sidecar promotion by exact normalized Website + Grace SKU. Keep approved live-pointer and recovery evidence attached to blocked identities without promoting it. A small filesystem script verifies source hashes and writes the deterministic public artifact without mutating any source artifact or external system.

**Tech Stack:** TypeScript, Node test runner, `tsx`, SHA-256, JSON artifacts.

## Global Constraints

- Read `docs/best-bottles-canonical-truth/BEST-BOTTLES-CANONICAL-TRUTH.md` before any measurement or geometry work.
- Use only canonical geometry already present in the v1 readiness rows; never raw diameter or Convex width/depth.
- Preserve `identity-cap-on` and `pdp-cap-off-sidecar` as independent immutable roles and URLs.
- Never use the mutable current pipeline pointer as the sole role authority.
- Include all 377 exact dual-SKU identities; missing or contradictory role evidence remains blocked.
- Do not overwrite `public/data/best-bottles-cylinder-production-readiness.json`.
- Do not edit MastersTabPanel or its hook.
- Do not write to Supabase, Convex, Shopify, or any external system.
- Do not stage, commit, reset, switch branches, or discard unrelated work in the shared dirty worktree.

---

### Task 1: Pure role-aware readiness composer

**Files:**
- Create: `src/lib/bestBottlesCylinderRoleAwareReadiness.ts`
- Test: `src/lib/bestBottlesCylinderRoleAwareReadiness.test.ts`

**Interfaces:**
- Consumes: parsed v1 readiness, cap-on current promotion audit and execution, sidecar current preflight and execution, sidecar source manifest, live-pointer approval, recovery approval, and their file SHA-256 values.
- Produces: `composeCylinderRoleAwareReadiness(input)` and `BEST_BOTTLES_CYLINDER_ROLE_AWARE_READINESS_VERSION`.

- [ ] **Step 1: Write failing tests**

Test that the composer:

```ts
const artifact = composeCylinderRoleAwareReadiness(fixture());
assert.equal(artifact.rows[0].references.identityCapOn.roleId, "identity-cap-on");
assert.equal(artifact.rows[0].references.pdpCapOffSidecar.roleId, "pdp-cap-off-sidecar");
assert.notEqual(
  artifact.rows[0].references.identityCapOn.publicUrl,
  artifact.rows[0].references.pdpCapOffSidecar.publicUrl,
);
```

Also test that a missing role stays blocked, a vintage live-site exception requires explicit exception evidence, exact dual-SKU mismatches fail closed, and approved low-resolution evidence remains remediation evidence rather than becoming verified.

- [ ] **Step 2: Verify RED**

Run:

```bash
npx tsx --test src/lib/bestBottlesCylinderRoleAwareReadiness.test.ts
```

Expected: FAIL because the composer module does not exist.

- [ ] **Step 3: Implement the minimal composer**

Create explicit role objects:

```ts
references: {
  identityCapOn: {
    roleId: "identity-cap-on",
    status: "verified" | "blocked",
    publicUrl: string | null,
    storagePath: string | null,
    exportSha256: string | null,
    topology: "assembled-cap-on" | null,
    approvedException: null,
    blockers: string[],
  },
  pdpCapOffSidecar: {
    roleId: "pdp-cap-off-sidecar",
    status: "verified" | "blocked",
    publicUrl: string | null,
    storagePath: string | null,
    exportSha256: string | null,
    topology:
      | "fitment-attached-cap-right-sidecar"
      | "assembled-live-site-exception"
      | null,
    approvedException:
      | "live-site-vintage-bulb"
      | "live-site-genuine-two-piece"
      | null,
    blockers: string[],
  },
}
```

Join only by the canonical dual-SKU key, verify execution rows against their current audit rows and source manifests, attach source seals, omit absolute local paths, sort deterministically, and hash the unsigned artifact.

- [ ] **Step 4: Verify GREEN**

Run the same test command. Expected: PASS.

### Task 2: Public artifact builder and exact current counts

**Files:**
- Create: `scripts/best-bottles/build-cylinder-role-aware-readiness.ts`
- Create: `scripts/best-bottles/build-cylinder-role-aware-readiness.test.ts`
- Create: `public/data/best-bottles-cylinder-sidecar-promotion.json`

**Interfaces:**
- Consumes: the source files listed in Task 1 from their existing saved locations.
- Produces: `/data/best-bottles-cylinder-sidecar-promotion.json` with version `best-bottles-cylinder-role-aware-readiness-v2`.

- [ ] **Step 1: Write the failing artifact test**

Load the public artifact and assert:

```ts
assert.equal(artifact.rows.length, 377);
assert.equal(artifact.summary.identityCapOnVerifiedCount, 228);
assert.equal(artifact.summary.pdpCapOffSidecarVerifiedCount, 228);
assert.equal(artifact.summary.bothRolesVerifiedCount, 228);
assert.equal(artifact.summary.blockedIdentityCount, 149);
assert.equal(artifact.summary.standardSidecarCount, 201);
assert.equal(artifact.summary.liveSiteExceptionCount, 27);
```

Verify every verified role has an HTTPS URL, immutable storage path, SHA-256, no blockers, and a distinct semantic role. Verify the serialized public artifact contains no absolute local source paths.

- [ ] **Step 2: Verify RED**

Run:

```bash
npx tsx --test scripts/best-bottles/build-cylinder-role-aware-readiness.test.ts
```

Expected: FAIL because the public artifact does not exist.

- [ ] **Step 3: Implement and run the builder**

The script reads and hashes each source file, calls the pure composer, writes only the public JSON artifact, then reports summary counts. It performs no network calls or external writes.

Run:

```bash
npx tsx scripts/best-bottles/build-cylinder-role-aware-readiness.ts
```

- [ ] **Step 4: Verify GREEN and regression coverage**

Run:

```bash
npx tsx --test \
  src/lib/bestBottlesCylinderRoleAwareReadiness.test.ts \
  scripts/best-bottles/build-cylinder-role-aware-readiness.test.ts
```

Expected: PASS with exact current counts and no warnings.

