# Best Bottles V6 Model-Owned Shadow Smoke Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a fail-closed, exact-SKU V6.1 experiment in which GPT Image 2 owns the shadow for `GB-SPR-CLR-3ML-BLK`, Madison preserves and measures that shadow without painting a second one, and approval remains blocked unless geometry and shadow QA pass.

**Architecture:** Resolve a versioned shadow policy from exact Grace SKU identity and carry it through prompt compilation, the Edge Function, rig post-processing, reconciliation, and review UI. Isolate model-shadow pixels in a baseline-bounded connected component so they survive Bone recanvas but never affect product geometry. Leave V6.0 and deterministic rig ownership unchanged for every other SKU.

**Tech Stack:** TypeScript, React, Node test runner through `tsx --test`, Supabase Edge Functions, PostgreSQL migrations/RPC tests, Canvas `ImageData`, Vite.

## Global Constraints

- Experimental SKU: `GB-SPR-CLR-3ML-BLK`; website SKU: `GBSpry3mlClBlk`.
- Default version remains `best-bottles-reference-locked-v6.0`; experiment is exactly `best-bottles-reference-locked-v6.1-shadow-smoke`.
- Shadow owner is exactly `rig` or `model`; both authorities may never execute on one image.
- Experimental prompt contains exactly one `GROUNDING SHADOW — MODEL OWNED:` block.
- Prompt target: 32–42% densest contact point and 20–30% bottle-width back-right feather.
- Canvas remains `2080 × 2288`; Bone remains `#F6EFE8`; geometry gates remain unchanged.
- Model-owned approval requires persisted `shadow_qa.status = 'pass'`.
- Never overwrite an approved image or perform a paid generation, production migration, Edge deployment, Shopify push, or Convex synchronization without separate action-time authorization.

## File Map

**Create**

- `src/lib/bestBottlesShadowPolicy.ts` and `.test.ts` — exact-SKU policy and lineage tags.
- `src/lib/product-image/shadowQa.ts` and `.test.ts` — connected shadow extraction, preservation mask, and QA.
- `src/hooks/useBestBottlesApprovedComparison.ts` — exact-SKU approved-image lookup for the smoke comparison.
- `src/components/bestbottles/ShadowSmokeComparisonPanel.tsx` — identical-scale V6.0/V6.1 review pair.
- `supabase/migrations/20260712001000_best_bottles_model_shadow_evidence.sql` — durable shadow evidence and approval gate.

**Modify**

- `src/lib/bestBottlesGenerationIdentity.ts` and `.test.ts`
- `src/lib/bestBottlesPromptCompiler.ts`
- `src/config/bestBottlesCatalogCanon.ts`
- `src/lib/bestBottlesCatalogCanonPrompt.ts` and `.test.ts`
- `src/lib/bestBottlesPromptPreflight.ts` and `.test.ts`
- `supabase/functions/_shared/bestBottlesPrecompiledPrompt.ts` and `.test.ts`
- `supabase/functions/generate-madison-image/index.ts`
- `src/lib/product-image/rigPostprocess.ts` and `.test.ts`
- `src/hooks/useAssembledPromptGeneration.ts`
- `src/lib/bestBottlesImageReconciliation.ts` and `.test.ts`
- `src/lib/product-image/rigReview.ts` and `.test.ts`
- `src/components/bestbottles/RigReviewPanel.tsx`
- `src/components/bestbottles/BestBottlesReconciliationBadges.tsx`
- `src/components/darkroom/MastersTabPanel.tsx`
- `supabase/tests/best_bottles_image_reconciliation.sql`

---

### Task 1: Resolve exact-SKU shadow policy

**Files:**
- Create: `src/lib/bestBottlesShadowPolicy.ts`
- Create: `src/lib/bestBottlesShadowPolicy.test.ts`
- Modify: `src/lib/bestBottlesGenerationIdentity.ts:1-40,350-410`
- Modify: `src/lib/bestBottlesGenerationIdentity.test.ts:1-70`

**Interfaces:**
- Produces: `BestBottlesShadowOwner`, `BestBottlesShadowPolicy`, `resolveBestBottlesShadowPolicy(graceSku)`, `getBestBottlesShadowPolicyTags(policy)`.
- Consumed by: prompt preflight, Masters context/tags, rig options, reconciliation.

- [ ] **Step 1: Write failing policy tests**

```ts
it("selects model ownership only for the black 3 ml smoke SKU", () => {
  assert.deepEqual(resolveBestBottlesShadowPolicy("GB-SPR-CLR-3ML-BLK"), {
    promptVersion: "best-bottles-reference-locked-v6.1-shadow-smoke",
    owner: "model",
    contract: "contact-back-right-v1",
    smokeSku: "GB-SPR-CLR-3ML-BLK",
  });
});

it("keeps every other SKU on V6.0 rig ownership", () => {
  for (const sku of ["GB-SPR-CLR-3ML-WHT", "GB-CYL-CLR-9ML-T-03", null]) {
    assert.deepEqual(resolveBestBottlesShadowPolicy(sku), {
      promptVersion: "best-bottles-reference-locked-v6.0",
      owner: "rig",
      contract: "deterministic-contact-v1",
      smokeSku: null,
    });
  }
});
```

- [ ] **Step 2: Verify RED**

Run `npx tsx --test src/lib/bestBottlesShadowPolicy.test.ts`.

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement the resolver**

