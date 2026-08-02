# Best Bottles Marketing Hero Madison Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add versioned low-plinth marketing generation and an approval-gated `marketingHeroAsset` publish action to Madison Studio without changing the PDP pipeline.

**Architecture:** Pure shared contracts define theme, preset role, provider, and publish eligibility. The Masters UI and generation hook consume those contracts, and the existing authenticated Sanity placement function receives a dedicated deterministic marketing-hero operation. Validation runs before any provider call, image upload, or Sanity mutation.

**Tech Stack:** TypeScript, React 18, Vite, Node test runner through `tsx --test`, Supabase Edge Functions/Deno, Sanity client.

## Global Constraints

- Preserve product geometry and identity; themes alter only scene, material surface, and lighting.
- PDP primary, PDP secondary, and Angle stay GPT Image 2 only.
- Marketing and scene assets may use the existing OpenAI/Google provider picker.
- Code measures, gates, and places; the model owns beautification and shadows.
- No production writes, paid generations, deployment, commit, or push during implementation.
- Preserve every pre-existing dirty-worktree change and the filled-hover-twin pilot.
- `npm run test:bestbottles:image-coverage` must remain 383/383.
- Typecheck with `npx tsc -p tsconfig.app.json --noEmit` and add no errors beyond the recorded backlog.

---

## File structure

- Create `src/config/bestBottlesMarketingHeroThemes.ts`: authoritative versioned theme registry and prompt/family framing resolver.
- Create `src/config/bestBottlesMarketingHeroThemes.test.ts`: theme invariants and fail-closed tests.
- Modify `src/lib/bestBottlesImageReconciliationRules.ts`: explicit marketing/scene role mapping for Sanity and Landscape presets.
- Modify `src/lib/bestBottlesImageReconciliation.test.ts`: role/provider regression tests.
- Modify `src/components/darkroom/MastersTabPanel.tsx`: theme selector and marketing-lane affordances.
- Modify `src/hooks/useAssembledPromptGeneration.ts`: resolve one theme object and attach its ID/prompt/metadata to generation.
- Create `supabase/functions/_shared/bestBottlesMarketingHeroPublish.ts`: pure publication eligibility and deterministic-document contract.
- Create `supabase/functions/_shared/bestBottlesMarketingHeroPublish.test.ts`: fail-closed publication tests.
- Modify `supabase/functions/push-sanity-placement/index.ts`: dedicated `marketingHeroAsset` dry-run/publish branch using the pure contract.
- Create `src/lib/bestBottlesMarketingHeroPublishClient.ts`: browser request builder and eligibility mirror for button state.
- Create `src/lib/bestBottlesMarketingHeroPublishClient.test.ts`: client request tests.
- Create `src/components/library/PublishMarketingHeroDialog.tsx`: approved-only publishing UI.
- Modify `src/pages/ImageLibrary.tsx`: expose the dedicated action only for eligible Best Bottles renders.
- Modify `package.json`: include new pure tests in `test:bestbottles:image-coverage`.

### Task 1: Versioned low-plinth theme contract

**Files:**
- Create: `src/config/bestBottlesMarketingHeroThemes.ts`
- Create: `src/config/bestBottlesMarketingHeroThemes.test.ts`
- Modify: `package.json`

**Interfaces:**
- Produces: `BestBottlesMarketingHeroThemeId`, `BestBottlesMarketingHeroTheme`, `BEST_BOTTLES_MARKETING_HERO_THEMES`, `resolveBestBottlesMarketingHeroTheme(themeId, family)`.
- Consumed by: Tasks 3 and 4.

- [ ] **Step 1: Write the failing theme tests**

```ts
import assert from "node:assert/strict";
import test from "node:test";
import {
  BEST_BOTTLES_MARKETING_HERO_THEMES,
  resolveBestBottlesMarketingHeroTheme,
} from "./bestBottlesMarketingHeroThemes";

test("v1 exposes exactly the three approved low-plinth tokens", () => {
  assert.deepEqual(
    BEST_BOTTLES_MARKETING_HERO_THEMES.map((theme) => theme.id),
    [
      "pale-limestone-low-plinth-v1",
      "warm-sandstone-low-plinth-v1",
      "charcoal-slate-low-plinth-v1",
    ],
  );
});

test("every approved token enforces the shared shelf-line contract", () => {
  for (const theme of BEST_BOTTLES_MARKETING_HERO_THEMES) {
    assert.match(theme.prompt, /exactly one shallow rectangular platform/i);
    assert.match(theme.prompt, /lower 12–18%/i);
    assert.match(theme.prompt, /existing shared shelf line/i);
    assert.match(theme.prompt, /no loose stones/i);
  }
});

test("Empire receives wider safe-area framing without changing the surface", () => {
  const cylinder = resolveBestBottlesMarketingHeroTheme(
    "pale-limestone-low-plinth-v1",
    "Cylinder",
  );
  const empire = resolveBestBottlesMarketingHeroTheme(
    "pale-limestone-low-plinth-v1",
    "Empire",
  );
  assert.equal(cylinder.theme.id, empire.theme.id);
  assert.match(cylinder.familyFramingPrompt, /centered safe area/i);
  assert.match(empire.familyFramingPrompt, /wider horizontal safe area/i);
});

test("unknown theme ids fail closed", () => {
  assert.throws(
    () => resolveBestBottlesMarketingHeroTheme("free-form" as never, "Cylinder"),
    /Unsupported Best Bottles marketing hero theme/,
  );
});
```

