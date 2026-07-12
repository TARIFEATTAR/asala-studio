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
