# Best Bottles Marketing Hero Website Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Harden the `marketingHeroAsset` Sanity contract and make approved group thumbnails available to the catalog with a fail-safe canonical-image fallback.

**Architecture:** A pure publisher-core module validates manifests and provenance, the schema stores immutable generation/approval fields, and one server-side Sanity query builds a group-slug lookup. A pure resolver selects the marketing thumbnail only when valid; otherwise existing catalog image selection remains unchanged.

**Tech Stack:** TypeScript 5.9, Next.js 16 App Router, React 19, Sanity 5, GROQ, Node scripts, Vitest.

## Global Constraints

- Work only in `/Users/jordanrichter/Projects/Clients/Nemat-International/Best-Bottles-Website-02-20-2026/.claude/worktrees/cylinder-pipeline-handoff-1411d7`.
- Preserve all uncommitted filled-hover-twin pilot changes.
- Marketing assets write only to Sanity and never Shopify, Convex, or PDP product fields.
- Missing or invalid marketing assets must fall back to the current canonical catalog/PDP image.
- No production write, deployment, commit, stage, or push without Jordan's separate instruction.

---

## File structure

- Create `scripts/push-sanity-marketing-heroes-core.mjs`: pure manifest validation, deterministic ID, and document projection.
- Create `tests/push-sanity-marketing-heroes.test.ts`: publisher contract tests.
- Modify `scripts/push-sanity-marketing-heroes.mjs`: use the pure core; remain dry-run by default.
- Modify `src/sanity/schemaTypes/documents/marketingHeroAsset.ts`: add provider/theme/render/QA/approval provenance.
- Create `src/lib/products/marketing-hero-assets.ts`: typed GROQ query result and pure thumbnail resolver.
- Create `tests/marketing-hero-assets.test.ts`: resolver/fallback tests.
- Modify `src/app/catalog/page.tsx`: server-side Sanity query and map construction.
- Modify `src/app/catalog/CatalogClient.tsx`: accept the map and pass selected URL to the existing card image layer.
- Modify `src/components/products/ProductCardImagePreview.tsx` only if required to accept an explicit base-image override; preserve hover-pair behavior.

### Task 1: Harden the Sanity schema and offline publisher

**Files:**
- Create: `scripts/push-sanity-marketing-heroes-core.mjs`
- Create: `tests/push-sanity-marketing-heroes.test.ts`
- Modify: `scripts/push-sanity-marketing-heroes.mjs`
- Modify: `src/sanity/schemaTypes/documents/marketingHeroAsset.ts`

**Interfaces:**
- Produces: `validateMarketingHeroManifestEntry`, `marketingHeroDocumentId`, `buildMarketingHeroDocument`.
- Consumed by: Madison's matching contract semantically and the CLI publisher directly.

- [ ] **Step 1: Write failing publisher-core tests**

Use a valid `thumbnail` fixture and assert the same failure cases as Madison: unsupported role/provider/theme, failed QA, missing approval, non-HTTPS URL, invalid kind, duplicate slot, and missing render ID. Assert deterministic ID `marketingHeroAsset-${groupSlug}-${kind}` and a document containing all immutable provenance fields.

- [ ] **Step 2: Run the test and confirm RED**

Run: `npx vitest run tests/push-sanity-marketing-heroes.test.ts`  
Expected: FAIL because the core module does not exist.

- [ ] **Step 3: Implement the pure core**