- [ ] **Step 2: Run the new test and confirm RED**

Run: `npx tsx --test src/config/bestBottlesMarketingHeroThemes.test.ts`  
Expected: FAIL because `bestBottlesMarketingHeroThemes.ts` does not exist.

- [ ] **Step 3: Implement the minimal immutable registry and resolver**

```ts
export const BEST_BOTTLES_MARKETING_HERO_THEME_IDS = [
  "pale-limestone-low-plinth-v1",
  "warm-sandstone-low-plinth-v1",
  "charcoal-slate-low-plinth-v1",
] as const;

export type BestBottlesMarketingHeroThemeId =
  (typeof BEST_BOTTLES_MARKETING_HERO_THEME_IDS)[number];

export type BestBottlesMarketingHeroTheme = Readonly<{
  id: BestBottlesMarketingHeroThemeId;
  label: string;
  surface: "pale limestone" | "warm sandstone" | "charcoal slate";
  prompt: string;
}>;

export function resolveBestBottlesMarketingHeroTheme(
  themeId: BestBottlesMarketingHeroThemeId,
  family: string | null | undefined,
): { theme: BestBottlesMarketingHeroTheme; familyFramingPrompt: string };
```

The three prompt values must state the exact structural rules from the approved design and differ only in material/tone. `familyFramingPrompt` uses the wider Empire clause only when the normalized family is `empire`.

- [ ] **Step 4: Add the test to `test:bestbottles:image-coverage` and confirm GREEN**

Run: `npx tsx --test src/config/bestBottlesMarketingHeroThemes.test.ts`  
Expected: 4 passing tests.

### Task 2: Explicit preset roles and provider policy

**Files:**
- Modify: `src/lib/bestBottlesImageReconciliationRules.ts`
- Modify: `src/lib/bestBottlesImageReconciliation.test.ts`

**Interfaces:**
- Consumes: existing `BestBottlesImageAssetRole` and `getBestBottlesImageAssetRoleForPreset`.
- Produces: role mapping used by `useAssembledPromptGeneration.ts` and the server provider guard.

- [ ] **Step 1: Add failing role tests**

```ts
assert.equal(
  getBestBottlesImageAssetRoleForPreset("sanity-hero-928x1152"),
  "marketing",
);
assert.equal(
  getBestBottlesImageAssetRoleForPreset("landscape-hero-2400x1350"),
  "scene",
);
assert.equal(
  getBestBottlesImageAssetRoleForPreset("master-angle-2080x2288"),
  "pdp-secondary",
);
```

- [ ] **Step 2: Run the targeted test and confirm RED**

Run: `npx tsx --test src/lib/bestBottlesImageReconciliation.test.ts`  
Expected: Sanity and Landscape assertions fail with `pdp-primary`.

- [ ] **Step 3: Add exact preset mappings without changing defaults**

```ts
if (presetId === "sanity-hero-928x1152") return "marketing";
if (presetId === "landscape-hero-2400x1350") return "scene";
```

Retain the explicit Angle and Exploded `pdp-secondary` branch and the default `pdp-primary` return.

- [ ] **Step 4: Run the role tests and existing provider-contract tests**

Run: `npx tsx --test src/lib/bestBottlesImageReconciliation.test.ts supabase/functions/_shared/bestBottlesRenderingContract.test.ts`  
Expected: PASS; tests prove override is allowed only for `marketing`/`scene` and all PDP roles remain OpenAI-only.

### Task 3: Theme selection and generation metadata

**Files:**
- Modify: `src/components/darkroom/MastersTabPanel.tsx`
- Modify: `src/hooks/useAssembledPromptGeneration.ts`
- Modify: `src/config/imagePresets.test.ts`

**Interfaces:**
- Consumes: `resolveBestBottlesMarketingHeroTheme` from Task 1 and role mapping from Task 2.
- Produces: one `marketingHeroThemeId` selection and consistent prompt/metadata values sent to `generate-madison-image`.