```ts
export type BestBottlesShadowOwner = "rig" | "model";
export interface BestBottlesShadowPolicy {
  promptVersion: "best-bottles-reference-locked-v6.0" | "best-bottles-reference-locked-v6.1-shadow-smoke";
  owner: BestBottlesShadowOwner;
  contract: "deterministic-contact-v1" | "contact-back-right-v1";
  smokeSku: "GB-SPR-CLR-3ML-BLK" | null;
}

export function resolveBestBottlesShadowPolicy(graceSku?: string | null): BestBottlesShadowPolicy {
  if (graceSku?.trim().toUpperCase() === "GB-SPR-CLR-3ML-BLK") {
    return {
      promptVersion: "best-bottles-reference-locked-v6.1-shadow-smoke",
      owner: "model",
      contract: "contact-back-right-v1",
      smokeSku: "GB-SPR-CLR-3ML-BLK",
    };
  }
  return {
    promptVersion: "best-bottles-reference-locked-v6.0",
    owner: "rig",
    contract: "deterministic-contact-v1",
    smokeSku: null,
  };
}

export function getBestBottlesShadowPolicyTags(policy: BestBottlesShadowPolicy): string[] {
  return [
    `prompt-version:${policy.promptVersion}`,
    `shadow-owner:${policy.owner}`,
    `shadow-contract:${policy.contract}`,
    ...(policy.smokeSku ? [`shadow-smoke-sku:${policy.smokeSku}`] : []),
  ];
}
```

- [ ] **Step 4: Carry policy through generation identity**

Add `shadowOwner` and `shadowContract` to `BestBottlesGenerationIdentity`. Resolve the policy after `graceSku`, include its version/owner/contract in `stableHash`, and return its version instead of assigning V6.0 unconditionally.

```ts
const shadowPolicy = resolveBestBottlesShadowPolicy(graceSku);
return {
  // existing identity fields
  promptVersion: shadowPolicy.promptVersion,
  shadowOwner: shadowPolicy.owner,
  shadowContract: shadowPolicy.contract,
  rigVersion: BEST_BOTTLES_RIG_VERSION,
};
```

- [ ] **Step 5: Verify GREEN**

Run `npx tsx --test src/lib/bestBottlesShadowPolicy.test.ts src/lib/bestBottlesGenerationIdentity.test.ts`.

Expected: PASS; the V6.0 constant assertion remains true and only the black 3 ml identity reports V6.1/model.

- [ ] **Step 6: Commit**

```bash
git add src/lib/bestBottlesShadowPolicy.ts src/lib/bestBottlesShadowPolicy.test.ts src/lib/bestBottlesGenerationIdentity.ts src/lib/bestBottlesGenerationIdentity.test.ts
git commit -m "feat(best-bottles): resolve model shadow smoke policy"
```

---

### Task 2: Compile one conflict-free experimental prompt

**Files:**
- Modify: `src/lib/bestBottlesPromptCompiler.ts:85-92`
- Modify: `src/config/bestBottlesCatalogCanon.ts:43-105`
- Modify: `src/lib/bestBottlesCatalogCanonPrompt.ts:1-80`
- Modify: `src/lib/bestBottlesCatalogCanonPrompt.test.ts`
- Modify: `src/lib/bestBottlesPromptPreflight.ts:40-75,450-505,610-645`
- Modify: `src/lib/bestBottlesPromptPreflight.test.ts`

**Interfaces:**
- Consumes: Task 1 policy.
- Produces: `PromptRecord.prompt_version`, `PromptRecord.shadow_owner`, coherent prompt, and lineage checklist.

- [ ] **Step 1: Write failing prompt tests**

```ts
function buildThreeMlPreflight(
  graceSku: "GB-SPR-CLR-3ML-BLK" | "GB-SPR-CLR-3ML-WHT",
  websiteSku: "GBSpry3mlClBlk" | "GBSpry3mlClWht",
  capColor: "Black" | "White",
) {
  return buildBestBottlesPromptPreflight({
    product: {
      graceSku,
      websiteSku,
      family: "Cylinder",
      bottleCollection: "Cylinder",
      color: "Clear",
      capacityMl: 3,
      applicator: "Fine Mist Sprayer",
      capColor,
      heightWithCap: "54 ±1 mm",
      heightWithoutCap: "37 ±0.5 mm",
      diameter: "14 ±0.5 mm",
    },
    referenceImagePath: `approved/${websiteSku}.png`,
    bodyMaterial: "clear glass",
    canvas: { widthPx: 2080, heightPx: 2288 },
    system,
  });
}

const smoke = buildThreeMlPreflight("GB-SPR-CLR-3ML-BLK", "GBSpry3mlClBlk", "Black");
const prompt = smoke.record?.final_prompt ?? "";
assert.equal(smoke.record?.prompt_version, "best-bottles-reference-locked-v6.1-shadow-smoke");
assert.equal(smoke.record?.shadow_owner, "model");
assert.equal(prompt.match(/GROUNDING SHADOW — MODEL OWNED:/g)?.length, 1);
assert.doesNotMatch(prompt, /deterministic post-processing responsibilities/i);
assert.doesNotMatch(prompt, /Madison applies both deterministically after generation/i);
assert.match(prompt, /32–42% opacity/);
assert.match(prompt, /20–30% of the bottle's width/);

const sibling = buildThreeMlPreflight("GB-SPR-CLR-3ML-WHT", "GBSpry3mlClWht", "White");
assert.equal(sibling.record?.prompt_version, "best-bottles-reference-locked-v6.0");
assert.equal(sibling.record?.shadow_owner, "rig");
assert.doesNotMatch(sibling.record?.final_prompt ?? "", /MODEL OWNED/);
assert.equal(clearGlassForShadowOwner("rig"), CLEAR_GLASS);
assert.equal(studioDirectionForShadowOwner("rig"), STUDIO_DIRECTION);
assert.equal(finalStudioCheckForShadowOwner("rig"), FINAL_V2_STUDIO_CHECK);
```

- [ ] **Step 2: Verify RED**

Run `npx tsx --test src/lib/bestBottlesCatalogCanonPrompt.test.ts src/lib/bestBottlesPromptPreflight.test.ts`.