```js
export const SUPPORTED_MARKETING_HERO_PROVIDERS = new Set([
  "nano-banana-pro",
  "nano-banana-2",
  "openai-image-2",
]);

export const SUPPORTED_MARKETING_HERO_THEMES = new Set([
  "pale-limestone-low-plinth-v1",
  "warm-sandstone-low-plinth-v1",
  "charcoal-slate-low-plinth-v1",
]);

export function validateMarketingHeroManifestEntry(entry) {
  const errors = [];
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(entry.groupSlug ?? "")) {
    errors.push("groupSlug must be a normalized lowercase slug");
  }
  if (!new Set(["thumbnail", "blog", "social", "campaign", "other"]).has(entry.kind)) {
    errors.push("kind is unsupported");
  }
  if (!/^https:\/\//.test(entry.imageUrl ?? "")) errors.push("imageUrl must be https");
  if (!new Set(["marketing", "scene"]).has(entry.assetRole)) errors.push("assetRole must be marketing or scene");
  if (!SUPPORTED_MARKETING_HERO_PROVIDERS.has(entry.providerModel)) errors.push("providerModel is unsupported");
  if (!SUPPORTED_MARKETING_HERO_THEMES.has(entry.themeId)) errors.push("themeId is unsupported");
  if (entry.qaState !== "qa-passed") errors.push("qaState must be qa-passed");
  if (entry.approvalStatus !== "approved") errors.push("approvalStatus must be approved");
  for (const key of ["title", "madisonRenderId", "approvedBy", "approvedAt"]) {
    if (typeof entry[key] !== "string" || !entry[key].trim()) errors.push(`${key} is required`);
  }
  return { ok: errors.length === 0, errors };
}

export function marketingHeroDocumentId(entry) {
  return `marketingHeroAsset-${entry.groupSlug}-${entry.kind}`;
}

export function buildMarketingHeroDocument(entry, sanityAssetId) {
  return {
    _id: marketingHeroDocumentId(entry),
    _type: "marketingHeroAsset",
    title: entry.title,
    groupSlug: entry.groupSlug,
    kind: entry.kind,
    image: { _type: "image", asset: { _type: "reference", _ref: sanityAssetId } },
    sourceUrl: entry.imageUrl,
    assetRole: entry.assetRole,
    providerModel: entry.providerModel,
    themeId: entry.themeId,
    madisonRenderId: entry.madisonRenderId,
    qaState: entry.qaState,
    approvalStatus: entry.approvalStatus,
    approvedBy: entry.approvedBy,
    approvedAt: entry.approvedAt,
    ...(entry.notes ? { notes: entry.notes } : {}),
  };
}
```

The implementation returns complete error lists, normalizes slugs consistently with Madison, and never touches the network.

- [ ] **Step 4: Refactor the CLI to use the pure core**

Keep dry-run as the default. Validate the full manifest and duplicate slots before any fetch. During dry-run, print deterministic IDs and normalized documents without requiring a token. During `--apply`, upload then `createOrReplace` the pure projected document.

- [ ] **Step 5: Extend the schema**

Add read-only required fields for `assetRole`, `providerModel`, `themeId`, `madisonRenderId`, `qaState`, `approvalStatus`, `approvedBy`, and `approvedAt`. Restrict provider/theme/kind to the supported lists. Keep `sourceUrl` read-only.

- [ ] **Step 6: Run the publisher tests and a local dry run fixture**

Run: `npx vitest run tests/push-sanity-marketing-heroes.test.ts`  
Expected: PASS.

Run: `node scripts/push-sanity-marketing-heroes.mjs --manifest tests/fixtures/marketing-hero-valid.json` only if a fixture is added; otherwise the unit test is the dry-run proof.  
Expected: no upload/mutation and deterministic thumbnail target output.

### Task 2: Query and pure group-thumbnail resolver

**Files:**
- Create: `src/lib/products/marketing-hero-assets.ts`
- Create: `tests/marketing-hero-assets.test.ts`

**Interfaces:**
- Produces: `MARKETING_HERO_THUMBNAILS_QUERY`, `MarketingHeroThumbnail`, `buildMarketingHeroThumbnailMap`, `resolveCatalogGroupImage`.
- Consumed by: Task 3.

- [ ] **Step 1: Write failing resolver tests**

```ts
import { describe, expect, it } from "vitest";
import {
  buildMarketingHeroThumbnailMap,
  resolveCatalogGroupImage,
} from "@/lib/products/marketing-hero-assets";

describe("marketing hero thumbnails", () => {
  it("selects a valid matching Sanity thumbnail", () => {
    const map = buildMarketingHeroThumbnailMap([
      { groupSlug: "cylinder-9ml", imageUrl: "https://cdn.example/hero.png" },
    ]);
    expect(resolveCatalogGroupImage({
      groupSlug: "cylinder-9ml",
      canonicalImageUrl: "https://cdn.example/pdp.png",
      marketingThumbnails: map,
    })).toBe("https://cdn.example/hero.png");
  });

  it("falls back for missing, malformed, or mismatched assets", () => {
    expect(resolveCatalogGroupImage({
      groupSlug: "empire-10ml",
      canonicalImageUrl: "https://cdn.example/pdp.png",
      marketingThumbnails: {},
    })).toBe("https://cdn.example/pdp.png");
  });
});
```

