# Task 2 report — bounded local Cylinder dual-role remediation runner

Status: PASS

Implemented only the three Task 2 source files, this report, and local compile artifacts beneath the authorized Task 2 runs root. No files were staged or committed. No Supabase or Shopify client is imported, no remote persistence path exists, and no external writes were performed.

## Delivered contract

- Default mode is compile-only.
- `--execute` requires an explicit route, cohort, or allowlist plus a positive `--count` capped at 8.
- `--execute --all` is forbidden; `--all` is compile-only.
- The CLI reads only the sealed Task 1 plan and explicit CLI selectors. Before selection it verifies both:
  - artifact file SHA-256 `6d9c40b786defe0e34ea6163bfebbda6d9a70bcb0b1e41c28c07a716e4f0f332`;
  - semantic Task 1 plan seal `411f34e80f7762da48859ad7cf7056f1668055c929aebac00012ff2031ac4d35`, recomputed from stable JSON excluding `sha256`.
- Every compiled role record carries exact Website SKU + Grace SKU identity, canonical identity key, role, job ID/type, Task 1 plan SHA, sealed source SHA (including an exact `null` when Task 1 has none), reference SHA, prompt SHA or deterministic-operation SHA, and canonical-geometry SHA.
- Canonical-geometry SHA is computed only from the four canonical geometry fields: body height, assembled height, width axis, and second axis.
- Resume compares job ID, exact dual identity, role/job type, plan SHA, source/reference SHA, prompt/operation SHA, and canonical-geometry SHA. Any mismatch fails as stale metadata; an untracked existing output is not resumed.
- Ordinary assembled-only evidence is rejected for `pdp-cap-off-sidecar`. The sealed `preserve-assembled-topology-exception` job is allowed only on the approved topology-exception route and remains explicitly labeled as an assembled live-site exception.
- Assembly, cap-on preservation, cap-off sidecar preservation, and assembled-topology-exception prompts have distinct role addenda layered onto the existing V6.1 prompt preflight output.
- Exact-size 2080x2288 topology evidence may use a SHA-sealed byte-copy operation. Lower-resolution evidence is never silently upscaled or recanvased; it compiles a V6.1 preservation prompt instead.
- Successful local output status can only be `rendered-review-pending` or `skipped-existing-review-pending`. Candidate bytes must be PNG, exactly 2080x2288, and fully opaque before either status is emitted.
- All writes are constrained beneath:

  ```text
  tmp/best-bottles-reference-production/cylinder-dual-role-remediation-v2/runs/
  ```

## TDD evidence

### Initial runner RED

```sh
npx tsx --test src/lib/bestBottlesCylinderDualRoleRunner.test.ts
```

Exit 1 with expected `ERR_MODULE_NOT_FOUND` for `bestBottlesCylinderDualRoleRunner`.

### Pure runner GREEN

The focused test reached 5/5 passing after the minimal pure contract was implemented.

### CLI pixel-gate RED/GREEN

Adding the real PNG validator test first produced the expected missing CLI-module failure. After the CLI implementation, the focused suite passed 6/6, including opaque, transparent, and legacy-size Sharp fixtures.

### Self-review refinement RED/GREEN

A regression test then failed because a sealed `null` source SHA was being replaced with the reference SHA. The implementation now preserves the exact Task 1 value and compiles low-resolution topology preservation as a role-specific prompt; the suite passed 7/7.

### Idempotent compile-record RED/GREEN

The final regression first failed because the record-directory replacement export did not exist. The implementation now replaces stale prompt/operation records without deleting outputs; the suite passed 8/8.

## Complete compile-only preflight

Command:

```sh
npx tsx scripts/best-bottles/run-cylinder-dual-role-remediation.ts --all
```

Result: exit 0.

- selected jobs: 328
- compiled jobs: 328
- prompt jobs: 328
- deterministic copy jobs for the current sealed artifact: 0
- rendered outputs: 0
- skipped existing outputs: 0
- failed jobs: 0
- external generation calls: 0
- Supabase writes: 0
- Shopify writes: 0
- remote persistence writes: 0
- total external writes: 0

Compile artifact:

```text
tmp/best-bottles-reference-production/cylinder-dual-role-remediation-v2/runs/411f34e80f7762da48859ad7cf7056f1668055c929aebac00012ff2031ac4d35/compile-all/
```

The compile root contains 328 prompt JSON records, zero operation records, zero output PNGs, `compiled-jobs.json`, and `summary.json`.

## Verification

The focused artifact audit confirmed:

