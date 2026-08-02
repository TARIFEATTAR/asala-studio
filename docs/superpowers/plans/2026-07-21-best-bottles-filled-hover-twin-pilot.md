# Best Bottles Filled Hover Twin Pilot Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build one safe, review-gated empty/filled marketing-hover pair for `GB-CYL-CLR-9ML-ROL-BKDT-02` without making the feature or either image reachable from PDP, Shopify, Convex product-image, reconciliation, or SKU-job mutation paths.

**Architecture:** Madison receives a dedicated marketing-only request containing one approved scene parent, one reviewed cavity mask, and structured liquid fields. A dedicated Edge Function validates the contract, performs a masked GPT Image 2 edit, saves a review-pending child, and evaluates pair QA; the website publishes an approved pair atomically to a dedicated Sanity document and renders it only behind a default-off exact-SKU hover gate.

**Tech Stack:** React 18, TypeScript, Vite, Supabase Edge Functions/Deno, OpenAI GPT Image edits, Node test runner/tsx, Next.js, Sanity, Vitest.

## Global Constraints

- Never move, rename, delete, or overwrite source files; copy only.
- Never auto-promote, auto-approve, or auto-publish an image or reference.
- The model alone renders liquid and shadows; code only validates, measures, and places.
- PDP generation remains GPT Image 2 only; this dedicated marketing edit must not alter the PDP prompt or destination code.
- The empty parent is submitted exactly once.
- Sanity publishing is dry-run by default; live publication requires explicit `--apply`.
- Storefront behavior is default-off and requires an exact active representative SKU match.
- Do not commit unless Jordan separately authorizes it.

---

### Task 1: Marketing-only request contract and prompt

**Files:**
- Create: `src/lib/bestBottlesFilledHoverTwin.ts`
- Test: `src/lib/bestBottlesFilledHoverTwin.test.ts`

**Interfaces:**
- Produces `parseFilledHoverTwinRequest(input)`, `buildFilledHoverTwinPrompt(request)`, `buildFilledHoverTwinTags(request)`, and `assertFilledHoverTwinDestinations(input)`.
- The parsed contract requires one parent ID/URL, one reviewed PNG mask, exact Grace/website SKUs, `openai-image-2`, a 0-100 fill, a non-empty liquid color, and explicit marketing-scene approval.

- [ ] Write tests that reject PDP roles, Shopify/Convex/reconciliation/SKU-job destinations, non-OpenAI providers, unapproved parents/masks, missing exact SKUs, and duplicate parent references.
- [ ] Run `npx tsx --test src/lib/bestBottlesFilledHoverTwin.test.ts` and confirm RED because the module is missing.
- [ ] Implement the smallest pure contract and liquid-only prompt that passes the tests.
- [ ] Re-run the focused test and confirm GREEN.

### Task 2: Mask-aware OpenAI edit transport

**Files:**
- Modify: `supabase/functions/_shared/openaiProvider.ts`
- Modify: `supabase/functions/_shared/openaiProvider.test.ts`

**Interfaces:**
- Extends `OpenAIImageParams` with optional `editMask`, containing base64 PNG bytes and MIME type.
- Sends one `mask` multipart field only when supplied; ordinary generation and PDP edit callers remain unchanged.

- [ ] Add a provider test asserting exactly one ordered `image[]` parent and one `mask` part.
- [ ] Run the Deno provider test and confirm RED because no mask is appended.
- [ ] Add the optional transport field without changing existing callers.
- [ ] Re-run provider tests and confirm GREEN.

### Task 3: Pair QA

**Files:**
- Create: `supabase/functions/_shared/bestBottlesFilledHoverTwinQa.ts`
- Test: `supabase/functions/_shared/bestBottlesFilledHoverTwinQa.test.ts`

**Interfaces:**
- Produces `evaluateFilledHoverTwinQa({ parent, child, mask, targetFillPercent, tolerance })`.
- Returns a structured pass/fail report covering dimensions, aspect, outside-mask pixel tolerance, liquid containment, fill level, meniscus evidence, and tint leakage.

- [ ] Add fixtures/tests for dimension mismatch, outside-mask drift, 70% ±3% acceptance, liquid above the meniscus, and background/cap/platform leakage.
- [ ] Run the focused Deno test and confirm RED.
- [ ] Implement deterministic image-plane measurements only; do not composite or recolor pixels.
- [ ] Re-run and confirm GREEN.

### Task 4: Dedicated Madison Edge Function

**Files:**
- Create: `supabase/functions/generate-bestbottles-filled-twin/index.ts`
- Create: `supabase/functions/generate-bestbottles-filled-twin/contract.test.ts`
- Modify: `supabase/config.toml`

