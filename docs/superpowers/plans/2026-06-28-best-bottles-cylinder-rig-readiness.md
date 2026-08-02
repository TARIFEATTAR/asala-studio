# Best Bottles Cylinder Rig Readiness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Cylinder family safe for controlled GPT Image 2 bulk generation by enforcing deterministic product framing, baseline, geometry QA, and smoke-test gates without changing the Canon prompt.

**Architecture:** Keep `openai-image-2` as the production provider and treat Google providers as comparison-only lanes. The pipeline should assemble the existing Canon prompt, generate a candidate image, measure product bounds against the Convex-derived family profile, then either pass, normalize, or reject the output before it enters the master lane.

**Tech Stack:** React/Vite, Supabase Edge Functions, Supabase Storage, Convex snapshot data, Playwright browser QA, Sharp image metadata tooling, Node test runner via `tsx --test`.

## Global Constraints

- Do not change the Canon prompt as part of this pass.
- Production provider remains `openai-image-2`.
- Google/Gemini/Nano Banana/Imagen remain comparison routes only.
- Every catalog master must use `2080x2288`.
- Every product must share a consistent baseline and centerline unless the SKU is explicitly cap-off/sidecar.
- Cylinder family size bands must be derived from measured product dimensions, not capacity alone.
- Sample vials at `4ml` and below target `55-60%` fill height.
- Slim 13-415 9ml cylinders must be classified by measured height/diameter, not as regular 9ml roll-ons.

---

### Task 1: Lock Provider Policy for Cylinder Production

**Files:**
- Modify: `supabase/functions/_shared/bestBottlesProviderRouting.ts`
- Modify: `supabase/functions/_shared/bestBottlesProviderRouting.test.ts`
- Modify: `supabase/functions/generate-madison-image/index.ts`

**Interfaces:**
- Consumes: request body fields `aiProvider` and `allowBestBottlesProviderOverride`.
- Produces: `shouldForceBestBottlesOpenAIProvider(input): boolean`.

- [ ] **Step 1: Write the failing test**

```ts
test("forces GPT Image 2 for Best Bottles production cylinder requests", () => {
  assert.equal(
    shouldForceBestBottlesOpenAIProvider({
      isBestBottlesReferenceLocked: true,
      allowBestBottlesProviderOverride: false,
    }),
    true,
  );
});

test("allows Google only when an explicit comparison override is passed", () => {
  assert.equal(
    shouldForceBestBottlesOpenAIProvider({
      isBestBottlesReferenceLocked: true,
      allowBestBottlesProviderOverride: true,
    }),
    false,
  );
});
```

- [ ] **Step 2: Run test to verify it fails or protects current behavior**

Run: `npx tsx --test supabase/functions/_shared/bestBottlesProviderRouting.test.ts`

Expected: PASS if the guard already exists; FAIL if production can still route to Google without override.

- [ ] **Step 3: Implement or preserve the provider guard**

```ts
export function shouldForceBestBottlesOpenAIProvider(input: {
  isBestBottlesReferenceLocked: boolean;
  allowBestBottlesProviderOverride?: boolean;
}): boolean {
  return input.isBestBottlesReferenceLocked && input.allowBestBottlesProviderOverride !== true;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx --test supabase/functions/_shared/bestBottlesProviderRouting.test.ts`

Expected: PASS.

### Task 2: Finalize Cylinder Dimension Classification

**Files:**
- Modify: `src/config/bestBottlesFamilyProfiles.ts`
- Modify: `src/config/bestBottlesFamilyProfiles.test.ts`
- Modify: `supabase/functions/_shared/familyRig.ts`
- Modify: `supabase/functions/_shared/familyRig.test.ts`

**Interfaces:**
- Consumes: product metadata `capacityMl`, `heightWithCap`, `heightWithoutCap`, `diameter`, `family`, `bottleCollection`, `applicator`.
- Produces: profile data containing `profileId`, `relativeScaleZoneId`, `targetProductHeightPct`, `targetProductHeightRangePct`, and `baselinePct`.

- [ ] **Step 1: Write the failing regular-vs-slim 9ml tests**