- [ ] **Step 1: Add a failing generation-contract test**

Add a pure exported helper beside the theme registry:

```ts
export function buildBestBottlesMarketingHeroOverlay(input: {
  presetId: string;
  themeId: BestBottlesMarketingHeroThemeId | null;
  family: string | null;
}): { themeId: BestBottlesMarketingHeroThemeId; prompt: string } | null;
```

Test that marketing/scene presets require a recognized theme, PDP presets return `null`, Empire contains the wide framing clause, and no prompt contains loose props.

- [ ] **Step 2: Run the test and confirm RED**

Run: `npx tsx --test src/config/bestBottlesMarketingHeroThemes.test.ts`  
Expected: FAIL because the overlay helper is absent.

- [ ] **Step 3: Implement the pure overlay helper and make it GREEN**

The helper must derive role through `getBestBottlesImageAssetRoleForPreset`, return `null` for PDP roles, and throw when a marketing/scene preset lacks a supported theme.

- [ ] **Step 4: Wire the Masters UI to the shared registry**

In `MastersTabPanel.tsx`, render the versioned theme selector only when the selected preset resolves to `marketing` or `scene`. Default to `pale-limestone-low-plinth-v1`. Keep the existing provider picker. Show that Angle is GPT-only through the existing policy display.

- [ ] **Step 5: Resolve the overlay once in the generation hook**

In `useAssembledPromptGeneration.ts`, compute one overlay object before request construction and use that exact object for:

- the appended prompt block;
- `productContext.marketingHeroThemeId`;
- `productContext.marketingHeroThemeSurface`;
- generation metadata/provenance;
- the request hash input if the existing request hashing path includes `productContext`.

Do not re-resolve theme details in separate branches. If UI theme ID and resolved metadata disagree, throw before `supabase.functions.invoke`.

- [ ] **Step 6: Run targeted generation tests**

Run: `npx tsx --test src/config/bestBottlesMarketingHeroThemes.test.ts src/config/imagePresets.test.ts src/lib/bestBottlesImageReconciliation.test.ts`  
Expected: PASS.

### Task 4: Pure approval and deterministic publish contract

**Files:**
- Create: `supabase/functions/_shared/bestBottlesMarketingHeroPublish.ts`
- Create: `supabase/functions/_shared/bestBottlesMarketingHeroPublish.test.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes: no external services.
- Produces: `validateBestBottlesMarketingHeroPublish(input)` and `buildBestBottlesMarketingHeroDocument(input, sanityAssetId)`.

- [ ] **Step 1: Write failing fail-closed tests**

Define a valid fixture with `kind: "thumbnail"`, `assetRole: "marketing"`, `providerModel: "nano-banana-pro"`, `lifecycleState: "qa-passed"`, `humanApprovalStatus: "approved"`, a v1 theme ID, HTTPS URL, Madison render ID, approver, and approval timestamp. Assert:

- valid fixture returns deterministic ID `marketingHeroAsset-cylinder-9ml-clear-13-415-rollon-thumbnail`;
- `pdp-primary` is rejected;
- `qa-failed` is rejected;
- missing or non-approved human status is rejected;
- unknown provider is rejected;
- unknown theme is rejected;
- HTTP source URLs are rejected;
- duplicate/unsafe slug characters are normalized or rejected consistently.

- [ ] **Step 2: Run tests and confirm RED**

Run: `npx tsx --test supabase/functions/_shared/bestBottlesMarketingHeroPublish.test.ts`  
Expected: FAIL because the contract module does not exist.

- [ ] **Step 3: Implement the validator and document builder**

```ts
export type BestBottlesMarketingHeroPublishInput = {
  groupSlug: string;
  kind: "thumbnail" | "blog" | "social" | "campaign" | "other";
  title: string;
  imageUrl: string;
  assetRole: "marketing" | "scene" | "pdp-primary" | "pdp-secondary";
  providerModel: "nano-banana-pro" | "nano-banana-2" | "openai-image-2" | string;
  lifecycleState: string;
  humanApprovalStatus: string;
  approvedBy: string;
  approvedAt: string;
  themeId: string;
  madisonRenderId: string;
  notes?: string;
};

export function validateBestBottlesMarketingHeroPublish(
  input: unknown,
): { ok: true; value: BestBottlesMarketingHeroPublishInput; documentId: string }
 | { ok: false; errors: string[] };