Expected: FAIL because prompt records and canon assembly are not policy-aware.

- [ ] **Step 3: Extend `PromptRecord`**

```ts
export interface PromptRecord {
  sku: string;
  reference_image_path: string;
  product_family: string;
  frame_class: string;
  prompt_version: string;
  shadow_owner: "rig" | "model";
  final_prompt: string;
  qa_checklist: string[];
}
```

- [ ] **Step 4: Add the exact model-owned block and policy-safe canon helpers**

```ts
export const MODEL_OWNED_GROUNDING_SHADOW = `GROUNDING SHADOW — MODEL OWNED:
Render one soft, clearly visible contact shadow attached directly to the bottle base. It must be darkest and most concentrated at the physical contact line, approximately 32–42% opacity at its densest point, then feather softly behind and toward camera-right, fading within approximately 20–30% of the bottle's width. The contact core and extended feather must read as one continuous shadow. One soft key light creates one soft-edged shadow. No detached oval, gap beneath the bottle, hard outline, long dramatic cast, doubled shadow, reflection, floor plane, smear, or horizon.`;
```

Add `clearGlassForShadowOwner(owner)`, `studioDirectionForShadowOwner(owner)`, and `finalStudioCheckForShadowOwner(owner)`. For `rig`, return current exports byte-for-byte. For `model`, replace only the deterministic policy sentences and append this final-check sentence: `The resolved model-owned contact-shadow contract is permitted only for this exact smoke SKU and does not weaken product identity, geometry, material, canvas, or framing authority.` Throw if any exact source text is missing, preventing silent prompt drift.

- [ ] **Step 5: Make framing and canon assembly policy-aware**

For `model`, emit `MODEL_OWNED_GROUNDING_SHADOW` in the framing profile and the model-safe canon variants. For `rig`, preserve `BEST_BOTTLES_CONTACT_SHADOW_DIRECTIVE` and existing canon strings unchanged.

```ts
const policy = resolveBestBottlesShadowPolicy(sku.sku);
const canonParts = buildBestBottlesCatalogCanonPromptParts(sku, policy);
return [
  canonParts.basePrompt,
  buildFramingProfilePrompt(getBestBottlesCatalogFramingProfile(product), policy),
  canonParts.finalStudioDirection, // model variant includes the experimental final-check sentence
].filter(Boolean).join("\n\n");
```

- [ ] **Step 6: Store policy in preflight record/checklist**

```ts
const record: PromptRecord = {
  sku: sku.sku,
  reference_image_path: sku.reference_image_path,
  product_family: sku.product_family,
  frame_class: sku.frame_class,
  prompt_version: policy.promptVersion,
  shadow_owner: policy.owner,
  final_prompt: finalPrompt,
  qa_checklist: Array.from(new Set([
    ...moduleQaChecklist,
    ...canvasPreflight.qaChecklist,
    ...getBestBottlesShadowPolicyTags(policy),
    BEST_BOTTLES_CATALOG_CANON_PROMPT_FLAG,
    `catalog_canon_source:${BEST_BOTTLES_CATALOG_CANON_SOURCE_PATH}`,
  ])),
};
```

- [ ] **Step 7: Verify GREEN**

Run `npx tsx --test src/lib/bestBottlesCatalogCanonPrompt.test.ts src/lib/bestBottlesPromptPreflight.test.ts`.

Expected: PASS; experimental prompt has one authority, all non-smoke fixtures retain V6.0.

- [ ] **Step 8: Commit**

```bash
git add src/lib/bestBottlesPromptCompiler.ts src/config/bestBottlesCatalogCanon.ts src/lib/bestBottlesCatalogCanonPrompt.ts src/lib/bestBottlesCatalogCanonPrompt.test.ts src/lib/bestBottlesPromptPreflight.ts src/lib/bestBottlesPromptPreflight.test.ts
git commit -m "feat(best-bottles): compile model-owned shadow smoke prompt"
```

---

### Task 3: Enforce the exact experiment in the Edge Function

**Files:**
- Modify: `supabase/functions/_shared/bestBottlesPrecompiledPrompt.ts:1-180`
- Modify: `supabase/functions/_shared/bestBottlesPrecompiledPrompt.test.ts:1-240`
- Modify: `supabase/functions/generate-madison-image/index.ts:2045-2070`

**Interfaces:**
- Consumes: Task 2 prompt record.
- Produces: `BestBottlesPrecompiledPromptResolution.promptVersion` and `.shadowOwner`.

- [ ] **Step 1: Add failing allowlist/conflict tests**

```ts
const accepted = resolveBestBottlesPrecompiledPrompt(smokeRecord, {
  isBestBottlesStudioMasterRequest: true,
});
assert.equal(accepted.error, null);
assert.equal(accepted.promptVersion, "best-bottles-reference-locked-v6.1-shadow-smoke");
assert.equal(accepted.shadowOwner, "model");

const wrongSku = resolveBestBottlesPrecompiledPrompt(
  { ...smokeRecord, sku: "GB-SPR-CLR-3ML-WHT" },
  { isBestBottlesStudioMasterRequest: true },
);
assert.match(wrongSku.error ?? "", /not allowlisted/i);