- 328 records / 328 unique job IDs;
- every record has exact dual identity, role, plan SHA, reference SHA, canonical-geometry SHA, and exactly one prompt/operation SHA;
- zero cap-on assembly prompts contain the cap-off-sidecar preservation directive;
- zero cap-off-sidecar prompts contain the cap-on assembly directive;
- `externalWriteCount: 0`.

Final verification commands are recorded from a fresh run after this report update:

```sh
npx tsx --test src/lib/bestBottlesCylinderDualRoleRunner.test.ts
npx tsx scripts/best-bottles/run-cylinder-dual-role-remediation.ts --all
npx tsc --noEmit
git diff --check -- src/lib/bestBottlesCylinderDualRoleRunner.ts src/lib/bestBottlesCylinderDualRoleRunner.test.ts scripts/best-bottles/run-cylinder-dual-role-remediation.ts .superpowers/sdd/task-2-report.md
```

## Material-truth review fix

Status: PASS. This section supersedes the earlier prompt-provenance details while retaining the same sealed Task 1 plan and 328-job partition.

### Root cause and correction

The first runner version built an underspecified preflight product from the two SKUs and sealed geometry. That caused `GBCylBlu5SpryBlkSh` / `GB-CYL-BLU-5ML-SPR-SBLK` to compile clear-glass V6.1 language even though canonical product truth is `Cobalt Blue` / `Glass` / `Cobalt`.

The runner now reads and SHA-verifies:

```text
docs/best-bottles-canonical-truth/best-bottles-master-truth.csv
f2b25bbe4ffe51a3cc98a1b392fb73b4a5715a9c0e911ef2bb672d3e9e0f72c7
```

For every selected Task 1 row it:

- requires exactly one normalized Website SKU + Grace SKU master row;
- distinguishes missing truth from a near/wrong dual identity and rejects duplicates;
- compares all four canonical geometry values exactly with the sealed Task 1 row;
- passes exact `itemName`, `color`, `material`, `glassFinish`, `applicator`, `capStyle`, `capColor`, `trimColor`, category, collection, family, and capacity into V6.1 preflight;
- resolves prompt material only from those canonical fields, never from SKU text;
- seals the canonical truth file SHA and stable full-record SHA into every compiled job;
- includes both hashes in resume compatibility, with a run-level canonical-file SHA gate;
- binds the sealed approved reference SHA as topology evidence when an approved topology-exception product requires multi-component preflight.

The cap-on assembly addendum now states the single narrow exception to the generic preservation language: seating the exact approved detached cap is the only authorized positional change. All other identity, component count/relationship, geometry, material, and finish constraints remain locked.

### Review-fix TDD evidence

Initial expanded RED produced 6 failing focused tests covering missing truth hashes, missing/duplicate/wrong identity handling, canonical geometry mismatch, clear-glass cobalt output, and the missing cap-seating exception.

Additional integration RED/GREEN cycles covered:

- exact canonical CSV file-hash validation and RFC-4180-compatible parsing;
- ignoring unrelated incomplete master rows while still requiring selected exact identities;
- binding sealed topology evidence for exact antique/multi-component product truth.

Final focused result:

```text
14 tests, 14 passed, 0 failed
```

### Rebuilt complete preflight

The same command remains the full compile-only preflight:

```sh
npx tsx scripts/best-bottles/run-cylinder-dual-role-remediation.ts --all
```

Final result:

- Task 1 plan file SHA: `6d9c40b786defe0e34ea6163bfebbda6d9a70bcb0b1e41c28c07a716e4f0f332`
- Task 1 semantic plan SHA: `411f34e80f7762da48859ad7cf7056f1668055c929aebac00012ff2031ac4d35`
- canonical product-truth file SHA: `f2b25bbe4ffe51a3cc98a1b392fb73b4a5715a9c0e911ef2bb672d3e9e0f72c7`
- selected/compiled jobs: `328 / 328`
- queued exact identities: `192`
- prompt records: `328`
- failures, outputs, generation calls, and external writes: `0`

Artifact audit found 328 unique job IDs, zero missing/invalid truth or geometry hashes, and zero per-identity truth-hash conflicts. Both compiled cobalt role jobs contain `cobalt glass` and `Cobalt Blue` and contain no `clear glass`. All 123 cap-on assembly jobs contain the narrow authorized cap-seating exception. No Supabase or Shopify client is imported.

## Mandatory family-rig framing gate

Status: PASS. This section supersedes the earlier output-validation description: PNG format, dimensions, and opacity are necessary but no longer sufficient for a successful/review-pending result.

### Root cause and correction