```

`buildBestBottlesMarketingHeroDocument` must emit `_type: "marketingHeroAsset"` plus all provenance and the uploaded image reference. No Convex, Shopify, or SKU-job field may appear.

- [ ] **Step 4: Run tests and confirm GREEN**

Run: `npx tsx --test supabase/functions/_shared/bestBottlesMarketingHeroPublish.test.ts`  
Expected: all contract cases pass.

### Task 5: Dedicated authenticated Madison-to-Sanity action

**Files:**
- Modify: `supabase/functions/push-sanity-placement/index.ts`
- Create: `src/lib/bestBottlesMarketingHeroPublishClient.ts`
- Create: `src/lib/bestBottlesMarketingHeroPublishClient.test.ts`
- Create: `src/components/library/PublishMarketingHeroDialog.tsx`
- Modify: `src/pages/ImageLibrary.tsx`

**Interfaces:**
- Consumes: Task 4 validator/document builder and existing authenticated Sanity connection resolution.
- Produces: dry-run-first `action: "publishMarketingHero"` request and UI.

- [ ] **Step 1: Write failing client-builder tests**

Test that `buildBestBottlesMarketingHeroPublishRequest(row, form)` copies the render's immutable role/provider/QA/theme/render ID rather than accepting editable overrides, defaults `dryRun` to `true`, and throws for an ineligible row.

- [ ] **Step 2: Run client tests and confirm RED**

Run: `npx tsx --test src/lib/bestBottlesMarketingHeroPublishClient.test.ts`  
Expected: FAIL because the client module does not exist.

- [ ] **Step 3: Implement the client builder**

The UI may edit only `title`, `kind`, `groupSlug`, and `notes`. Role, provider, lifecycle, theme, render ID, approval status, approver, approval time, and URL come from the selected generated-image row.

- [ ] **Step 4: Extend the Edge Function with a dedicated action**

Add `PublishMarketingHeroBody` to `RequestBody`. After authentication, organization membership, and connection resolution:

1. validate the complete body with Task 4;
2. on dry run, return the document ID and normalized document preview without fetching the image or calling Sanity mutation;
3. on apply, require the connection's write token, upload the image, then `createOrReplace` the deterministic document;
4. record the existing audit log with destination key `marketing_hero_asset`;
5. never call the generic field-patching destination path.

- [ ] **Step 5: Add the dedicated dialog and Image Library action**

The dialog opens only when the row is a Best Bottles `marketing`/`scene` render with a recognized provider/theme, passing QA, and explicit approval. It opens in dry-run mode. The first success message states the deterministic target; a separate user action can clear dry-run later. Ineligible rows show the exact blocking reason and never invoke the function.

- [ ] **Step 6: Run the publisher tests**

Run: `npx tsx --test src/lib/bestBottlesMarketingHeroPublishClient.test.ts supabase/functions/_shared/bestBottlesMarketingHeroPublish.test.ts`  
Expected: PASS with no network calls.

### Task 6: Madison regression verification

**Files:**
- Verify only; do not modify unrelated files to hide failures.

- [ ] **Step 1: Run the complete Best Bottles image contract suite**

Run: `npm run test:bestbottles:image-coverage`  
Expected: 383/383 existing tests plus the newly added tests pass; update the expected count only if the script's actual test total grows because of these new files.

- [ ] **Step 2: Run the real typecheck and diff against baseline**

Run: `npx tsc -p tsconfig.app.json --noEmit`  
Expected: no errors in files changed by this plan; pre-existing errors, if any, are recorded separately and are not suppressed.

- [ ] **Step 3: Inspect the dirty diff**

Run: `git diff -- src/config/bestBottlesMarketingHeroThemes.ts src/config/bestBottlesMarketingHeroThemes.test.ts src/lib/bestBottlesImageReconciliationRules.ts src/lib/bestBottlesImageReconciliation.test.ts src/components/darkroom/MastersTabPanel.tsx src/hooks/useAssembledPromptGeneration.ts supabase/functions/_shared/bestBottlesMarketingHeroPublish.ts supabase/functions/_shared/bestBottlesMarketingHeroPublish.test.ts supabase/functions/push-sanity-placement/index.ts src/lib/bestBottlesMarketingHeroPublishClient.ts src/lib/bestBottlesMarketingHeroPublishClient.test.ts src/components/library/PublishMarketingHeroDialog.tsx src/pages/ImageLibrary.tsx package.json`  
Expected: only the approved marketing vertical slice is present; existing unrelated hunks in shared dirty files remain intact.

- [ ] **Step 4: Stop before external effects**

Do not deploy the Edge Function, generate an image, write Sanity, stage, commit, or push. Report the verified local result and request Jordan's next authorization.

## Commit policy

The writing-plans template normally includes a commit after every task. Jordan's explicit project rule overrides that default: no commit or staging step is permitted until Jordan says so.