const mixed = resolveBestBottlesPrecompiledPrompt(
  { ...smokeRecord, final_prompt: `${smokeRecord.final_prompt}\nMadison applies both deterministically after generation.` },
  { isBestBottlesStudioMasterRequest: true },
);
assert.match(mixed.error ?? "", /conflicting shadow ownership/i);
```

- [ ] **Step 2: Verify RED**

Run `npx tsx --test supabase/functions/_shared/bestBottlesPrecompiledPrompt.test.ts`.

Expected: FAIL because the resolver ignores prompt version and owner.

- [ ] **Step 3: Validate the model-owned record before canonicalization**

Add nullable `promptVersion` and `shadowOwner` fields to all resolution/error returns. Read `prompt_version` and `shadow_owner` from the record. For model ownership require exact SKU, exact version, `shadow-owner:model`, `shadow-contract:contact-back-right-v1`, exactly one model block, and no deterministic phrases.

```ts
if (shadowOwner === "model") {
  if (sku.toUpperCase() !== "GB-SPR-CLR-3ML-BLK") {
    return errorResult(`Model-owned shadow is not allowlisted for ${sku}.`);
  }
  if (promptVersion !== "best-bottles-reference-locked-v6.1-shadow-smoke") {
    return errorResult(`Model-owned shadow for ${sku} requires the V6.1 smoke prompt version.`);
  }
  if (!qaChecklist.includes("shadow-owner:model") ||
      !qaChecklist.includes("shadow-contract:contact-back-right-v1")) {
    return errorResult(`Model-owned shadow for ${sku} is missing policy QA lineage.`);
  }
  const blockCount = (prompt.match(/GROUNDING SHADOW — MODEL OWNED:/g) ?? []).length;
  const mixedAuthority = /deterministic post-processing responsibilities|Madison applies both deterministically after generation/i.test(prompt);
  if (blockCount !== 1 || mixedAuthority) {
    return errorResult(`Model-owned shadow for ${sku} has conflicting shadow ownership.`);
  }
}
const resolvedPrompt = shadowOwner === "model"
  ? prompt
  : qaChecklist.includes("catalog_canon_v3_prompt")
    ? ensureBestBottlesStudioDirection(prompt)
    : prompt;
```

- [ ] **Step 4: Include policy in the existing server log**

```ts
console.log("[generate-madison-image] Using precompiled Best Bottles prompt", {
  sku: precompiledPromptResolution.sku,
  promptVersion: precompiledPromptResolution.promptVersion,
  shadowOwner: precompiledPromptResolution.shadowOwner,
  qaCount: precompiledPromptResolution.qaChecklist.length,
});
```

- [ ] **Step 5: Verify GREEN**

Run `npx tsx --test supabase/functions/_shared/bestBottlesPrecompiledPrompt.test.ts`.

Expected: PASS; exact smoke accepted, mixed/non-allowlisted records rejected, V6.0 behavior unchanged.

- [ ] **Step 6: Commit**

```bash
git add supabase/functions/_shared/bestBottlesPrecompiledPrompt.ts supabase/functions/_shared/bestBottlesPrecompiledPrompt.test.ts supabase/functions/generate-madison-image/index.ts
git commit -m "feat(best-bottles): enforce model shadow smoke prompt"
```

---

### Task 4: Analyze and preserve one connected model shadow

**Files:**
- Create: `src/lib/product-image/shadowQa.ts`
- Create: `src/lib/product-image/shadowQa.test.ts`

**Interfaces:**
- Produces: `ShadowQaStatus`, `ShadowQaReport`, `ModelShadowAnalysis`, `analyzeModelOwnedShadow(input)`.
- Consumed by: rig post-processing and reconciliation/review.

- [ ] **Step 1: Write failing synthetic tests**

Build `400 × 440` Bone fixtures with product bounds `{ left: 170, right: 230, top: 90, bottom: 360 }` and baseline `360`. Assert a continuous back-right feather passes and detached, doubled, absent, overlong, and floor-seam fixtures fail or require review.

```ts
function makeShadowFixture(kind: "good" | "detached" | "double" | "absent") {
  const width = 400;
  const height = 440;
  const background = { r: 246, g: 239, b: 232 };
  const pixels = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < pixels.length; i += 4) {
    pixels[i] = background.r;
    pixels[i + 1] = background.g;
    pixels[i + 2] = background.b;
    pixels[i + 3] = 255;
  }
  const paint = (left: number, top: number, right: number, bottom: number, delta: number) => {
    for (let y = top; y <= bottom; y += 1) for (let x = left; x <= right; x += 1) {
      const i = (y * width + x) * 4;
      pixels[i] = background.r - delta;
      pixels[i + 1] = background.g - delta;
      pixels[i + 2] = background.b - delta;
    }
  };
  paint(170, 90, 230, 360, 120);
  if (kind === "good") {
    paint(214, 361, 246, 363, 32);
    paint(226, 364, 247, 368, 14);
  } else if (kind === "detached") {
    paint(214, 367, 247, 372, 28);
  } else if (kind === "double") {
    paint(214, 361, 246, 364, 28);
    paint(235, 371, 255, 374, 20);
  }
  return {
    pixels,
    width,
    height,
    background,
    productBounds: { left: 170, right: 230, top: 90, bottom: 360 },
    baselineYPx: 360,
  };
}

const good = analyzeModelOwnedShadow(makeShadowFixture("good"));
assert.equal(good.report.status, "pass");
assert.ok((good.report.measurements.contactGapPx ?? 99) <= 2);
assert.ok((good.report.measurements.rightExtensionRatio ?? 0) >= 0.2);
assert.ok((good.report.measurements.rightExtensionRatio ?? 1) <= 0.32);
assert.ok(good.preservationMask.some((value) => value === 1));

