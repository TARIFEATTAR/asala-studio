# CYL-9ML Production Run 001 — Plastic Roller

Status: registered in private approved storage and immutable ledger

Date: 2026-08-02

Operator/approval authority: Jordan (`component-registry.json`)

Release publication: blocked; no Sanity write

## Purpose

Prove one complete, repeatable component intake loop before packaging it as an agent skill:

1. verify a named-review-approved source;
2. normalize it to the 2080×2288 release canvas with the shared 17-415 placement recipe;
3. derive an authority mask from the normalized beauty alpha;
4. inspect the exact layer across all five locked body plates;
5. upload content-addressed bytes to private approved storage;
6. atomically register the component version and calibrated QA;
7. replay registration to prove idempotence;
8. create a new blocked release draft and verify Madison renders the new member.

## Immutable identities

| Subject | Identity |
|---|---|
| Approved source | `442e94e1e1b5c034648d40a06950642eaf770ab9d51d717d7be59adc4511d11c` |
| Normalized beauty | `137225d8ad4607db5e993a639ef055801568bae25b27a629dcaf47b9d563635f` |
| Authority mask | `d2d1bd4a29e949c2dd824c95f60607ee36954381084fe5bb5e7570000c65cbfa` |
| Component ID | `f31e2125-d2fb-4894-afa1-986f44e294d8` |
| Component version ID | `f1fb4f6e-43c9-4404-b294-a9c900093f1c` |
| Release ID | `4fc87a1b-9b7d-4555-ab03-00fa14ed6ba0` |
| Release version | `1.0.0-rollon-plastic-roller.1` |
| Release manifest | `602c2e4f83b5a77280573a65ccf1ad1a1ee4ba37b9986ec928c130a99ca700f6` |

## Geometry and calibrated QA

- Source alpha bounds at threshold 8: `35,12 → 186,149`.
- Normalized alpha bounds: `907,675 → 1175,918`.
- Target width: 269 px.
- Shared centerline: x = 1041.
- Shared top anchor: y = 675.
- Logical neck seat: y = 968.
- Per-bottle adjustment: none.
- Beauty/mask alpha identity: exact.
- Opaque exact-white fraction: 0.0%; calibrated maximum: 5%.
- Calibration references: the approved plastic source and rejected metal source with 72.8% opaque white junk.

The visual inspection lineup used the same normalized bytes on clear, frosted, swirl, amber, and cobalt. No body-specific transform or production nudge was applied.

## Safety results

- Storage bucket: private `paper-doll-approved`.
- Upload behavior: `upsert: false`.
- First run: two objects created; one component, one version, and four blocking QA rows created.
- Replay: both objects download/hash verified; zero component/version rows created.
- Release mutation during source registration: false.
- Release after explicit draft build: six approved assets, still blocked.
- Sanity publication: false.
- Metal roller: absent and still blocked.

## Release reconciliation

| State | Count |
|---|---:|
| Required | 17 |
| Approved | 6 |
| Blocked | 1 |
| Missing | 10 |

The five-body lineup correctly remains `0/5 complete` because the SHN-SL overcap is missing. Each item shows the exact plastic roller and reports the missing overcap rather than presenting a false completed assembly.

## Reproduction commands

```bash
npm run paper-doll:cyl9:register-plastic-roller -- \
  --asset-repo-root "/path/to/madison-app" \
  --output-dir "/temporary/inspection-directory"

npm run paper-doll:cyl9:register-plastic-roller -- \
  --asset-repo-root "/path/to/madison-app" \
  --register

npm run paper-doll:cyl9:release -- \
  --release-version 1.0.0-rollon-plastic-roller.1 \
  --register
```

The first command is local and release-neutral. The latter two require the linked Supabase project and service-role credentials. Neither publishes to Sanity.

## Skill extraction notes

The future `best-bottles-paper-doll-production` skill should orchestrate this sequence but must not reproduce its deterministic logic in prose. The source-of-truth implementation remains:

- normalization and QA: `src/lib/paperDoll/cyl9PlasticRoller.node.ts`;
- storage/ledger command: `scripts/paper-doll/register-cyl9-plastic-roller.ts`;
- release reconciliation: `scripts/paper-doll/build-cyl9-rollon-release.ts`;
- transactional RPC: `register_paper_doll_approved_source`;
- visible evidence: Madison Production Candidate Bench.

The skill must stop on source hash drift, placement drift, mask mismatch, failed calibrated QA, object hash mismatch, ambiguous approved versions, or any attempted publication from a blocked release.

## Incident captured during UI verification

A hard reload initially returned the app 404 because the Best Bottles Studio route existed only in the authenticated/sidebar route tree, not the initial auth-hydration tree. The duplicate route contract was restored and covered by `bestBottlesStudioLayout.test.ts`. This is a workflow lesson for the skill: always perform a hard-reload browser check, not only a hot-reload check.
