# Best Bottles pilot role review v1 design

## Objective

Create a deterministic, local-only review artifact for the exact Best Bottles identity `GBCylBlu5SpryBlkSh|GB-CYL-BLU-5ML-SPR-SBLK`. The artifact re-evaluates the two immutable framing-recovery-v3 pass-02 PNGs with the current shadow detector without changing those PNGs or their stale recovery records.

Machine acceptance means only `review-pending`. The workflow cannot record human approval or promotion.

## Immutable inputs

The builder consumes these existing local inputs:

- the sealed dual-role remediation plan and its exact bytes;
- the execute-local-only `compiled-jobs.json` and its two exact role jobs;
- the two framing-recovery-v3 `recovery-record.json` files;
- the two corresponding pass-02 PNGs;
- the current `detectModelShadowContactBounds` and `analyzeModelOwnedShadow` results;
- supporting phone screenshot metadata supplied by the user: SHA-256 `e84f99572cded9a24efc9add7b6f7e402bd9c677532c3dc8438503d6c439126f`, width `588`, height `1280`, disposition `supporting-identity-only`.

The phone screenshot is metadata only. The workflow does not copy it, link it as production evidence, or treat it as reference authority.

## Architecture

`src/lib/bestBottlesCylinderPilotRoleReview.ts` is the pure authority. It recomputes the semantic plan seal from the full plan document, derives canonical geometry from the exact sealed row, hashes actual compiled prompt text, and validates exact identity, exact two-role membership, role/job/record alignment, decoded PNG facts, framing QA, and freshly recomputed shadow QA. It then creates a deterministic manifest model, calculates its input-set SHA-256, and renders an HTML review sheet from that validated model.

`scripts/best-bottles/build-cylinder-pilot-role-review.ts` is a thin Node CLI. It accepts only the expected local run directory and identity, reads files, hashes bytes, directly verifies the approved reference locator, decodes PNGs with Sharp, invokes the current shadow detector, calls the pure builder, and writes a new `pilot-role-review-v1/<input-set-sha256>/` directory. It never invokes network, generation, upload, approval, or promotion code.

The output directory contains:

- `pilot-role-review.json`, the machine-readable manifest;
- `index.html`, the local side-by-side review sheet.

The HTML links by relative path to the two existing v3 pass-02 PNGs. It does not copy image bytes.

## Hash address

The address is the SHA-256 of a canonical JSON input-set envelope containing:

- workflow version and exact dual identity;
- sealed plan SHA and plan-file SHA;
- compiled-jobs file SHA;
- both role job identifiers and authority hashes;
- both recovery-record file hashes;
- both pass-02 byte hashes and decoded image facts;
- framing QA and freshly recomputed shadow QA;
- the fixed supporting screenshot metadata.

Object keys are serialized in a fixed construction order and role entries are ordered `identity-cap-on`, then `pdp-cap-off-sidecar`. The address is not a self-hash of the final manifest.

## Fail-closed validation

The pure builder rejects before any write when:

- the plan bytes do not match the plan file SHA, the semantic plan SHA does not recompute from the full plan document, or the recomputed SHA does not equal the sealed run directory;
- the compiled jobs contain neither or more than the exact two required roles for the identity;
- a job, record, or PNG crosses roles or identities;
- source or reference declarations disagree with the exact recomputed sealed-plan row;
- actual approved-reference locator bytes disagree with the reference SHA;
- actual compiled prompt text disagrees with the prompt SHA;
- canonical geometry recomputed from the sealed-plan row disagrees with either role declaration;
- input or output hashes disagree;
- a pass-02 PNG byte hash differs from the recovery record;
- decoded PNG dimensions are not exactly `2080 × 2288` or any pixel is non-opaque;
- framing QA or framing decision does not pass;
- freshly recomputed shadow QA differs from the supplied recomputation envelope or does not pass;
- either required role is absent;
- the supporting screenshot metadata differs from the fixed non-authoritative evidence contract.

The CLI validates the complete model before creating its output directory. If the addressed directory already exists, it permits only byte-identical JSON and HTML; any mismatch fails closed.

## Manifest semantics

Each role records exact website and Grace SKU, role, topology, job ID and job type, source/reference/prompt/canonical-geometry/input/output hashes, actual approved-reference byte hash, evidence locator and verification semantics, PNG width/height/opacity proof, framing QA, recomputed shadow QA, warnings, and its existing relative PNG path. The local reference locator bytes are directly hashed. The earlier source lineage SHA has no separate local byte locator, so it is explicitly identified as anchored to the recomputed sealed-plan semantic SHA rather than misrepresented as a direct byte check.

The top level records:

- `workflowVersion: best-bottles-cylinder-pilot-role-review-v1`;
- `machineStatus: pass` only when both exact roles pass all checks;
- `reviewStatus: review-pending`;
- `humanVisualApproval: not-recorded`;
- `promotionStatus: not-promoted`;
- `externalWriteCount: 0`;
- the input-set SHA-256 and supporting screenshot metadata.

No field may imply approval or promotability.

## Review sheet

The HTML presents the cap-on and cap-off-sidecar images side by side. Each role shows exact identity, dimensions, opacity, baseline and target baseline, fill percentage, center percentage/delta, topology, shadow contacts, component count, depth, failures, and warnings. A persistent banner states `Machine pass — human visual review pending — not promoted`.

## Testing

Tests exercise the pure builder with real-shaped fixtures and the CLI with temporary local files. Required fail-closed cases include a semantic plan mutation with a refreshed mutable file SHA, prompt text-only mutation, coordinated canonical/source/reference declaration mutation, mutated record/PNG hashes, stale supplied detector output, role crossing or absence, actual non-opaque PNG bytes, and wrong decoded dimensions. Rendering tests assert actual v3 relative image links and the non-approval banner. The successful CLI integration test proves only the hash-addressed local directory is written and the source v3 files remain byte-identical.

## Safety

The workflow's only write boundary is beneath the supplied sealed run directory's `pilot-role-review-v1` folder. There are no remote modes, URLs, credentials, generation calls, uploads, approval writes, or promotion calls.