assert.equal(analyzeModelOwnedShadow(makeShadowFixture("detached")).report.status, "fail");
assert.match(analyzeModelOwnedShadow(makeShadowFixture("detached")).report.failures.join(" "), /contact gap/i);
assert.equal(analyzeModelOwnedShadow(makeShadowFixture("double")).report.status, "fail");
assert.match(analyzeModelOwnedShadow(makeShadowFixture("double")).report.failures.join(" "), /multiple connected/i);
assert.equal(analyzeModelOwnedShadow(makeShadowFixture("absent")).report.status, "review");
```

- [ ] **Step 2: Verify RED**

Run `npx tsx --test src/lib/product-image/shadowQa.test.ts`.

Expected: FAIL because the analyzer does not exist.

- [ ] **Step 3: Define durable report types**

```ts
export type ShadowQaStatus = "pass" | "review" | "fail";
export interface ShadowQaReport {
  status: ShadowQaStatus;
  failures: string[];
  warnings: string[];
  measurements: {
    contactGapPx: number | null;
    contactCoreDensity: number | null;
    rightExtensionPx: number | null;
    rightExtensionRatio: number | null;
    leftExtensionPx: number | null;
    verticalDepthPx: number | null;
    componentCount: number;
    shadowPixelCount: number;
  };
  target: {
    maxContactGapPx: 2;
    rightExtensionRatio: { min: 0.2; max: 0.3 };
    contract: "contact-back-right-v1";
  };
}
export interface ModelShadowAnalysis {
  preservationMask: Uint8Array;
  report: ShadowQaReport;
}
```

- [ ] **Step 4: Implement the restricted candidate lane**

```ts
const productWidth = bounds.right - bounds.left + 1;
const laneLeft = Math.max(0, Math.floor(bounds.left - productWidth * 0.1));
const laneRight = Math.min(width - 1, Math.ceil(bounds.right + productWidth * 0.35));
const laneTop = Math.max(0, baselineYPx - 2);
const laneBottom = Math.min(height - 1, baselineYPx + Math.max(12, Math.round(height * 0.035)));
const candidate = new Uint8Array(width * height);
for (let y = laneTop; y <= laneBottom; y += 1) {
  for (let x = laneLeft; x <= laneRight; x += 1) {
    const i = (y * width + x) * 4;
    const lumaDelta = luma(background) - luma({ r: pixels[i], g: pixels[i + 1], b: pixels[i + 2] });
    const outsideProduct = y > bounds.bottom || x < bounds.left || x > bounds.right;
    if (outsideProduct && pixels[i + 3] > 8 && lumaDelta >= 4) candidate[y * width + x] = 1;
  }
}
```

- [ ] **Step 5: Implement 8-neighbor component QA**

Flood-fill `candidate`. A seeded component must contain a pixel at `y <= baselineYPx + 2` within `bounds.left - 2 ... bounds.right + 2`. Preserve the largest seeded component. Record other material components for singularity failure. Return:

- `review` when no reliable seeded component exists;
- `fail` when contact gap exceeds 2, more than one material component exists, the lower feather is darker than the contact band, right extension exceeds `0.32`, left extension exceeds `0.12`, or depth exceeds `height * 0.035`;
- `pass` otherwise, with a warning for extension ratios `0.18–0.20` or `0.30–0.32`.

The returned `preservationMask` contains `1` only for the retained connected component.

- [ ] **Step 6: Verify GREEN**

Run `npx tsx --test src/lib/product-image/shadowQa.test.ts`.

Expected: PASS for grounded fixture; expected decisions for every negative fixture.

- [ ] **Step 7: Commit**

```bash
git add src/lib/product-image/shadowQa.ts src/lib/product-image/shadowQa.test.ts
git commit -m "feat(best-bottles): add model shadow QA"
```

---

### Task 5: Make the rig honor shadow ownership

**Files:**
- Modify: `src/lib/product-image/rigPostprocess.ts:13-115,1000-1070,1240-1625`
- Modify: `src/lib/product-image/rigPostprocess.test.ts`
- Modify: `src/hooks/useAssembledPromptGeneration.ts:90-125,560-810`
- Modify: `src/components/darkroom/MastersTabPanel.tsx:2800-2890`

**Interfaces:**
- Consumes: Tasks 1 and 4.
- Produces: `finalizeRigShadow(input)`, `RigBaselineNormalizeResult.shadowOwner`, `.shadowQa`, and reviewable model-shadow candidates.

- [ ] **Step 1: Add failing rig ownership tests**

```ts
it("preserves a model-owned shadow mask during Bone recanvas", () => {
  const result = prepareUnmaskedRigRecanvasPixels(
    pixels,
    width,
    height,
    bone,
    productBounds,
    { preserveMask: shadowMask },
  );
  assert.deepEqual(read(shadowX, shadowY), originalShadowPixel);
  assert.deepEqual(read(0, 0), [bone.r, bone.g, bone.b, 255]);
  assert.ok(result.preservedShadowPixels > 0);
});

it("skips deterministic paint when the model owns the shadow", () => {
  const output = finalizeRigShadow({
    owner: "model",
    pixels,
    width,
    height,
    background: bone,
    objectBounds: productBounds,
    baselineYPx: baseline,
  });
  assert.equal(output.deterministicShadowPixels, 0);
  assert.equal(output.shadowQa?.status, "pass");
});