```ts
test("keeps regular 9ml cylinder roll-ons in the smaller band", () => {
  const profile = resolveBestBottlesFamilyProfile({
    family: "Cylinder",
    capacityMl: 9,
    heightWithCap: "83 ±1 mm",
    heightWithoutCap: "70 ±1 mm",
    diameter: "20 ±0.5 mm",
    applicator: "Roller Ball",
  });

  assert.equal(profile?.relativeScaleZoneId, "small-cylinder");
});

test("uses measured slim height for 13-415 9ml cylinder sprayers", () => {
  const profile = resolveBestBottlesFamilyProfile({
    family: "Cylinder",
    capacityMl: 9,
    heightWithCap: "118 ±2 mm",
    heightWithoutCap: "106 ±2 mm",
    diameter: "18 ±0.5 mm",
    applicator: "Fine Mist Sprayer",
  });

  assert.equal(profile?.profileId, "cylinder-standard");
  assert.equal(profile?.relativeScaleZoneId, "standard-cylinder");
});
```

- [ ] **Step 2: Run tests to verify classification**

Run: `npx tsx --test src/config/bestBottlesFamilyProfiles.test.ts supabase/functions/_shared/familyRig.test.ts`

Expected: PASS after the dimension-aware resolver is in place.

### Task 3: Add Read-Only Framing QA Smoke Gate

**Files:**
- Modify: `tmp/bestbottles-live-cylinder-smoke.ts`
- Create: `tmp/bestbottles-cylinder-readonly-framing-qa.mjs`
- Test: `src/lib/product-image/framingQa.test.ts`

**Interfaces:**
- Consumes: smoke-run tag `smoke-run:<runId>` and generated image rows.
- Produces: JSON report with `sku`, `provider`, `modelTag`, `fillHeightPct`, `targetRange`, `baselineDeltaPx`, `centerDeltaPct`, `status`, and `issues`.

- [ ] **Step 1: Write the read-only QA script**

```js
// tmp/bestbottles-cylinder-readonly-framing-qa.mjs
import fs from "node:fs";
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";

const runId = process.argv[2];
if (!runId) throw new Error("Usage: node tmp/bestbottles-cylinder-readonly-framing-qa.mjs <smoke-run-id>");

const ROOT = "/Users/jordanrichter/Projects/Clients/Nemat-International/Best-Bottles-Website-02-20-2026";
const targetBackgroundHex = "#F5F3EF";
const env = Object.fromEntries(
  fs.readFileSync(".env", "utf8")
    .split(/\n/)
    .map((line) => line.match(/^([A-Za-z0-9_]+)=(.*)$/))
    .filter(Boolean)
    .map((match) => [match[1], match[2].replace(/^['"]|['"]$/g, "")]),
);

const supabase = createClient(env.VITE_SUPABASE_URL || env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
```

- [ ] **Step 2: Query smoke rows without mutating them**

```js
const { data: rows, error } = await supabase
  .from("generated_images")
  .select("id,image_url,library_tags,generation_provider,created_at")
  .contains("library_tags", [`smoke-run:${runId}`])
  .order("created_at", { ascending: true });

if (error) throw error;
if (!rows?.length) throw new Error(`No generated_images rows found for ${runId}`);
```

- [ ] **Step 3: Run browser-side QA against each image**

```js
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.goto("http://127.0.0.1:8081/", { waitUntil: "domcontentloaded" });

// Use normalizeBestBottlesRigBaseline only for measurement. Do not upload or update generated_images.
```

- [ ] **Step 4: Verify the script works**

Run: `node tmp/bestbottles-cylinder-readonly-framing-qa.mjs <run-id>`

Expected: JSON prints each SKU with pass/fail and exact measurements; no Supabase rows are updated.

### Task 4: Run GPT Image 2 Cylinder Smoke Test

**Files:**
- Use: `tmp/bestbottles-live-cylinder-smoke.ts`
- Use: `tmp/bestbottles-cylinder-readonly-framing-qa.mjs`

**Interfaces:**
- Consumes: five smoke SKUs: `GB-SPR-CLR-3ML-BLK`, `GB-SPR-CLR-4ML-BLK`, `GB-CYL-CLR-9ML-SPR-SBLK`, `GB-CYL-CLR-28ML-MRL-01`, `GB-CYL-CLR-100ML-ASP-BLK`.
- Produces: generation rows and read-only QA report.

- [ ] **Step 1: Run the five-SKU GPT Image 2 smoke test**

