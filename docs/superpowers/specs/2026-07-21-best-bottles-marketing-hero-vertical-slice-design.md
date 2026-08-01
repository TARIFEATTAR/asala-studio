# Best Bottles Marketing Hero Vertical Slice Design

**Date:** 2026-07-21  
**Status:** Approved by Jordan on 2026-07-21  
**Repositories:** Madison Studio and Best Bottles Website  
**Production writes:** None during implementation and verification  

## Objective

Build one safe, testable path from a Best Bottles marketing render in Madison Studio to a group-level `marketingHeroAsset` in Sanity and then to the catalog grid, while keeping the PDP master pipeline isolated and unchanged.

## Scope

The vertical slice contains four connected capabilities:

1. Versioned, restrained low-plinth marketing themes in Madison Studio.
2. Explicit provider policy for marketing/scene presets while PDP presets remain GPT Image 2 only.
3. A dedicated, approval-gated Madison-to-Sanity `marketingHeroAsset` publish action.
4. A storefront query that uses an approved group thumbnail when present and otherwise falls back to the current catalog/PDP image.

The first verification pilot covers one Cylinder group and one Empire group. Expanding the lane to the full catalog is out of scope.

## Non-negotiable boundaries

- Product identity and geometry come from the product-truth reference and rig. The theme may change only the scene, lighting, and presentation surface.
- Code measures, gates, and places. The image model owns beautification and shadows.
- PDP primary and PDP secondary assets remain GPT Image 2 only.
- `master-angle-2080x2288` remains a PDP-secondary role and GPT Image 2 only.
- Scene-Flexible, Marketing, Sanity Hero, and Landscape Hero are marketing/scene roles and may use GPT Image 2, Nano Banana Pro, or Nano Banana 2 through the existing picker.
- Marketing renders never enter Convex product truth, Shopify media, PDP reconciliation, or the SKU-job promotion chain.
- A render cannot publish unless it has a supported marketing/scene role, supported provider provenance, a passing QA lifecycle, and explicit human approval.
- Publishing is dry-run by default. Implementation and tests perform no Sanity, Shopify, Convex, or Supabase production writes.
- Source files are copy-only; no source reference file is moved, renamed, or deleted.
- No commit, push, deployment, or production generation occurs without Jordan's separate instruction.

## Theme contract

The approved token family is `best-bottles-low-plinth-v1` with three variants:

| Token | Intended use | Surface |
| --- | --- | --- |
| `pale-limestone-low-plinth-v1` | Primary universal grid theme | Pale honed limestone/travertine |
| `warm-sandstone-low-plinth-v1` | Amber glass and warm metals | Warm fine-grain sandstone |
| `charcoal-slate-low-plinth-v1` | Clear/cobalt glass and silver | Dark honed charcoal slate |

Every token carries the same structural contract:

- Exactly one shallow rectangular platform.
- Platform occupies the lower 12–18% of the composition.
- Platform top meets the product rig's existing shelf line.
- Bottle remains upright, straight-on, centered, and at catalog-derived scale.
- Soft upper-front-left light with restrained model-owned contact shadow.
- Background tone may harmonize subtly with the platform material.
- No loose stones, bowls, plants, florals, liquids, labels, hands, or secondary props.
- Material texture is visible but subordinate to the bottle.
- Cylinder uses the normal centered safe area; Empire receives wider horizontal safe area for bulbs, hoses, and tassels.
- Free-form scene text may remain available for exploratory work, but an approved `marketingHeroAsset` must carry a recognized versioned theme token.

## Preset and provider policy

| Preset | Asset role | Provider policy |
| --- | --- | --- |
| PDP Master / Grid Card | `pdp-primary` | GPT Image 2 only |
| Angle / Exploded | `pdp-secondary` | GPT Image 2 only |
| Scene-Flexible | `scene` | Picker-selected OpenAI or Google |
| Marketing | `marketing` | Picker-selected OpenAI or Google |
| Sanity Hero | `marketing` | Picker-selected OpenAI or Google |
| Landscape Hero | `scene` | Picker-selected OpenAI or Google |

The client and server resolve the same role/provider contract. Any disagreement fails closed before a paid generation request.

## Approval and provenance contract

The dedicated publisher accepts a single render and derives a deterministic Sanity slot:

`marketingHeroAsset-{groupSlug}-{kind}`

For the initial grid lane, `kind` is `thumbnail`. The publisher must validate all of the following before upload or mutation:

- `groupSlug` is non-empty and normalized.
- `kind` is one of the schema-supported kinds.
- `imageUrl` is HTTPS.
- `assetRole` is `scene` or `marketing`.
- `providerModel` is `nano-banana-pro`, `nano-banana-2`, or `openai-image-2`.
- `lifecycleState` represents a passing QA state.
- `humanApprovalStatus` is explicitly `approved`.
- `themeId` is one of the versioned low-plinth theme IDs.
- Required product identity and generation provenance fields are present.

The Sanity document records the image, source URL, provider, theme ID/version, Madison render ID, QA state, approval identity/time, and optional notes. The publisher never writes Shopify or Convex.

## Storefront behavior

The catalog page fetches all published `marketingHeroAsset` documents with `kind == "thumbnail"` in one server-side Sanity query. It converts them into a `groupSlug -> image URL` map and passes the map to the catalog client.

For each group card:

1. Use the Sanity marketing thumbnail when its group slug matches and its image URL resolves.
2. Otherwise use the existing canonical group/PDP image without changing current selection logic.
3. A missing, malformed, or unavailable marketing asset must never blank the card.

The hover-filled-twin pilot remains separate and composes only after the base thumbnail choice; this work must not overwrite or repurpose that uncommitted pilot.

## Failure behavior

- Unknown theme, role, provider, or approval state: block locally with a specific error.
- Client/server role mismatch: block generation before provider invocation.
- Failed QA: show the render but disable dedicated publishing.
- Sanity dry-run: validate and report the deterministic target without uploading or mutating.
- Sanity asset missing or query failure: retain the canonical catalog/PDP image.
- Duplicate group/kind: deterministic replacement only after all validation passes.

## Verification

- Contract tests for theme IDs, prompt fragments, family-aware framing, and preset-role mapping.
- Provider-policy tests proving marketing/scene override and PDP/Angle lock.
- Publisher contract tests for every fail-closed condition and deterministic document ID.
- Storefront unit tests proving marketing thumbnail selection and canonical fallback.
- Existing Madison `npm run test:bestbottles:image-coverage` remains 383/383.
- Madison typecheck uses `tsc -p tsconfig.app.json`; compare with the pre-existing backlog and add no new errors.
- Website targeted Vitest tests, TypeScript/build verification, and catalog behavior checks must pass without external writes.

## Pilot acceptance

The code slice is ready for a later production trial when:

- One Cylinder and one Empire render can be generated in fresh tabs using a versioned low-plinth theme.
- Both keep product/cap geometry and the family rig baseline.
- A passing, explicitly approved render can dry-run to the deterministic Sanity thumbnail slot.
- The storefront resolves that slot and falls back cleanly when it is absent.
- Jordan separately authorizes any deployment, paid generation, Sanity write, commit, or push.