it("retains deterministic paint for rig ownership", () => {
  const output = finalizeRigShadow({
    owner: "rig",
    pixels,
    width,
    height,
    background: bone,
    objectBounds: productBounds,
    baselineYPx: baseline,
  });
  assert.ok(output.deterministicShadowPixels > 0);
  assert.equal(output.shadowQa, null);
});
```

- [ ] **Step 2: Verify RED**

Run `npx tsx --test --test-name-pattern='shadow owner|model-owned shadow mask' src/lib/product-image/rigPostprocess.test.ts`.

Expected: FAIL because options/results do not expose ownership or preservation masks.

- [ ] **Step 3: Extend options/results with safe defaults**

```ts
export interface RigBaselineNormalizeOptions {
  // existing fields
  shadowOwner?: BestBottlesShadowOwner;
}
export interface RigBaselineNormalizeResult {
  // existing fields
  shadowOwner: BestBottlesShadowOwner;
  shadowQa: ShadowQaReport | null;
}
```

Resolve `const shadowOwner = options.shadowOwner === "model" ? "model" : "rig";` once. Every early return must include this owner and `shadowQa: null`.

- [ ] **Step 4: Preserve the source shadow mask**

Extend `prepareUnmaskedRigRecanvasPixels` with `options: { preserveMask?: Uint8Array } = {}` and add `preservedShadowPixels` to its result.

```ts
if (options.preserveMask?.[p] === 1) {
  pixels[i + 3] = 255;
  preservedShadowPixels += 1;
  continue;
}
```

After raw bounds/baseline detection and before recanvas, call `analyzeModelOwnedShadow` against the sampled raw background only for model ownership, then pass its mask into recanvas. The product and preserved shadow pass through the same scale/translation.

- [ ] **Step 5: Select exactly one final shadow authority**

Export `finalizeRigShadow` with the input used by Step 1. It calls `analyzeModelOwnedShadow` for `model`; otherwise it calls `addDeterministicContactShadow` and returns its pixel count with `shadowQa: null`. Use this helper in both mask-controlled and unmasked returns:

```ts
const finalShadow = finalizeRigShadow({
  owner: shadowOwner,
  pixels: finalImageData.data,
  width,
  height,
  background: bg,
  objectBounds: finalBounds,
  baselineYPx: finalBaseline,
});
```

Return `shadowOwner` and `shadowQa: finalShadow.shadowQa`. Never merge shadow pixels into `framingQa`, `objectBounds`, fill height, baseline, or centerline.

- [ ] **Step 6: Pass policy through Masters and generation hook**

Add `shadowOwner` and `shadowContract` to `productContext`; add `getBestBottlesShadowPolicyTags(policy)` to Library tags; pass owner to `normalizeBestBottlesRigBaseline`.

```ts
shadowOwner: options.productContext?.shadowOwner === "model" ? "model" : "rig",
```

- [ ] **Step 7: Retain geometry-valid shadow-review candidates**

Keep the existing throw for `rigged.qaIssues` because those remain geometry failures. After upload, persist lifecycle as:

```ts
const lifecycleState = rigged.shadowOwner !== "model" || rigged.shadowQa?.status === "pass"
  ? "qa-passed"
  : rigged.shadowQa?.status === "fail"
    ? "qa-failed"
    : "review-pending";
```

Return the uploaded candidate even when shadow status is `review` or `fail`; Task 6 blocks approval. Do not silently apply the deterministic fallback to that same image.

- [ ] **Step 8: Verify GREEN**

Run:

```bash
npx tsx --test src/lib/product-image/shadowQa.test.ts src/lib/product-image/rigPostprocess.test.ts src/lib/product-image/familyRig.test.ts src/lib/bestBottlesImageReconciliation.test.ts
```

Expected: PASS; rig-owned regression tests remain unchanged and model-owned fixtures receive no deterministic pixels.

- [ ] **Step 9: Commit**

```bash
git add src/lib/product-image/rigPostprocess.ts src/lib/product-image/rigPostprocess.test.ts src/hooks/useAssembledPromptGeneration.ts src/components/darkroom/MastersTabPanel.tsx
git commit -m "feat(best-bottles): preserve model-owned shadow through rig"
```

---

### Task 6: Persist shadow evidence and block approval until pass

**Files:**
- Create: `supabase/migrations/20260712001000_best_bottles_model_shadow_evidence.sql`
- Modify: `supabase/tests/best_bottles_image_reconciliation.sql`
- Modify: `src/lib/bestBottlesImageReconciliation.ts:70-180,200-285`
- Modify: `src/lib/bestBottlesImageReconciliation.test.ts`
- Modify: `src/lib/product-image/rigReview.ts:1-130`
- Modify: `src/lib/product-image/rigReview.test.ts`
- Modify: `src/components/bestbottles/RigReviewPanel.tsx:1-240`
- Modify: `src/components/bestbottles/BestBottlesReconciliationBadges.tsx:70-135`
- Create: `src/hooks/useBestBottlesApprovedComparison.ts`
- Create: `src/components/bestbottles/ShadowSmokeComparisonPanel.tsx`
- Modify: `src/components/darkroom/MastersTabPanel.tsx:5165-5225`

**Interfaces:**
- Consumes: `BestBottlesShadowOwner`, `ShadowQaReport`.
- Produces: `buildBestBottlesRigReconciliationPayload(input)`, durable evidence, SQL approval predicate, and a required review gate.

- [ ] **Step 1: Add failing client tests**

Place the payload assertions in `bestBottlesImageReconciliation.test.ts`. Place the approval assertions in `rigReview.test.ts`, reusing that file's existing `passingReview()` and `confirmed` fixtures. Define the same `shadowQa()` fixture helper in each file so neither test depends on cross-file state.

```ts
function shadowQa(status: "pass" | "review"): ShadowQaReport {
  return {
    status,
    failures: [],
    warnings: [],
    measurements: {
      contactGapPx: 0,
      contactCoreDensity: 0.36,
      rightExtensionPx: 18,
      rightExtensionRatio: 0.28,
      leftExtensionPx: 2,
      verticalDepthPx: 8,
      componentCount: 1,
      shadowPixelCount: 120,
    },
    target: {
      maxContactGapPx: 2,
      rightExtensionRatio: { min: 0.2, max: 0.3 },
      contract: "contact-back-right-v1",
    },
  };
}

const payload = buildBestBottlesRigReconciliationPayload({
  imageId: "image-1",
  organizationId: "org-1",
  rawImageUrl: "https://example.invalid/raw.png",
  shadowOwner: "model",
  shadowQa: shadowQa("pass"),
  lifecycleState: "qa-passed",
});
assert.equal(payload.shadow_owner, "model");
assert.deepEqual(payload.shadow_qa, shadowQa("pass"));

