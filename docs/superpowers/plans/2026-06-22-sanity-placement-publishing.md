# Sanity Placement Publishing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build org-scoped Sanity publishing so Madison can safely target blog, homepage hero, product-family hero, product main image, and paper-doll component placements without confusing Shopify-owned Best Bottles product media.

**Architecture:** Store Sanity connection metadata and placement destination rules in Supabase. Put pure placement validation/patch-building helpers in `supabase/functions/_shared`, then keep the new Edge Function focused on auth, Sanity IO, and audit logging. Fail closed when schema/dataset/document targeting cannot be confirmed.

**Tech Stack:** Supabase Postgres migrations, Supabase Edge Functions on Deno, `@sanity/client`, Node `tsx --test`.

## Global Constraints

- Do not mutate Shopify variant SKUs or replace the Best Bottles legacy SKU model.
- Do not store Sanity write tokens in browser-readable fields; store only the Supabase secret name on `sanity_connections`.
- Best Bottles commerce PDP and catalog group images remain Shopify-first, then Convex-reconciled.
- New public schema tables must enable RLS and use organization membership/role policies.
- Placement publish must patch exactly one Sanity document field per request and write an audit row.
- `gv4os6ef` / `production` currently returns `Dataset not found`; Best Bottles mutation must stay blocked until the real dataset/schema is confirmed.

---

### Task 1: Shared Placement Rules

**Files:**
- Create: `supabase/functions/_shared/sanityPlacement.ts`
- Test: `supabase/functions/_shared/sanityPlacement.test.ts`

**Interfaces:**
- Produces: `normalizeDestinationKey(value)`, `selectDestinationConfig(rows, key, schemaProfile)`, `validatePlacementRequest(input, destination)`, `buildSelectorParams(destination, metadata)`, `buildImageField(assetId, metadata)`, `buildPatchSet(fieldPath, imageField)`.
- Consumes: Plain JSON registry rows from the Edge Function.

- [ ] **Step 1: Write failing tests**

```ts
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildImageField,
  buildPatchSet,
  selectDestinationConfig,
  validatePlacementRequest,
} from "./sanityPlacement";

describe("sanity placement rules", () => {
  it("prefers org/profile destination rows before generic fallbacks", () => {
    const selected = selectDestinationConfig([
      { destination_key: "homepage_hero", schema_profile: "generic", organization_id: null, target_field_path: "heroImage" },
      { destination_key: "homepage_hero", schema_profile: "best_bottles", organization_id: "org_1", target_field_path: "homepage.hero.image" },
    ], "homepage_hero", "best_bottles");
    assert.equal(selected?.target_field_path, "homepage.hero.image");
  });

  it("requires placement metadata before publish", () => {
    const result = validatePlacementRequest(
      { imageUrl: "https://cdn.example/image.png", metadata: { slug: "home" } },
      { required_metadata: ["documentId", "altText"], requires_image: true },
    );
    assert.deepEqual(result.ok, false);
    assert.match(result.errors.join(" "), /documentId/);
    assert.match(result.errors.join(" "), /altText/);
  });

  it("builds a single Sanity patch object for one image field", () => {
    const image = buildImageField("image-abc-1000x1300-png", { altText: "Bottle family hero" });
    assert.deepEqual(buildPatchSet("heroImage", image), { heroImage: image });
  });
});
```

- [ ] **Step 2: Run red test**

Run: `npx tsx --test supabase/functions/_shared/sanityPlacement.test.ts`

Expected: FAIL because `sanityPlacement` does not exist.

- [ ] **Step 3: Implement minimal helper module**

Create the exported functions above with deterministic fallback order, required metadata validation, image URL validation, and a single-field patch builder.

- [ ] **Step 4: Run green test**

Run: `npx tsx --test supabase/functions/_shared/sanityPlacement.test.ts`

Expected: PASS.

### Task 2: Supabase Schema

**Files:**
- Create: `supabase/migrations/<timestamp>_sanity_connections_and_destinations.sql`

**Interfaces:**
- Produces: `sanity_connections`, `sanity_destination_registry`, `sanity_publish_log`, and `sanity_schema_inspections`.
- Consumes: Existing `organizations`, `organization_members`, `is_organization_member`, `has_organization_role`, and `update_updated_at_column`.

- [ ] **Step 1: Create migration shell**

Run: `supabase migration new sanity_connections_and_destinations`

- [ ] **Step 2: Write SQL**

Add tables with RLS:
- `sanity_connections`: one active project/dataset/studio/schema profile/token secret per organization.
- `sanity_destination_registry`: global defaults plus org overrides for `blog_post`, `homepage_hero`, `product_family_hero`, `product_main_image`, `paper_doll_component`.
- `sanity_publish_log`: every inspect/publish attempt and result.
- `sanity_schema_inspections`: inferred live document types and sampled fields.

- [ ] **Step 3: Verify migration syntax**

Run: `supabase migration list --local`

Expected: migration file appears locally.

### Task 3: Placement-Aware Edge Function

**Files:**
- Create: `supabase/functions/push-sanity-placement/index.ts`

**Interfaces:**
- Consumes: shared helpers from Task 1 and tables from Task 2.
- Produces: authenticated `inspect` and `publish` actions.

- [ ] **Step 1: Implement request handling**

Support:
```ts
type RequestBody =
  | { action: "inspect"; organizationId: string; connectionId?: string; projectId?: string; dataset?: string }
  | { action: "publish"; organizationId: string; connectionId?: string; destinationKey: string; imageUrl: string; metadata: Record<string, unknown>; dryRun?: boolean };
```

- [ ] **Step 2: Implement auth and config resolution**

Verify the caller JWT, verify organization membership with service role, load the active Sanity connection, and read the Sanity token from `Deno.env.get(connection.write_token_secret_name)`.

- [ ] **Step 3: Implement schema inspection**

Query observed Sanity document types and sample fields. Insert a `sanity_schema_inspections` row. Return a clear blocked status for missing project/dataset, including the `gv4os6ef` / `production` failure.

- [ ] **Step 4: Implement publish**

Validate registry metadata, run inspection, resolve exactly one document with the destination selector, upload image asset, patch `target_field_path`, and insert a `sanity_publish_log` row for success or failure.

### Task 4: Verification

**Files:**
- Modify only if needed: `docs/SANITY_SETUP_GUIDE.md`

**Interfaces:**
- Consumes: tests and Edge Function from earlier tasks.
- Produces: documented setup notes for secret names and Best Bottles dataset confirmation.

- [ ] **Step 1: Run focused tests**

Run: `npx tsx --test supabase/functions/_shared/sanityPlacement.test.ts`

- [ ] **Step 2: Run existing related tests**

Run: `npx tsx --test supabase/functions/_shared/inlineRefinementPrompt.test.ts`

- [ ] **Step 3: Record live schema inspection result**

Document that `https://gv4os6ef.api.sanity.io/v2024-01-01/data/query/production` returns `404 Dataset not found` until the Best Bottles dataset is corrected.