- [ ] **Step 2: Run the test and confirm RED**

Run: `npx vitest run tests/marketing-hero-assets.test.ts`  
Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement the query and resolver**

The GROQ query returns only published, non-draft `marketingHeroAsset` documents with `kind == "thumbnail"`, defined `groupSlug`, and defined image asset. Project `groupSlug` plus `imageUrl: image.asset->url`. The map builder ignores non-HTTPS URLs and resolves duplicate slugs deterministically by the latest `_updatedAt` if returned.

- [ ] **Step 4: Run the resolver tests and confirm GREEN**

Run: `npx vitest run tests/marketing-hero-assets.test.ts`  
Expected: PASS.

### Task 3: Catalog integration with canonical fallback

**Files:**
- Modify: `src/app/catalog/page.tsx`
- Modify: `src/app/catalog/CatalogClient.tsx`
- Modify if necessary: `src/components/products/ProductCardImagePreview.tsx`
- Modify: `tests/marketing-hero-assets.test.ts`

**Interfaces:**
- Consumes: Task 2 query/map/resolver.
- Produces: catalog cards that prefer a valid marketing thumbnail while retaining existing fallback and hover behavior.

- [ ] **Step 1: Add a failing integration-shaped resolver test**

Create a fixture matching the `CatalogGroup` image fields and assert that selecting a marketing thumbnail changes only the base display URL; all audit metadata, group slug, variant selection, and hover-pair arguments remain unchanged.

- [ ] **Step 2: Run the test and confirm RED**

Run: `npx vitest run tests/marketing-hero-assets.test.ts`  
Expected: FAIL until the catalog adapter accepts the marketing map.

- [ ] **Step 3: Fetch thumbnails server-side**

In `src/app/catalog/page.tsx`, call `sanityFetch` once with `MARKETING_HERO_THUMBNAILS_QUERY`. Catch query errors and pass `{}` so a Sanity outage cannot fail the catalog page. Do not issue one query per card.

- [ ] **Step 4: Thread the map through CatalogClient**

Add a serializable `marketingHeroThumbnails: Record<string, string>` prop. At the existing group-card image selection point, call `resolveCatalogGroupImage` with the current canonical URL and group slug. Pass the result as the base image. Preserve the uncommitted filled-hover-pair resolution and do not change PDP routes.

- [ ] **Step 5: Run targeted tests**

Run: `npx vitest run tests/marketing-hero-assets.test.ts tests/marketing-hover-pair.test.ts`  
Expected: both marketing hero selection and hover-pair pilot tests pass.

### Task 4: Website regression verification

**Files:**
- Verify only.

- [ ] **Step 1: Run all targeted tests**

Run: `npx vitest run tests/push-sanity-marketing-heroes.test.ts tests/marketing-hero-assets.test.ts tests/marketing-hover-pair.test.ts tests/push-sanity-marketing-hover-pair.test.ts`  
Expected: PASS.

- [ ] **Step 2: Run TypeScript/build verification**

Run: `npm run build`  
Expected: build succeeds, or any pre-existing failure is demonstrated not to originate in files changed by this plan.

- [ ] **Step 3: Inspect the scoped diff**

Run: `git diff -- scripts/push-sanity-marketing-heroes.mjs scripts/push-sanity-marketing-heroes-core.mjs tests/push-sanity-marketing-heroes.test.ts src/sanity/schemaTypes/documents/marketingHeroAsset.ts src/lib/products/marketing-hero-assets.ts tests/marketing-hero-assets.test.ts src/app/catalog/page.tsx src/app/catalog/CatalogClient.tsx src/components/products/ProductCardImagePreview.tsx`  
Expected: only approved hero publishing/query/fallback behavior; existing filled-hover changes remain preserved.

- [ ] **Step 4: Stop before external effects**

Do not run the publisher with `--apply`, deploy, stage, commit, or push. Report the local dry-run and test results.

## Commit policy

The writing-plans template normally includes a commit after every task. Jordan's explicit project rule overrides that default: no commit or staging step is permitted until Jordan says so.