assert.equal(
  isRigApprovalReady(passingReview({ shadowOwner: "model", shadowQa: shadowQa("review") }), confirmed),
  false,
);
assert.equal(
  isRigApprovalReady(passingReview({ shadowOwner: "rig", shadowQa: null }), confirmed),
  true,
);
```

- [ ] **Step 2: Verify RED**

Run `npx tsx --test src/lib/bestBottlesImageReconciliation.test.ts src/lib/product-image/rigReview.test.ts`.

Expected: FAIL because persistence and review types lack shadow evidence.

- [ ] **Step 3: Add migration columns and SQL approval predicate**

```sql
ALTER TABLE public.best_bottles_image_reconciliations
  ADD COLUMN IF NOT EXISTS shadow_owner TEXT NOT NULL DEFAULT 'rig'
    CHECK (shadow_owner IN ('rig', 'model')),
  ADD COLUMN IF NOT EXISTS shadow_qa JSONB;

COMMENT ON COLUMN public.best_bottles_image_reconciliations.shadow_owner IS
  'Single shadow authority for this image: deterministic rig or image model.';
COMMENT ON COLUMN public.best_bottles_image_reconciliations.shadow_qa IS
  'Versioned model-shadow measurements and pass/review/fail decision.';
```

Recreate `approve_best_bottles_reconciled_image` with all existing predicates plus:

```sql
AND (
  r.shadow_owner = 'rig'
  OR (
    r.shadow_owner = 'model'
    AND r.shadow_qa->>'status' = 'pass'
    AND r.shadow_qa->'target'->>'contract' = 'contact-back-right-v1'
  )
)
```

Recreate `best_bottles_image_reconciliation_status` with this case before `unlinked`:

```sql
WHEN r.shadow_owner = 'model' AND COALESCE(r.shadow_qa->>'status', 'review') <> 'pass'
  THEN 'review-pending'
```

- [ ] **Step 4: Extend local SQL assertions**

Insert a model-owned row with `shadow_qa.status = 'review'`, assert approval raises, update it to the complete passing report, assert approval succeeds, and confirm an existing rig-owned row remains eligible with `shadow_qa IS NULL`.

Run:

```bash
supabase db reset
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -v ON_ERROR_STOP=1 -f supabase/tests/best_bottles_image_reconciliation.sql
```

Expected: no SQL assertion exception.

- [ ] **Step 5: Extend client status/input/payload types**

```ts
shadow_owner: BestBottlesShadowOwner;
shadow_qa: ShadowQaReport | null;
// write input
shadowOwner?: BestBottlesShadowOwner;
shadowQa?: ShadowQaReport | null;
```

Extract the current rig upsert object into `buildBestBottlesRigReconciliationPayload`, set `shadow_owner` and `shadow_qa` there, and have `recordBestBottlesRigResult` upsert that return value. Set the same fields in raw upserts. Pass rig evidence from success/failure recording in `useAssembledPromptGeneration`.

- [ ] **Step 6: Add the model-shadow requirement to approval readiness**

Extend `RigReviewRequirement.id` with `shadow` and append:

```ts
const shadowPass = review.shadowOwner === "rig" || review.shadowQa?.status === "pass";
{
  id: "shadow",
  label: review.shadowOwner === "model"
    ? "Model-owned grounding shadow"
    : "Deterministic grounding shadow",
  detail: review.shadowOwner === "model"
    ? review.shadowQa
      ? `${review.shadowQa.status} · gap ${review.shadowQa.measurements.contactGapPx ?? "—"}px · right ${review.shadowQa.measurements.rightExtensionRatio ?? "—"}× width`
      : "Model-shadow evidence is missing."
    : "Madison deterministic contact shadow applied after geometry QA.",
  status: shadowPass ? "pass" : "fail",
}
```

`isRigApprovalReady` already requires every requirement to pass; do not add a bypass.

- [ ] **Step 7: Add the exact-SKU approved comparison lookup**

```ts
export function useBestBottlesApprovedComparison(
  organizationId: string | null,
  graceSku: string | null,
) {
  return useQuery({
    queryKey: ["best-bottles-approved-comparison", organizationId, graceSku],
    enabled: Boolean(organizationId && graceSku === "GB-SPR-CLR-3ML-BLK"),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("best_bottles_pipeline_sku_jobs")
        .select("approved_image_id,approved_image_url")
        .eq("organization_id", organizationId!)
        .eq("grace_sku", graceSku!)
        .maybeSingle();
      if (error) throw error;
      return data?.approved_image_url ?? null;
    },
  });
}
```

- [ ] **Step 8: Surface identical-scale comparison and evidence**

Create `ShadowSmokeComparisonPanel` with props `{ approvedImageUrl: string; candidateImageUrl: string }`. Render two equal-width `aspect-[2080/2288]` image cells labeled `Current approved · V6.0 rig shadow` and `Candidate · V6.1 model shadow`, both using `object-contain` and the same background. Render it only when `result.rigReview.shadowOwner === "model"` and an approved URL exists.

Add Shadow Owner and Shadow Spread metrics to `RigReviewPanel`, plus failures/warnings beneath Requirements. Append owner, status, gap, extension ratio, component count, and failures to `BestBottlesReconciliationBadges` tooltip. Keep approval exclusively on the existing RPC-backed button.

- [ ] **Step 9: Verify GREEN**

Run:

```bash
npx tsx --test src/lib/bestBottlesImageReconciliation.test.ts src/lib/product-image/rigReview.test.ts src/lib/product-image/shadowQa.test.ts
```

Expected: PASS; model review/fail blocks approval, model pass and legacy rig ownership remain compatible with existing gates.

- [ ] **Step 10: Commit**

```bash
git add supabase/migrations/20260712001000_best_bottles_model_shadow_evidence.sql supabase/tests/best_bottles_image_reconciliation.sql src/lib/bestBottlesImageReconciliation.ts src/lib/bestBottlesImageReconciliation.test.ts src/lib/product-image/rigReview.ts src/lib/product-image/rigReview.test.ts src/components/bestbottles/RigReviewPanel.tsx src/components/bestbottles/BestBottlesReconciliationBadges.tsx src/hooks/useBestBottlesApprovedComparison.ts src/components/bestbottles/ShadowSmokeComparisonPanel.tsx src/components/darkroom/MastersTabPanel.tsx src/hooks/useAssembledPromptGeneration.ts
git commit -m "feat(best-bottles): persist model shadow approval evidence"
```

---

### Task 7: Verify locally, then stop for deployment and paid-smoke authorization

**Files:**
- Modify only if verification exposes a defect in files owned by Tasks 1–6.
- Never edit the V6.0 default prompt merely to make the experimental test pass.

**Interfaces:**
- Consumes: Tasks 1–6.
- Produces: verified local build and an external-action checklist; no production mutation.

- [ ] **Step 1: Run focused feature tests**

```bash
npx tsx --test \
  src/lib/bestBottlesShadowPolicy.test.ts \
  src/lib/bestBottlesGenerationIdentity.test.ts \
  src/lib/bestBottlesCatalogCanonPrompt.test.ts \
  src/lib/bestBottlesPromptPreflight.test.ts \
  supabase/functions/_shared/bestBottlesPrecompiledPrompt.test.ts \
  src/lib/product-image/shadowQa.test.ts \
  src/lib/product-image/rigPostprocess.test.ts \
  src/lib/product-image/rigReview.test.ts \
  src/lib/bestBottlesImageReconciliation.test.ts
