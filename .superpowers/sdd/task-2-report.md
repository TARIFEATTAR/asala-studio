# Task 2 report — compile model-owned shadow smoke prompt

## Status

DONE_WITH_CONCERNS

## Implemented

- Extended `PromptRecord` with `prompt_version` and `shadow_owner` and propagated the resolved policy through the compiler and preflight record.
- Added the exact `MODEL_OWNED_GROUNDING_SHADOW` contract and fail-closed canon source guards for model-owned clear-glass, studio-direction, and final-check variants.
- Made canon/framing assembly policy-aware: only `GB-SPR-CLR-3ML-BLK` receives the V6.1 model-owned shadow block; all other SKUs resolve to V6.0 rig ownership.
- Added policy lineage tags to the QA checklist and regression tests for the smoke SKU, sibling SKU, model/rig authority conflict, and rig canon byte equality.

## Verification

- `npx tsx --test src/lib/bestBottlesCatalogCanonPrompt.test.ts src/lib/bestBottlesPromptPreflight.test.ts` — PASS (19/19).
- `npx tsc --noEmit -p tsconfig.app.json` — PASS.
- `npx tsc --noEmit -p tsconfig.node.json` — PASS.
- `npx tsx --test scripts/generate-prompts.test.ts scripts/best-bottles/cylinder-smoke-prompt-mode.test.ts src/lib/bestBottlesShadowPolicy.test.ts src/lib/bestBottlesGenerationIdentity.test.ts` — 21/22 passed.

## Concern

The existing `scripts/best-bottles/cylinder-smoke-prompt-mode.test.ts` canon-only assertion still expects the retired `PRIMARY GOAL:` clear-glass block; the current dirty workspace canon intentionally emits `CLEAR GLASS:`. This failure predates Task 2's policy changes and is unrelated to the model-owned smoke implementation.

## Commit

`feat(best-bottles): compile model-owned shadow smoke prompt`

## Fix report — review findings addressed

### Status

FIXED — focused review corrections applied in a new commit after `a9caf8d`.

### Findings addressed

- Restored the `ba2a6a6` pre-task canon byte-for-byte for all rig-owned exports (`PRESERVE`, `CLEAR_GLASS`, `STUDIO_DIRECTION`, `FINAL_V2_STUDIO_CHECK`, `PRESENTATION`, and `CLEAR_PRESENTATION`). The rig framing directive and detached-cap sidecar geometry were likewise restored; only the model-owned policy selects a different shadow block.
- Removed the unrelated vintage/atomizer dip-tube prompt additions and preserved the existing family geometry behavior.
- Added the model-only Bone canvas contract (`#F6EFE8`, `2080 × 2288`) without changing the rig-owned canon.
- Reconciled prompt-preflight expectations with committed family-profile values; the roller profile assertion now derives its expected range/target from the resolved committed profile rather than stale dirty-workspace values.
- Updated the cylinder smoke `PromptRecord` fixture with `prompt_version` and `shadow_owner`; canon-only now checks the restored `PRIMARY GOAL:` canon.
- Made direct `buildPromptForSku()` output coherent for the exact model smoke SKU by compiling the same canon-owned experimental prompt when policy metadata is V6.1/model, and added a preflight regression assertion for the single model block and Bone contract.
- Added fail-closed policy validation so a helper-supplied model policy cannot be applied to a non-allowlisted SKU.

### Files changed

- `src/config/bestBottlesCatalogCanon.ts`
- `src/lib/bestBottlesCatalogCanonPrompt.ts`
- `src/lib/bestBottlesCatalogCanonPrompt.test.ts`
- `src/lib/bestBottlesPromptCompiler.ts`
- `src/lib/bestBottlesPromptPreflight.ts`
- `src/lib/bestBottlesPromptPreflight.test.ts`
- `scripts/best-bottles/cylinder-smoke-prompt-mode.test.ts`

### Verification

- `npx tsx --test src/lib/bestBottlesCatalogCanonPrompt.test.ts src/lib/bestBottlesPromptPreflight.test.ts scripts/best-bottles/cylinder-smoke-prompt-mode.test.ts scripts/generate-prompts.test.ts src/lib/bestBottlesShadowPolicy.test.ts src/lib/bestBottlesGenerationIdentity.test.ts` — PASS (41/41).
- `npx tsc --noEmit -p tsconfig.app.json` — PASS.
- `npx tsc --noEmit -p tsconfig.node.json` — PASS.

### Self-review

- Confirmed `git diff ba2a6a6 -- src/config/bestBottlesCatalogCanon.ts` contains only the new model-owned block; the rig canon is unchanged.
- Confirmed the model preflight path emits exactly one `GROUNDING SHADOW — MODEL OWNED:` block and no deterministic-shadow directive.
- Confirmed the direct compiler smoke record carries V6.1/model metadata alongside the canon-owned model prompt, including `#F6EFE8`.
- No deployment, migration, provider invocation, paid image generation, approval, or publish action was performed.

### Remaining concerns

The repository worktree contains unrelated pre-existing dirty files. This fix touched only the Task 2 files plus the named cylinder smoke fixture and report.