**Interfaces:**
- Accepts only the Task 1 contract, authenticates the user/organization, loads the approved marketing parent, downloads the reviewed mask, calls GPT Image 2 once, evaluates Task 3 QA, uploads the result, and inserts one `generated_images` child.
- Persists `parent_image_id`, review-pending/rejected lifecycle, QA report, and the exact filled-twin tags. It imports no commerce/PDP persistence module.

- [ ] Add contract tests proving forbidden roles/destinations are rejected before provider invocation and the parent is passed once.
- [ ] Confirm RED.
- [ ] Implement validation, storage, provider invocation, QA, and library-only persistence.
- [ ] Confirm GREEN and inspect imports to prove commerce mutation code is unreachable.

### Task 5: Madison library action and reviewed mask gate

**Files:**
- Create: `src/components/library/CreateFilledHoverTwinDialog.tsx`
- Create: `src/lib/bestBottlesFilledHoverTwinClient.ts`
- Test: `src/lib/bestBottlesFilledHoverTwinClient.test.ts`
- Modify: `src/pages/ImageLibrary.tsx`

**Interfaces:**
- Shows `Create Filled Twin` only for an approved Best Bottles scene/marketing image with exact SKU tags.
- Requires a PNG cavity-mask selection plus explicit visual confirmation; defaults to warm translucent amber at 70%; invokes only the dedicated Edge Function.

- [ ] Write client-builder tests for endpoint isolation, one parent, exact tags, and reviewed-mask confirmation.
- [ ] Confirm RED.
- [ ] Implement the client builder, modal, overlay preview, and disabled/confirmation behavior.
- [ ] Confirm GREEN and typecheck the touched files.

### Task 6: Atomic Sanity pair document and publisher

**Files (Best Bottles website worktree):**
- Create: `src/sanity/schemaTypes/documents/marketingHoverPair.ts`
- Modify: `src/sanity/schemaTypes/index.ts`
- Create: `scripts/push-sanity-marketing-hover-pair-core.mjs`
- Create: `scripts/push-sanity-marketing-hover-pair.mjs`
- Test: `scripts/push-sanity-marketing-hover-pair.test.mjs`

**Interfaces:**
- Validates exact group/SKU identity, two distinct HTTPS assets, passed pair QA, and explicit human approval.
- Uses a deterministic pair ID and one Sanity transaction containing both asset references and the pair document; dry-run is default and `--apply` is required.

- [ ] Add tests for validation, deterministic IDs, default dry-run, and no document mutation when either upload fails.
- [ ] Confirm RED.
- [ ] Implement schema, pure publisher core, and CLI.
- [ ] Confirm GREEN and run website TypeScript validation.

### Task 7: Default-off exact-SKU storefront hover

**Files (Best Bottles website worktree):**
- Create: `src/lib/products/marketing-hover-pair.ts`
- Test: `src/lib/products/marketing-hover-pair.test.ts`
- Modify: `src/components/products/ProductCardImagePreview.tsx`
- Modify the catalog data loader that supplies `ProductCardImagePreview`.

**Interfaces:**
- Fetches only approved `marketingHoverPair` documents when `NEXT_PUBLIC_BB_MARKETING_HOVER_TWINS=true`.
- Returns a pair only when its representative Grace SKU/website SKU exactly matches the active preview.
- Renders two identical absolute frames, preloads the filled image, crossfades near 300 ms on pointer hover, uses the empty image on touch/failure/disabled state, and removes the filled layer when another variant is active.

- [ ] Add tests for default-off, missing-pair fallback, exact variant matching, and approved-only selection.
- [ ] Confirm RED.
- [ ] Implement query/selection and the two-layer card rendering.
- [ ] Confirm GREEN and run relevant catalog tests.

### Task 8: Full verification and ledger update

**Files:**
- Modify: `tmp/best-bottles-reference-production/cylinder-reference-loop/state.json`

- [ ] Run all new focused Madison and website tests.
- [ ] Run `npm run test:bestbottles:image-coverage` in Madison and require 383/383 or higher.
- [ ] Run `npx tsc -p tsconfig.app.json --noEmit`, capture the baseline/diff, and prove no new errors name touched files.
- [ ] Run the website typecheck/test commands.
- [ ] Inspect `git diff --check` and both worktree diffs.
- [ ] Append one zero-paid-image ledger iteration recording implementation and verification, with no claim of deployment, approval, publication, or commit.
- [ ] Do not generate, deploy, publish, stage, commit, or push without Jordan's explicit next instruction.