```

Expected: zero failures.

- [ ] **Step 2: Prove non-smoke V6.0 stability**

Run the black/white sibling prompt fixtures. Compare the white 3 ml resolved prompt against the pre-change fixture/hash established in Task 2.

Expected: white remains `best-bottles-reference-locked-v6.0`, owner `rig`, no `MODEL OWNED` block, and unchanged deterministic language.

- [ ] **Step 3: Run repository quality gates**

```bash
git diff --check
npx tsc --noEmit
npm run build
```

Expected: all commands exit 0. Existing chunk-size or stale-browser-data warnings may remain; no new TypeScript, CSS, or build failure is accepted.

- [ ] **Step 4: Run a local browser dry check without provider invocation**

Open the black 3 ml Studio route and verify the Actual Server Prompt preview contains:

- version `best-bottles-reference-locked-v6.1-shadow-smoke`;
- one `GROUNDING SHADOW — MODEL OWNED:` block;
- no deterministic-shadow prohibition;
- owner `model` in pending review evidence.

Open the white 3 ml sibling and verify V6.0/rig ownership. Do not click Generate.

- [ ] **Step 5: Commit only focused verification corrections**

If no correction is required, create no empty commit. If a correction is required, stage only files owned by Tasks 1–6:

```bash
git add src/lib/bestBottlesShadowPolicy.ts src/lib/bestBottlesShadowPolicy.test.ts src/lib/bestBottlesGenerationIdentity.ts src/lib/bestBottlesGenerationIdentity.test.ts src/lib/bestBottlesPromptCompiler.ts src/config/bestBottlesCatalogCanon.ts src/lib/bestBottlesCatalogCanonPrompt.ts src/lib/bestBottlesCatalogCanonPrompt.test.ts src/lib/bestBottlesPromptPreflight.ts src/lib/bestBottlesPromptPreflight.test.ts supabase/functions/_shared/bestBottlesPrecompiledPrompt.ts supabase/functions/_shared/bestBottlesPrecompiledPrompt.test.ts supabase/functions/generate-madison-image/index.ts src/lib/product-image/shadowQa.ts src/lib/product-image/shadowQa.test.ts src/lib/product-image/rigPostprocess.ts src/lib/product-image/rigPostprocess.test.ts src/hooks/useAssembledPromptGeneration.ts src/lib/bestBottlesImageReconciliation.ts src/lib/bestBottlesImageReconciliation.test.ts src/lib/product-image/rigReview.ts src/lib/product-image/rigReview.test.ts src/components/bestbottles/RigReviewPanel.tsx src/components/bestbottles/BestBottlesReconciliationBadges.tsx src/hooks/useBestBottlesApprovedComparison.ts src/components/bestbottles/ShadowSmokeComparisonPanel.tsx src/components/darkroom/MastersTabPanel.tsx supabase/migrations/20260712001000_best_bottles_model_shadow_evidence.sql supabase/tests/best_bottles_image_reconciliation.sql
git commit -m "fix(best-bottles): close model shadow smoke verification gap"
```

- [ ] **Step 6: Stop and request action-time authorization**

Report local evidence and request separate authorization for exactly:

1. applying `20260712001000_best_bottles_model_shadow_evidence.sql` to Supabase project `likkskifwsrvszxdvufw`;
2. deploying `generate-madison-image` with the updated shared resolver;
3. running one paid GPT Image 2 generation for `GB-SPR-CLR-3ML-BLK`;
4. creating a new unreviewed candidate only—no approval, Shopify push, or Convex synchronization.

- [ ] **Step 7: After authorization, verify the one live candidate**

Confirm from the returned prompt and reconciliation row:

- exact SKU and experimental version;
- `shadow_owner = 'model'`;
- `shadow_qa.status` and measurements present;
- geometry pass independent of shadow;
- current approved image unchanged;
- new candidate remains unreviewed until side-by-side human confirmation.

Do not expand to another SKU or catalog-wide V6 without a new design decision.