The controlled 5 mL cobalt pilot exposed that the runner accepted locally rendered candidates before applying the app family-rig framing contract. Both candidates were valid opaque 2080x2288 PNGs but were materially oversized and above the shared baseline.

The runner now requires exact canonical product truth and the compiled role for every candidate validation, then:

- resolves the existing family rig with `getFamilyRigForProduct`;
- reads opaque RGBA pixels through Sharp without modifying the candidate file;
- performs analysis-only background flattening against Best Bottles Bone `#F5F3EF` and calls `detectStrongBounds`;
- calls `buildFramingQaReport` with the exact role cap state;
- allows success construction only when the framing report is not `fail`;
- persists framing failures as `failed-framing` / `framing-rejected`, including the report and candidate SHA;
- retains the original candidate PNG for evidence and performs no scale, recanvas, shadow, or paint-after normalization.

Detached sidecar validation deliberately supplies the complete-product envelope as `bounds` for fill height and the shared baseline, supplies `primaryBounds: null`, and does not synthesize a cap box. Therefore centerline remains unavailable and is recorded as the existing detached-topology warning rather than a failure.

### Framing-gate TDD evidence

The focused RED run produced four framing-related failures before implementation: missing family-rig validation, success-state acceptance without framing approval, failure to reject the oversized pilot reproduction, and incorrect detached semantics. After implementing the minimal gate, the focused suite passed:

```text
16 tests, 16 passed, 0 failed
```

Coverage includes a compliant 5 mL cobalt cap-on fixture, an oversized/off-baseline cap-on fixture, detached complete-product fill/baseline behavior with no primary centerline, exact truth binding, and success-state gating.

### Pilot invalidation with evidence retention

The sealed pilot run was revalidated through the explicit local-only `--revalidate-stored-run` path. That path cannot read an OpenAI key or call generation; it verifies the sealed plan, canonical truth, compiled jobs, resume hashes, and existing output hashes before atomically updating local JSON records.

Run directory:

```text
tmp/best-bottles-reference-production/cylinder-dual-role-remediation-v2/runs/411f34e80f7762da48859ad7cf7056f1668055c929aebac00012ff2031ac4d35/execute-local-only-304a29d863ee1e5a/
```

Current result audit:

- cap-on: `failed-framing` / `framing-rejected`; fill `75.6%`, baseline `1984` (`-98px` from `2082`), center `56%` (`+6%`); retained SHA `02c4c45c86c71df3ac9bb5b64796d363d8eb62e10b852c94db94a5af6c108406`;
- cap-off sidecar: `failed-framing` / `framing-rejected`; complete-product fill `77%`, shared baseline `1940` (`-142px` from `2082`), center unavailable with the expected warning; retained SHA `b1f46613ad54d2ebf68d6d0a755d4b66ce15eddee4763fe7e03cfab3bcb7f8a0`;
- current success/review-pending results: `0`;
- current framing failures: `2`;
- generation calls during revalidation: `0`;
- output PNGs retained: `2 / 2`, with hashes unchanged;
- external writes: `0`.

The `externalGenerationCallCount: 2` retained in the summary is the historical count from the original controlled pilot. `latestOperationExternalGenerationCallCount: 0` records that invalidation/revalidation made no new paid call.

### Final framing verification

```sh
npx tsx --test src/lib/bestBottlesCylinderDualRoleRunner.test.ts
npx tsc --noEmit
npx tsx scripts/best-bottles/run-cylinder-dual-role-remediation.ts --all
```

Results: focused tests `16/16`, TypeScript exit `0`, and compile-only preflight `328/328` with zero failures, generation calls, or external writes. The two pilot PNGs remain local evidence and neither pilot result claims success or review-pending status.

## Resume SHA integrity follow-up

Status: PASS. Review identified that the normal `--execute` resume framing-error branch returned a newly calculated `failed-framing` result before comparing the candidate SHA with the stored result SHA. A locally changed PNG that still failed framing could therefore be silently adopted, while the dedicated stored-run revalidation path correctly rejected the same mismatch.

Two regression tests reproduced the issue first:

- changed framing-failed PNG with a prior successful result;
- changed framing-failed PNG with a prior `failed-framing` result.

Both RED tests failed with `Missing expected rejection`. The minimal correction applies the existing stale-output comparison inside the normal resume `CylinderDualRoleFramingError` branch before constructing a failure result. Both cases now throw `Stale resume metadata ... output SHA changed.` No generation path is reached.

Final focused result after this correction:

```text
18 tests, 18 passed, 0 failed
```

`npx tsc --noEmit` and the scoped `git diff --check` also pass. This follow-up made no paid calls, no external writes, and no changes to retained pilot evidence.
