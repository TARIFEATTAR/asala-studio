# Best Bottles Prompt Synchronization Implementation Plan

> **For agentic workers:** Execute inline in the existing `codex/` branch because the verified canvas fix and prompt edits already share this working tree. Do not commit, push, approve images, or publish product data.

**Goal:** Make the browser-compiled Best Bottles catalog prompt and the `generate-madison-image` Edge runtime resolve the same deterministic background/shadow instructions, version the change, and deploy only that Edge Function.

**Architecture:** The browser catalog canon remains the authoring source. The Edge resolver keeps its runtime-safe constants, while a Node test imports both modules and enforces exact equality. A prompt-version bump makes post-deploy reconciliation records distinguishable from earlier generations.

**Tech Stack:** TypeScript, Node test runner through `tsx`, Vite, Supabase Edge Functions and CLI.

## Global Constraints

- Product identity remains `GBSpry3mlClBlk` / `GB-SPR-CLR-3ML-BLK`; the read-only audit reports zero identity issues.
- Background and contact shadow are deterministic post-processing responsibilities.
- Deploy only `generate-madison-image` to project `likkskifwsrvszxdvufw`.
- Do not approve or publish the existing two-tone master.

---

### Task 1: Lock prompt parity and prompt identity

**Files:**
- Modify: `supabase/functions/_shared/bestBottlesPrecompiledPrompt.test.ts`
- Modify: `src/lib/bestBottlesGenerationIdentity.test.ts`
- Modify: `src/lib/bestBottlesGenerationIdentity.ts`

- [ ] Add a test that compares `BEST_BOTTLES_STUDIO_DIRECTION_V2` with `STUDIO_DIRECTION` and `BEST_BOTTLES_FINAL_V2_STUDIO_CHECK` with `FINAL_V2_STUDIO_CHECK` using exact equality.
- [ ] Assert the synchronized prompt contains deterministic post-processing language and excludes the retired shadow-enhancement phrases.
- [ ] Add a failing assertion for prompt version `best-bottles-reference-locked-v6.0`.
- [ ] Run the focused tests and confirm they fail because the Edge constants and version are stale.

### Task 2: Synchronize the runtime prompt

**Files:**
- Modify: `supabase/functions/_shared/bestBottlesPrecompiledPrompt.ts`
- Modify: `src/lib/bestBottlesGenerationIdentity.ts`

- [ ] Copy the canonical `STUDIO_DIRECTION` and `FINAL_V2_STUDIO_CHECK` values into the Edge resolver constants exactly.
- [ ] Set `BEST_BOTTLES_PROMPT_VERSION` to `best-bottles-reference-locked-v6.0`.
- [ ] Run focused tests and confirm parity, retired-language exclusion, and version assertions pass.

### Task 3: Verify and deploy

**Files:**
- Verify all modified prompt, canvas, and test files in the existing working tree.

- [ ] Run focused Best Bottles prompt and rig tests.
- [ ] Run `npx tsc --noEmit`, targeted ESLint, `git diff --check`, and `npm run build`.
- [ ] Deploy with `npx supabase functions deploy generate-madison-image --project-ref likkskifwsrvszxdvufw --use-api`.
- [ ] List deployed functions and confirm `generate-madison-image` has a new active version and deployment timestamp.
- [ ] Do not run a paid generation; hand off one single-SKU smoke test to the user.