```bash
BB_SMOKE_AI_PROVIDER=openai-image-2 \
BB_SMOKE_REFERENCE_OVERRIDES='GB-CYL-CLR-28ML-MRL-01=/Users/jordanrichter/Projects/Clients/Nemat-International/Best-Bottles-Website-02-20-2026/pipeline/madison-hero-sync/renders/_reframed-refs-cylinder/GB-CYL-CLR-28ML-MRL-01.png' \
npx tsx tmp/bestbottles-live-cylinder-smoke.ts
```

- [ ] **Step 2: Run read-only QA**

```bash
node tmp/bestbottles-cylinder-readonly-framing-qa.mjs <run-id>
```

- [ ] **Step 3: Acceptance criteria**

Expected:
- 3ml and 4ml measure within or near `55-60%`.
- Slim 9ml measures within or near `72-78%`.
- 28ml roller measures within or near `65-70%`.
- 100ml measures within or near `80-84%`.
- Baseline delta is within `±8px`.
- Center delta is within `±1%`.
- No square-body cylinder reinterpretation.

### Task 5: Decide Whether to Normalize or Reject

**Files:**
- Modify: `src/lib/product-image/rigPostprocess.ts`
- Modify: `src/lib/product-image/rigPostprocess.test.ts`
- Modify: `src/lib/product-image/framingQa.ts`
- Modify: `src/lib/product-image/framingQa.test.ts`

**Interfaces:**
- Consumes: QA report from Task 4.
- Produces: deterministic decision policy: `pass`, `normalize`, or `reject`.

- [ ] **Step 1: Add policy tests**

```ts
test("rejects generated cylinders that are far below target fill height", () => {
  const report = buildFramingQaReport({
    canvas: { width: 2080, height: 2288 },
    bounds: { x: 900, y: 900, width: 280, height: 700 },
    rig: {
      profileId: "cylinder-standard",
      relativeScaleZoneId: "standard-cylinder",
      fillHeightPct: 76,
      fillHeightRangePct: { min: 72, max: 78 },
      baselinePct: 9,
      primaryObjectCenterXPct: 50,
    },
  });

  assert.equal(report.status, "fail");
});
```

- [ ] **Step 2: Implement only the minimum policy needed by the data**

```ts
export function getFramingDecision(report: FramingQaReport): "pass" | "normalize" | "reject" {
  const fill = report.measurements.fillHeightPct;
  const range = report.target.fillHeightRangePct;
  if (fill == null) return "reject";
  if (fill < range.min - 12 || fill > range.max + 12) return "reject";
  if (report.status === "pass") return "pass";
  return "normalize";
}
```

- [ ] **Step 3: Run tests**

Run: `npx tsx --test src/lib/product-image/framingQa.test.ts src/lib/product-image/rigPostprocess.test.ts`

Expected: PASS.

### Task 6: Deploy and Re-Test

**Files:**
- Deploy: `supabase/functions/generate-madison-image/index.ts`
- Verify: `tmp/bestbottles-live-cylinder-smoke.ts`

**Interfaces:**
- Consumes: local Edge Function changes.
- Produces: deployed function version and smoke-test report.

- [ ] **Step 1: Deploy Edge Function**

```bash
supabase functions deploy generate-madison-image --project-ref likkskifwsrvszxdvufw --use-api
```

- [ ] **Step 2: Run final focused tests**

```bash
npx tsx --test \
  supabase/functions/_shared/bestBottlesProviderRouting.test.ts \
  src/config/bestBottlesFamilyProfiles.test.ts \
  supabase/functions/_shared/familyRig.test.ts \
  src/lib/product-image/framingQa.test.ts \
  src/lib/product-image/rigPostprocess.test.ts
```

Expected: PASS.

- [ ] **Step 3: Run final GPT Image 2 smoke test**

```bash
BB_SMOKE_AI_PROVIDER=openai-image-2 npx tsx tmp/bestbottles-live-cylinder-smoke.ts
```

Expected: five rows saved under the Best Bottles org, all tagged `model:openai-image-2`.

- [ ] **Step 4: Run read-only QA**

```bash
node tmp/bestbottles-cylinder-readonly-framing-qa.mjs <run-id>
```

Expected: each SKU has `pass` or explicit `normalize`/`reject` reason.
