# Best Bottles Cylinder V6.1 Closeout Runbook

## Scope and immutable target

- Source ledger: 384 auditable Cylinder/Tall Cylinder rows.
- Publication ledger: 377 unique website-SKU targets.
- Approved alias policy: seven website-SKU duplicate pairs plus the Tall Cylinder alias.
- Required prompt: `best-bottles-reference-locked-v6.1`.
- Required shadow policy: owner `model`, contract `contact-back-right-v1`.
- Required output: one approved image per publication target, with geometry QA and every expected shadow contact passing.

Do not substitute V6.0, the historical `v6.1-shadow-smoke` identifier, a rig-owned shadow, or a stale manifest entry.

## Current local checkpoint (2026-07-12)

- Ledger hash: `8e94086aeb88fa5d624690cc046e6aeb4a520af99144e48da86f5f4e54a53ad1`.
- Reference-manifest hash: `4d36316cb8d1c82e22a2fb3588ae45fc18f08b2cb08b96d1e226ded9266388ff`.
- Catalog blockers: 17 (10 measurement syncs and 7 missing catalog joins).
- Reference readiness: 0 eligible, 2 capped-PSD recovery candidates, 375 manual source matches.
- Paid generation status: blocked.
- Remote migration/deployment status: not applied by this implementation session.

Hashes must be regenerated and re-recorded after any approved catalog or reference correction.

## Gate 1 — catalog and ledger

Run:

```bash
npm run bestbottles:cylinder:closeout-ledger
```

Required result:

- 384 source rows.
- 377 publication targets.
- zero blockers.
- the alias map contains only the approved aliases.

Resolve catalog joins and measurement overrides in their source systems, rebuild the readiness input, and rerun. Do not edit the generated ledger to hide a blocker.

## Gate 2 — canonical references

For each publication target, provide one reviewed opaque PNG/JPG/WebP that:

- has an exact canonical Grace SKU or website SKU filename token;
- totals at least 1 megapixel;
- has no transparent or partially transparent pixels;
- has approved `flattened-product-truth` or `reviewed-local-canonical` provenance;
- is not a live commercial image, mask, paper doll, background-removed file, or retired asset;
- has a recorded SHA-256.

PSD files are recovery inputs only. Exporting or altering a PSD requires an operator-reviewed workflow; the recovery inventory never modifies a PSD.

Run:

```bash
npm run bestbottles:cylinder:reference-recovery
```

Required result: 377 `eligible` decisions and zero other statuses. Rebuild the closeout ledger first whenever its hash changes.

## Gate 3 — database and Edge activation (external checkpoint)

These operations change remote state and require explicit operator confirmation:

1. Apply `supabase/migrations/20260712001000_best_bottles_model_shadow_evidence.sql` in the intended environment.
2. Run the reconciliation SQL lifecycle test against an isolated database.
3. Deploy the synchronized `generate-madison-image` Edge Function.
4. Download/inspect the deployed source and confirm its studio direction exactly matches the browser compiler.
5. Confirm logs show prompt version, shadow owner, contract, and topology.

Do not proceed if Cylinder V6.0, historical smoke lineage, missing topology, or mixed model/rig shadow authority is accepted.

## Gate 4 — smoke allowlist (paid external checkpoint)

Build the matrix:

```bash
npm run bestbottles:cylinder:smoke-matrix
```

Required result: `eligible: true`, no missing coverage, and every selected reference hash present in the signed reference manifest.

Preview generation without a provider call:

```bash
npm run bestbottles:generation:run-family -- --dry-run --family Cylinder --skus "$(node -e 'const m=require("./tmp/bestbottles-generation/cylinder-v6.1-smoke-matrix.json"); process.stdout.write(m.allowlist.join(","))')"
```

After explicit billing approval, remove `--dry-run` and run only that allowlist. Review every reference/raw/final trio and its geometry/shadow evidence. Any repeated QA failure halts its product-group cohort at `BB_GEN_SYSTEMIC_QA_FAILURE_THRESHOLD` (default 3).

The matrix must cover 3, 4, 5, 9, 25–30, 50, 100 ml and large plastic; clear, amber, cobalt, frosted, swirl and opaque/plastic; assembled and detached-sidecar topology; and every required applicator archetype.

## Gate 5 — full 377-target generation (paid external checkpoint)

Dry run first:

```bash
npm run bestbottles:generation:run-family -- --dry-run --family Cylinder
```

The unrestricted runner refuses to proceed unless all 377 references are eligible and all 377 publication targets resolve. A historical rendered entry is resumable only when ledger, reference, prompt, version, owner, contract, topology, final/raw URLs, geometry QA, shadow QA, and lifecycle evidence all match.

After explicit billing approval:

```bash
npm run bestbottles:generation:run-family -- --family Cylinder
```

`BB_GEN_SKIP_RIG_POSTPROCESS=1` is prohibited for Cylinder V6.1.

## Gate 6 — review and approval

For each of 377 publication targets verify:

- product identity and material match the canonical reference;
- framing/geometry report passes;
- prompt version is V6.1;
- shadow owner is model;
- topology and expected contacts match the reviewed composition;
- overall shadow status and every expected contact status pass;
- reference, ledger, and prompt hashes match the generation manifest;
- a human explicitly confirms identity, framing, material, and shadow.

The reconciliation approval RPC is the authoritative gate. Never patch approval columns directly.

## Gate 7 — publication and live verification (external checkpoint)

Run the Shopify publication preflight without writes. With explicit authorization, publish the approved final URL, record the Shopify CDN URL, synchronize Convex, and verify the storefront PDP.

Closeout requires:

- 377/377 publication targets approved, published, and live-verified;
- 384/384 source rows resolved through the alias ledger;
- exact Shopify and Convex URL agreement;
- no missing reference, review pending, generation failure, stale V6.0, identity ambiguity, approved-not-pushed, or storefront drift.

## Local verification

```bash
npm run test:bestbottles:image-coverage
npx tsx --test src/lib/bestBottlesCylinderSmokeMatrix.test.ts scripts/best-bottles/family-batch-resume.test.ts
npx tsc -p tsconfig.app.json --noEmit
deno check supabase/functions/_shared/bestBottlesPrecompiledPrompt.ts
git diff --check
```

If Docker is available, also reset an isolated Supabase test database and run `supabase/tests/best_bottles_image_reconciliation.sql`. Never reset a shared or production database.
